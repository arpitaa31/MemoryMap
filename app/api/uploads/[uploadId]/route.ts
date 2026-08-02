import { NextResponse } from "next/server";
import {
  authenticateRequest,
  cdnErrorResponse,
  deleteFromHackClubCdn,
  getFirestoreDocument,
  patchFirestoreDocument,
  requireMemoryMapAccess,
} from "../../../../lib/uploads/server";

export const runtime = "nodejs";

const IMAGE_FIELDS = [
  "imageUrl",
  "imageUploadId",
  "imageFilename",
  "imageSize",
  "imageContentType",
  "imageUploaderId",
];
const MEMORY_ID_PATTERN = /^[^/\\]{1,150}$/;

function isMemoryResourceId(value: unknown): value is string {
  return typeof value === "string" && MEMORY_ID_PATTERN.test(value.trim());
}

function memoryPath(memoryMapId: string, memoryId: string) {
  return `memoryMaps/${memoryMapId}/memories/${memoryId}`;
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ uploadId: string }> },
) {
  const authentication = await authenticateRequest(request);
  if (!authentication.ok) return authentication.response;
  if (authentication.request.isAnonymous) {
    return NextResponse.json({ error: "Guest sessions cannot manage image uploads. Continue with Google to unlock photo memories." }, { status: 403 });
  }

  const { uploadId } = await params;
  if (!uploadId || uploadId.length > 200 || uploadId.includes("/")) {
    return NextResponse.json({ error: "A valid upload id is required." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid deletion request is required." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "A valid deletion request is required." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const memoryMapId = typeof payload.memoryMapId === "string" ? payload.memoryMapId.trim() : "";
  const memoryId = typeof payload.memoryId === "string" ? payload.memoryId.trim() : "";

  if (!isMemoryResourceId(memoryMapId) || !isMemoryResourceId(memoryId)) {
    return NextResponse.json({ error: "A valid MemoryMap and memory are required." }, { status: 400 });
  }

  const access = await requireMemoryMapAccess(memoryMapId, authentication.request.idToken, authentication.request.uid);
  if (!access.ok) return access.response;

  const path = memoryPath(memoryMapId, memoryId);
  const memory = await getFirestoreDocument(path, authentication.request.idToken);
  if (!memory.ok) {
    const status = memory.kind === "not-found" ? 404 : 503;
    return NextResponse.json({ error: "The memory could not be found or accessed." }, { status });
  }

  if (memory.data.imageUploadId !== uploadId) {
    return NextResponse.json({ error: "The requested upload was not found." }, { status: 404 });
  }

  const uploaderId = typeof memory.data.imageUploaderId === "string" ? memory.data.imageUploaderId : null;
  if (!access.isOwner && uploaderId !== authentication.request.uid) {
    return NextResponse.json({ error: "Only the uploader or MemoryMap owner can delete this image." }, { status: 403 });
  }

  const removed = await deleteFromHackClubCdn(uploadId);
  if (!removed.ok && removed.error.status !== 404) return cdnErrorResponse(removed.error, "delete");

  const cleared = await patchFirestoreDocument(path, authentication.request.idToken, {}, IMAGE_FIELDS);
  if (!cleared.ok) {
    return NextResponse.json({ error: "The image was removed, but the memory record could not be updated." }, { status: 502 });
  }

  return NextResponse.json({ deleted: true });
}
