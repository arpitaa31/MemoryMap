import type { DocumentReference, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { deleteFromHackClubCdn } from "../../../../lib/uploads/server";
import { getAdminServices } from "../../../../lib/firebase/admin";

export const runtime = "nodejs";

const MEMORY_MAP_ID_PATTERN = /^[^/\\]{1,150}$/;
const DELETE_BATCH_SIZE = 450;
const SAFE_DELETION_MESSAGE = "The campus data could not be removed.";

type ImageCleanup = { attempted: number; deleted: number; missing: number; failed: number };

function logStageFailure(stage: string, error: unknown) {
  console.error("Campus deletion failed", {
    stage,
    code: error instanceof Error ? error.name : "unknown",
    message: error instanceof Error ? error.message : String(error),
  });
}

function failureResponse(stage: string, status: number, code: string, message: string, error: unknown = new Error(message)) {
  logStageFailure(stage, error);
  return NextResponse.json({ error: { code, message, stage } }, { status });
}

function cleanupFailure(stage: string, error: unknown) {
  logStageFailure(stage, error);
  return NextResponse.json({ error: { code: "campus_deletion_failed", message: SAFE_DELETION_MESSAGE, stage } }, { status: 500 });
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
    if (!process.env.FIREBASE_ADMIN_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL || !process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      return failureResponse("verify Firebase ID token", 503, "server-not-configured", "The server deletion service is not configured.", new Error("Firebase Admin credentials are not configured."));
    }
    ({ auth, firestore } = getAdminServices());
  } catch (error) {
    return failureResponse("verify Firebase ID token", 503, "server-not-configured", "The server deletion service is not configured.", error);
  }

  let verifiedToken;
  try {
    verifiedToken = await auth.verifyIdToken(idToken);
  } catch (error) {
    return failureResponse("verify Firebase ID token", 401, "unauthenticated", "Your sign-in session expired. Please sign in again.", error);
  }

  const mapRef = firestore.collection("memoryMaps").doc(memoryMapId);
  let mapSnapshot;
  try {
    mapSnapshot = await mapRef.get();
  } catch (error) {
    return cleanupFailure("load MemoryMap", error);
  }
  if (!mapSnapshot.exists) {
    return failureResponse("load MemoryMap", 404, "campus-not-found", "This campus no longer exists.", new Error("MemoryMap document does not exist."));
  }

  const mapData = mapSnapshot.data() ?? {};
  if (mapData.ownerId !== verifiedToken.uid) {
    return failureResponse("confirm requester is owner", 403, "not-owner", "Only the campus owner can delete this campus.", new Error("Requester does not own this MemoryMap."));
  }

  let memorySnapshot;
  try {
    memorySnapshot = await mapRef.collection("memories").get();
  } catch (error) {
    return cleanupFailure("load memories", error);
  }

  const uploadIds = [...new Set(memorySnapshot.docs
    .map((memory) => memory.data().imageUploadId)
    .filter((uploadId): uploadId is string => typeof uploadId === "string" && uploadId.length > 0))];
  const imageCleanup: ImageCleanup = { attempted: uploadIds.length, deleted: 0, missing: 0, failed: 0 };

  for (const uploadId of uploadIds) {
    try {
      const removed = await deleteFromHackClubCdn(uploadId);
      if (removed.ok) {
        imageCleanup.deleted += 1;
      } else if (removed.error.status === 404) {
        imageCleanup.missing += 1;
      } else {
        imageCleanup.failed += 1;
        const imageError = new Error("The image service did not remove this upload.");
        imageError.name = removed.error.kind;
        logStageFailure("delete Hack Club CDN images", imageError);
        console.error("Campus image cleanup upload failed", { uploadId, code: imageError.name, message: imageError.message });
      }
    } catch (error) {
      imageCleanup.failed += 1;
      logStageFailure("delete Hack Club CDN images", error);
      console.error("Campus image cleanup upload failed", { uploadId, code: error instanceof Error ? error.name : "unknown", message: error instanceof Error ? error.message : String(error) });
    }
  }

  try {
    await deleteReferences(firestore, memorySnapshot.docs.map((memory) => memory.ref));
  } catch (error) {
    return cleanupFailure("delete memories", error);
  }

  let floorSnapshots: QueryDocumentSnapshot[];
  try {
    floorSnapshots = (await mapRef.collection("floors").get()).docs;
  } catch (error) {
    return cleanupFailure("load floors", error);
  }

  try {
    const roomReferences: DocumentReference[] = [];
    for (const floor of floorSnapshots) {
      const rooms = await floor.ref.collection("rooms").get();
      rooms.docs.forEach((room) => roomReferences.push(room.ref));
    }
    await deleteReferences(firestore, roomReferences);
  } catch (error) {
    return cleanupFailure("delete rooms", error);
  }

  try {
    const corridorReferences: DocumentReference[] = [];
    for (const floor of floorSnapshots) {
      const corridors = await floor.ref.collection("corridors").get();
      corridors.docs.forEach((corridor) => corridorReferences.push(corridor.ref));
    }
    await deleteReferences(firestore, corridorReferences);
  } catch (error) {
    return cleanupFailure("delete corridors", error);
  }

  try {
    await deleteReferences(firestore, floorSnapshots.map((floor) => floor.ref));
  } catch (error) {
    return cleanupFailure("delete floors", error);
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
  } catch (error) {
    return cleanupFailure("delete members", error);
  }

  try {
    const indexReferences = [...memberIds].map((userId) => firestore.collection("users").doc(userId).collection("memoryMaps").doc(memoryMapId));
    await deleteReferences(firestore, indexReferences);
  } catch (error) {
    return cleanupFailure("delete user campus indexes", error);
  }

  const inviteCode = typeof mapData.inviteCode === "string" ? mapData.inviteCode : "";
  if (inviteCode) {
    try {
      await firestore.collection("inviteCodes").doc(inviteCode).delete();
    } catch (error) {
      return cleanupFailure("delete invite-code mapping", error);
    }
  }

  try {
    await mapRef.delete();
  } catch (error) {
    return cleanupFailure("delete parent MemoryMap", error);
  }

  return NextResponse.json({
    ok: true,
    deleted: true,
    imageCleanup,
    partialCleanup: imageCleanup.failed > 0 || imageCleanup.missing > 0,
    ...(imageCleanup.failed > 0 ? { warning: { code: "image_cleanup_partial", message: "Some uploaded images could not be removed.", stage: "delete Hack Club CDN images" } } : {}),
  });
}
