import type { DocumentReference, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { deleteFromHackClubCdn } from "../../../../lib/uploads/server";
import { getAdminServices } from "../../../../lib/firebase/admin";

export const runtime = "nodejs";

const MEMORY_MAP_ID_PATTERN = /^[^/\\]{1,150}$/;
const DELETE_BATCH_SIZE = 450;

type ImageCleanup = { attempted: number; deleted: number; missing: number; failed: number };

function failureResponse(stage: string, status: number, code: string, message: string) {
  console.error("Campus deletion failed", { stage, status, code, message });
  return NextResponse.json({ error: { code, message, stage } }, { status });
}

async function deleteReferences(firestore: FirebaseFirestore.Firestore, references: DocumentReference[]) {
  for (let index = 0; index < references.length; index += DELETE_BATCH_SIZE) {
    const batch = firestore.batch();
    references.slice(index, index + DELETE_BATCH_SIZE).forEach((reference) => batch.delete(reference));
    await batch.commit();
  }
}

function getAuthorizationToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization || !authorization.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token && token.length <= 4096 ? token : null;
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ memoryMapId: string }> },
) {
  const { memoryMapId } = await params;
  if (!MEMORY_MAP_ID_PATTERN.test(memoryMapId)) {
    return failureResponse("read authorization header", 400, "invalid-campus", "A valid campus is required.");
  }

  const idToken = getAuthorizationToken(request);
  if (!idToken) {
    return failureResponse("read authorization header", 401, "unauthenticated", "Your sign-in session is required.");
  }

  let auth: ReturnType<typeof getAdminServices>["auth"];
  let firestore: ReturnType<typeof getAdminServices>["firestore"];
  try {
    if (!process.env.FIREBASE_ADMIN_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL || !process.env.FIREBASE_ADMIN_PRIVATE_KEY || !process.env.HACKCLUB_CDN_API_KEY) {
      return failureResponse("verify Firebase ID token", 503, "server-not-configured", "The server deletion service is not configured.");
    }
    ({ auth, firestore } = getAdminServices());
  } catch {
    return failureResponse("verify Firebase ID token", 503, "server-not-configured", "The server deletion service is not configured.");
  }

  let verifiedToken;
  try {
    verifiedToken = await auth.verifyIdToken(idToken);
  } catch {
    return failureResponse("verify Firebase ID token", 401, "unauthenticated", "Your sign-in session expired. Please sign in again.");
  }

  const mapRef = firestore.collection("memoryMaps").doc(memoryMapId);
  let mapSnapshot;
  try {
    mapSnapshot = await mapRef.get();
  } catch {
    return failureResponse("load MemoryMap", 500, "cleanup-failed", "The campus data could not be removed.");
  }
  if (!mapSnapshot.exists) {
    return failureResponse("load MemoryMap", 404, "campus-not-found", "This campus no longer exists.");
  }

  const mapData = mapSnapshot.data() ?? {};
  if (mapData.ownerId !== verifiedToken.uid) {
    return failureResponse("confirm requester is owner", 403, "not-owner", "Only the campus owner can delete this campus.");
  }

  let memorySnapshot;
  try {
    memorySnapshot = await mapRef.collection("memories").get();
  } catch {
    return failureResponse("load memories", 500, "cleanup-failed", "The campus data could not be removed.");
  }

  const uploadIds = [...new Set(memorySnapshot.docs
    .map((memory) => memory.data().imageUploadId)
    .filter((uploadId): uploadId is string => typeof uploadId === "string" && uploadId.length > 0))];
  const imageCleanup: ImageCleanup = { attempted: uploadIds.length, deleted: 0, missing: 0, failed: 0 };
  let imageCleanupFailed = false;

  try {
    for (const uploadId of uploadIds) {
      const removed = await deleteFromHackClubCdn(uploadId);
      if (removed.ok) {
        imageCleanup.deleted += 1;
      } else if (removed.error.status === 404) {
        imageCleanup.missing += 1;
      } else {
        imageCleanup.failed += 1;
        imageCleanupFailed = true;
        console.error("Campus image cleanup upload failed", { uploadId, status: removed.error.status ?? 503, code: removed.error.kind, message: "The image service did not remove this upload." });
        console.error("Campus deletion failed", { stage: "delete Hack Club CDN images", status: 503, code: removed.error.kind === "missing-key" ? "server-not-configured" : "image-cleanup-failed", message: "Some uploaded images could not be removed." });
      }
    }
  } catch {
    imageCleanupFailed = true;
    console.error("Campus deletion failed", { stage: "delete Hack Club CDN images", status: 503, code: "image-cleanup-failed", message: "Some uploaded images could not be removed." });
  }

  try {
    await deleteReferences(firestore, memorySnapshot.docs.map((memory) => memory.ref));
  } catch {
    return failureResponse("delete memory documents", 500, "cleanup-failed", "The campus data could not be removed.");
  }

  let floorSnapshots: QueryDocumentSnapshot[];
  try {
    floorSnapshots = (await mapRef.collection("floors").get()).docs;
    const roomReferences: DocumentReference[] = [];
    for (const floor of floorSnapshots) {
      const rooms = await floor.ref.collection("rooms").get();
      rooms.docs.forEach((room) => roomReferences.push(room.ref));
    }
    await deleteReferences(firestore, roomReferences);
  } catch {
    return failureResponse("delete room documents", 500, "cleanup-failed", "The campus data could not be removed.");
  }

  try {
    const corridorReferences: DocumentReference[] = [];
    for (const floor of floorSnapshots) {
      const corridors = await floor.ref.collection("corridors").get();
      corridors.docs.forEach((corridor) => corridorReferences.push(corridor.ref));
    }
    await deleteReferences(firestore, corridorReferences);
  } catch {
    return failureResponse("delete corridor documents", 500, "cleanup-failed", "The campus data could not be removed.");
  }

  try {
    await deleteReferences(firestore, floorSnapshots.map((floor) => floor.ref));
  } catch {
    return failureResponse("delete floor documents", 500, "cleanup-failed", "The campus data could not be removed.");
  }

  let memberIds = new Set<string>([verifiedToken.uid]);
  try {
    const members = await mapRef.collection("members").get();
    memberIds = new Set<string>([verifiedToken.uid]);
    members.docs.forEach((member) => {
      const userId = member.data().userId;
      memberIds.add(typeof userId === "string" && userId ? userId : member.id);
    });
    await deleteReferences(firestore, members.docs.map((member) => member.ref));
  } catch {
    return failureResponse("delete member documents", 500, "cleanup-failed", "The campus data could not be removed.");
  }

  try {
    const indexReferences = [...memberIds].map((userId) => firestore.collection("users").doc(userId).collection("memoryMaps").doc(memoryMapId));
    await deleteReferences(firestore, indexReferences);
  } catch {
    return failureResponse("delete user campus indexes", 500, "cleanup-failed", "The campus data could not be removed.");
  }

  const inviteCode = typeof mapData.inviteCode === "string" ? mapData.inviteCode : "";
  if (inviteCode) {
    try {
      await firestore.collection("inviteCodes").doc(inviteCode).delete();
    } catch {
      return failureResponse("delete invite-code document", 500, "cleanup-failed", "The campus data could not be removed.");
    }
  }

  try {
    await mapRef.delete();
  } catch {
    return failureResponse("delete MemoryMap document", 500, "cleanup-failed", "The campus data could not be removed.");
  }

  if (imageCleanupFailed) {
    return NextResponse.json({
      ok: false,
      deleted: true,
      imageCleanup,
      error: { code: "image-cleanup-failed", message: "Some uploaded images could not be removed.", stage: "delete Hack Club CDN images" },
    }, { status: 503 });
  }

  return NextResponse.json({ ok: true, deleted: true, imageCleanup });
}
