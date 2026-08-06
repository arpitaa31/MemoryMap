import { NextResponse } from "next/server";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  authenticateRequest,
  cdnErrorResponse,
  deleteFromHackClubCdn,
  getFirestoreDocument,
  hasImageSignature,
  imageFirestoreFields,
  patchFirestoreDocument,
  requireMemoryMapAccess,
  uploadToHackClubCdn,
} from "../../../lib/uploads/server";

export const runtime = "nodejs";

const MEMORY_ID_PATTERN = /^[^/\\]{1,150}$/;
const IMAGE_FIELDS = [
  "imageUrl",
  "imageUploadId",
  "imageFilename",
  "imageSize",
  "imageContentType",
  "imageUploaderId",
];

function readTextField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isMemoryResourceId(value: string) {
  return MEMORY_ID_PATTERN.test(value);
}

function memoryPath(memoryMapId: string, memoryId: string) {
  return `memoryMaps/${memoryMapId}/memories/${memoryId}`;
}

function imageValidationError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const authentication = await authenticateRequest(request);
  if (!authentication.ok) return authentication.response;
  if (authentication.request.isAnonymous) {
    return NextResponse.json({ error: "Guest sessions cannot upload images. Continue with Google to unlock photo memories." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return imageValidationError("The upload form could not be read.");
  }

  const memoryMapId = readTextField(formData, "memoryMapId");
  const memoryId = readTextField(formData, "memoryId");
  const floorId = readTextField(formData, "floorId");
  const roomId = readTextField(formData, "roomId");
  const fileEntry = formData.get("file");

  if (!isMemoryResourceId(memoryMapId) || !isMemoryResourceId(memoryId) || !isMemoryResourceId(floorId) || !isMemoryResourceId(roomId)) {
    return imageValidationError("A valid MemoryMap and memory are required.");
  }

  if (!(fileEntry instanceof File)) {
    return imageValidationError("An image file is required.");
  }

  const contentType = fileEntry.type.toLowerCase();
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType)) {
    return imageValidationError("Please choose a JPEG, PNG or WebP image.", 415);
  }

  if (fileEntry.size <= 0) return imageValidationError("The image file is empty.");
  if (fileEntry.size > MAX_IMAGE_BYTES) return imageValidationError("This image is larger than 5 MB.", 413);

  const bytes = new Uint8Array(await fileEntry.arrayBuffer());
  if (!hasImageSignature(contentType, bytes)) {
    return imageValidationError("Please choose a JPEG, PNG or WebP image.", 415);
  }

  const access = await requireMemoryMapAccess(memoryMapId, authentication.request.idToken, authentication.request.uid);
  if (!access.ok) return access.response.status === 403
    ? NextResponse.json({ error: "You do not have permission to add images to this campus." }, { status: 403 })
    : access.response;

  const path = memoryPath(memoryMapId, memoryId);
  const memory = await getFirestoreDocument(path, authentication.request.idToken);
  if (!memory.ok) {
    const status = memory.kind === "not-found" ? 404 : 503;
    return NextResponse.json({ error: "The memory could not be found or accessed." }, { status });
  }

  const uploaded = await uploadToHackClubCdn(fileEntry);
  if (!uploaded.ok) return cdnErrorResponse(uploaded.error, "upload");

  const previousUploadId = typeof memory.data.imageUploadId === "string" ? memory.data.imageUploadId : null;
  const saved = await patchFirestoreDocument(
    path,
    authentication.request.idToken,
    imageFirestoreFields(uploaded.data, authentication.request.uid),
    IMAGE_FIELDS,
  );

  if (!saved.ok) {
    await deleteFromHackClubCdn(uploaded.data.id);
    return NextResponse.json({ error: "The image uploaded but could not be attached to the memory." }, { status: 502 });
  }

  if (previousUploadId && previousUploadId !== uploaded.data.id) {
    await deleteFromHackClubCdn(previousUploadId);
  }

  return NextResponse.json(uploaded.data, { status: 201 });
}
