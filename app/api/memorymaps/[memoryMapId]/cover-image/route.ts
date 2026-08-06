import { NextResponse } from "next/server";
import { getAdminServices } from "../../../../../lib/firebase/admin.server";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, deleteFromHackClubCdn, hasImageSignature, uploadToHackClubCdn } from "../../../../../lib/uploads/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEMORY_MAP_ID_PATTERN = /^[^/\\]{1,150}$/;
const COVER_POSITIONS = ["top", "center", "bottom"] as const;
type CoverPosition = (typeof COVER_POSITIONS)[number];

function bearerToken(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  if (!value.toLowerCase().startsWith("bearer ")) return null;
  const token = value.slice(7).trim();
  return token && token.length <= 4096 ? token : null;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isCoverPosition(value: unknown): value is CoverPosition {
  return COVER_POSITIONS.includes(value as CoverPosition);
}

function textField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function getOwnerContext(request: Request, memoryMapId: string) {
  const idToken = bearerToken(request);
  if (!idToken) return { response: errorResponse("Sign-in is required.", 401) } as const;

  let services: Awaited<ReturnType<typeof getAdminServices>>;
  try {
    services = await getAdminServices();
  } catch (error) {
    console.error("Cover photo service configuration failed", { code: error && typeof error === "object" && "code" in error ? String(error.code) : "unknown" });
    return { response: errorResponse("The cover photo service is not configured correctly.", 503) } as const;
  }

  let verifiedToken;
  try {
    verifiedToken = await services.auth.verifyIdToken(idToken);
  } catch {
    return { response: errorResponse("Your sign-in session is no longer valid.", 401) } as const;
  }

  if (verifiedToken.firebase?.sign_in_provider === "anonymous") {
    return { response: errorResponse("Sign in with Google to add a campus cover photo.", 403) } as const;
  }

  const mapRef = services.firestore.collection("memoryMaps").doc(memoryMapId);
  let mapSnapshot;
  try {
    mapSnapshot = await mapRef.get();
  } catch (error) {
    console.error("Cover photo campus lookup failed", { stage: "load campus", errorName: error instanceof Error ? error.name : "unknown" });
    return { response: errorResponse("The campus could not be loaded. Please try again.", 503) } as const;
  }
  if (!mapSnapshot.exists) return { response: errorResponse("This campus no longer exists.", 404) } as const;
  const mapData = mapSnapshot.data() ?? {};
  if (mapData.ownerId !== verifiedToken.uid) return { response: errorResponse("You do not have permission to change this campus photo.", 403) } as const;

  return { auth: verifiedToken, mapRef, mapData, firestore: services.firestore } as const;
}

async function commitCoverFields(
  context: Extract<Awaited<ReturnType<typeof getOwnerContext>>, { auth: unknown }>,
  fields: Record<string, unknown>,
) {
  const batch = context.firestore.batch();
  batch.update(context.mapRef, fields);
  const inviteCode = typeof context.mapData.inviteCode === "string" ? context.mapData.inviteCode.trim() : "";
  if (inviteCode) {
    const inviteRef = context.firestore.collection("inviteCodes").doc(inviteCode);
    if ((await inviteRef.get()).exists) batch.update(inviteRef, {
      coverImageUrl: fields.coverImageUrl ?? null,
      coverImagePosition: fields.coverImagePosition ?? "center",
      coverImageUpdatedAt: fields.coverImageUpdatedAt ?? null,
    });
  }
  await batch.commit();
}

export async function POST(request: Request, { params }: { params: Promise<{ memoryMapId: string }> }) {
  const { memoryMapId } = await params;
  if (!MEMORY_MAP_ID_PATTERN.test(memoryMapId)) return errorResponse("A valid campus is required.", 400);

  const context = await getOwnerContext(request, memoryMapId);
  if ("response" in context) return context.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("The cover photo form could not be read.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return errorResponse("Please choose a cover photo.", 400);
  const positionValue = textField(formData, "position");
  const position: CoverPosition = isCoverPosition(positionValue) ? positionValue : "center";
  const contentType = file.type.toLowerCase();
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType)) return errorResponse("Please choose a JPEG, PNG or WebP image.", 415);
  if (file.size <= 0) return errorResponse("The cover photo is empty.", 400);
  if (file.size > MAX_IMAGE_BYTES) return errorResponse("Image size must be under 5 MB.", 413);
  if (!hasImageSignature(contentType, new Uint8Array(await file.arrayBuffer()))) return errorResponse("Please choose a JPEG, PNG or WebP image.", 415);

  const uploaded = await uploadToHackClubCdn(file);
  if (!uploaded.ok) {
    return NextResponse.json({ error: uploaded.error.kind === "upstream" ? "We could not upload the cover photo. Please try again." : "The image service is temporarily unavailable." }, { status: 502 });
  }

  const oldStorageId = typeof context.mapData.coverImageStorageId === "string" ? context.mapData.coverImageStorageId : null;
  const updatedAt = new Date();
  try {
    await commitCoverFields(context, {
      coverImageUrl: uploaded.data.url,
      coverImageStorageId: uploaded.data.id,
      coverImagePosition: position,
      coverImageUpdatedAt: updatedAt,
      updatedAt,
    });
  } catch (error) {
    await deleteFromHackClubCdn(uploaded.data.id);
    console.error("Cover photo Firestore update failed", { stage: "save cover reference", errorName: error instanceof Error ? error.name : "unknown" });
    return errorResponse("The cover photo uploaded but could not be saved. Please try again.", 502);
  }

  let warning: string | null = null;
  if (oldStorageId && oldStorageId !== uploaded.data.id) {
    const removed = await deleteFromHackClubCdn(oldStorageId);
    if (!removed.ok && removed.error.status !== 404) warning = "The new cover photo is saved, but the previous photo could not be removed.";
  }

  return NextResponse.json({ coverImage: { url: uploaded.data.url, storageId: uploaded.data.id, position }, warning }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ memoryMapId: string }> }) {
  const { memoryMapId } = await params;
  if (!MEMORY_MAP_ID_PATTERN.test(memoryMapId)) return errorResponse("A valid campus is required.", 400);

  const context = await getOwnerContext(request, memoryMapId);
  if ("response" in context) return context.response;
  const oldStorageId = typeof context.mapData.coverImageStorageId === "string" ? context.mapData.coverImageStorageId : null;
  const updatedAt = new Date();
  try {
    await commitCoverFields(context, { coverImageUrl: null, coverImageStorageId: null, coverImagePosition: "center", coverImageUpdatedAt: null, updatedAt });
  } catch (error) {
    console.error("Cover photo removal failed", { stage: "clear cover reference", errorName: error instanceof Error ? error.name : "unknown" });
    return errorResponse("The cover photo could not be removed. Please try again.", 502);
  }

  let warning: string | null = null;
  if (oldStorageId) {
    const removed = await deleteFromHackClubCdn(oldStorageId);
    if (!removed.ok && removed.error.status !== 404) warning = "The cover photo was removed from the campus, but the stored file could not be deleted.";
  }
  return NextResponse.json({ deleted: true, warning });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ memoryMapId: string }> }) {
  const { memoryMapId } = await params;
  if (!MEMORY_MAP_ID_PATTERN.test(memoryMapId)) return errorResponse("A valid campus is required.", 400);

  const context = await getOwnerContext(request, memoryMapId);
  if ("response" in context) return context.response;
  const currentUrl = typeof context.mapData.coverImageUrl === "string" ? context.mapData.coverImageUrl : "";
  const storageId = typeof context.mapData.coverImageStorageId === "string" ? context.mapData.coverImageStorageId : "";
  if (!currentUrl || !storageId) return errorResponse("Add a cover photo before changing its position.", 400);

  let body: unknown;
  try { body = await request.json(); } catch { return errorResponse("A valid cover photo position is required.", 400); }
  const position = body && typeof body === "object" && "position" in body && isCoverPosition(body.position) ? body.position : null;
  if (!position) return errorResponse("Choose a top, center or bottom photo position.", 400);
  const updatedAt = new Date();
  try {
    await commitCoverFields(context, { coverImageUrl: currentUrl, coverImageStorageId: storageId, coverImagePosition: position, coverImageUpdatedAt: updatedAt, updatedAt });
  } catch (error) {
    console.error("Cover photo position update failed", { stage: "save cover position", errorName: error instanceof Error ? error.name : "unknown" });
    return errorResponse("The cover photo position could not be saved. Please try again.", 502);
  }
  return NextResponse.json({ coverImage: { url: currentUrl, storageId, position } });
}
