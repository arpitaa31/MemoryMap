import { NextResponse } from "next/server";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  authenticateRequest,
  cdnErrorResponse,
  deleteFromHackClubCdn,
  getFirestoreDocument,
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

function hasImageSignature(contentType: string, bytes: Uint8Array) {
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  return contentType === "image/webp"
    && bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
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
