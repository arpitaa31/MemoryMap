import type { DocumentReference, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminServices } from "../../../../lib/firebase/admin.server";
import { deleteFromHackClubCdn } from "../../../../lib/uploads/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEMORY_MAP_ID_PATTERN = /^[^/\\]{1,150}$/;
const DELETE_BATCH_SIZE = 400;
const SAFE_DELETION_MESSAGE = "The campus data could not be removed.";

type ImageCleanup = { attempted: number; deleted: number; missing: number; failed: number };

function logStageFailure(stage: string, error: unknown) {
  console.error("Campus deletion failed", {
    stage,
    errorName: error instanceof Error ? error.name : "unknown",
    errorMessage: error instanceof Error ? error.message : String(error),
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
    const chunk = references.slice(index, index + DELETE_BATCH_SIZE);
    for (const reference of chunk) batch.delete(reference);
    await batch.commit();
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ memoryMapId: string }> },
) {
  let stage = "initialising";
  const { memoryMapId } = await params;
  if (!MEMORY_MAP_ID_PATTERN.test(memoryMapId)) {
    return failureResponse(stage, 400, "invalid-campus", "A valid campus is required.");
  }

  stage = "verify token";
  const authorization = request.headers.get("authorization");
  const hasBearerPrefix = authorization?.startsWith("Bearer ") ?? false;
  const idToken = authorization && hasBearerPrefix ? authorization.slice("Bearer ".length).trim() : "";
  if (!authorization) {
    return failureResponse(stage, 401, "missing-authorization", "Your session is missing. Please sign in again.");
  }
  if (!hasBearerPrefix || !idToken || idToken.length > 4096) {
    return failureResponse(stage, 401, "unauthenticated", "Your session could not be verified. Please sign in again.");
  }

  let auth: Awaited<ReturnType<typeof getAdminServices>>["auth"];
  let firestore: Awaited<ReturnType<typeof getAdminServices>>["firestore"];
  try {
    ({ auth, firestore } = await getAdminServices());
  } catch (error) {
    const errorCode = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (errorCode === "project-mismatch") {
      return failureResponse(stage, 500, "auth-config-mismatch", "The server authentication configuration is incorrect.", error);
    }
    return failureResponse(stage, 503, "server-not-configured", "The server deletion service is not configured.", error);
  }

  let verifiedToken;
  try {
    verifiedToken = await auth.verifyIdToken(idToken);
  } catch (error) {
    console.error("Firebase token verification failed", {
      code: error && typeof error === "object" && "code" in error ? String(error.code) : "unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    return failureResponse(stage, 401, "unauthenticated", "Your sign-in session expired. Please sign in again.", error);
  }

  try {
    stage = "load campus";
    const mapRef = firestore.collection("memoryMaps").doc(memoryMapId);
    const mapSnapshot = await mapRef.get();
    if (!mapSnapshot.exists) {
      return failureResponse(stage, 404, "campus-not-found", "This campus no longer exists.", new Error("MemoryMap document does not exist."));
    }

    const mapData = mapSnapshot.data() ?? {};
    stage = "verify owner";
    if (mapData.ownerId !== verifiedToken.uid) {
      return failureResponse(stage, 403, "not-owner", "Only the campus owner can delete this campus.", new Error("Requester does not own this MemoryMap."));
    }

    stage = "load memories";
    const memorySnapshot = await mapRef.collection("memories").get();
    const uploadIds = [...new Set(memorySnapshot.docs
      .map((memory) => memory.data().imageUploadId)
      .filter((uploadId): uploadId is string => typeof uploadId === "string" && uploadId.length > 0))];
    const imageCleanup: ImageCleanup = { attempted: uploadIds.length, deleted: 0, missing: 0, failed: 0 };
    const failedImageUploadIds: string[] = [];

    stage = "delete CDN images";
    for (const uploadId of uploadIds) {
      try {
        const removed = await deleteFromHackClubCdn(uploadId);
        if (removed.ok) {
          imageCleanup.deleted += 1;
          continue;
        }

        failedImageUploadIds.push(uploadId);
        if (removed.error.status === 404) imageCleanup.missing += 1;
        else imageCleanup.failed += 1;
        const imageError = new Error("The remote image could not be removed.");
        imageError.name = removed.error.kind;
        logStageFailure(stage, imageError);
      } catch (error) {
        failedImageUploadIds.push(uploadId);
        imageCleanup.failed += 1;
        logStageFailure(stage, error);
      }
    }

    stage = "delete memories";
    await deleteReferences(firestore, memorySnapshot.docs.map((memory) => memory.ref));

    stage = "load floors";
    const floorSnapshots: QueryDocumentSnapshot[] = (await mapRef.collection("floors").get()).docs;

    stage = "delete rooms";
    const roomReferences: DocumentReference[] = [];
    for (const floor of floorSnapshots) {
      const rooms = await floor.ref.collection("rooms").get();
      for (const room of rooms.docs) roomReferences.push(room.ref);
    }
    await deleteReferences(firestore, roomReferences);

    stage = "delete corridors";
    const corridorReferences: DocumentReference[] = [];
    for (const floor of floorSnapshots) {
      const corridors = await floor.ref.collection("corridors").get();
      for (const corridor of corridors.docs) corridorReferences.push(corridor.ref);
    }
    await deleteReferences(firestore, corridorReferences);

    stage = "delete floors";
    await deleteReferences(firestore, floorSnapshots.map((floor) => floor.ref));

    stage = "load members";
    const memberSnapshots = (await mapRef.collection("members").get()).docs;
    const memberIds = new Set<string>();
    for (const member of memberSnapshots) {
      const userId = member.data().userId;
      const memberId = typeof userId === "string" && userId ? userId : member.id;
      if (memberId && memberId !== verifiedToken.uid) memberIds.add(memberId);
    }

    stage = "delete member indexes";
    const memberIndexReferences = [...memberIds].map((memberId) => firestore.collection("users").doc(memberId).collection("memoryMaps").doc(memoryMapId));
    await deleteReferences(firestore, memberIndexReferences);

    stage = "delete members";
    await deleteReferences(firestore, memberSnapshots.map((member) => member.ref));

    stage = "delete owner index";
    await deleteReferences(firestore, [firestore.collection("users").doc(verifiedToken.uid).collection("memoryMaps").doc(memoryMapId)]);

    stage = "delete invite code";
    const inviteCode = typeof mapData.inviteCode === "string" ? mapData.inviteCode.trim() : "";
    if (inviteCode) await firestore.collection("inviteCodes").doc(inviteCode).delete();

    stage = "delete campus";
    await mapRef.delete();

    const failedImageCleanupCount = failedImageUploadIds.length;
    return NextResponse.json({
      success: true,
      ok: true,
      deleted: true,
      imageCleanup,
      partialCleanup: failedImageCleanupCount > 0,
      warning: failedImageCleanupCount > 0 ? "Some remote image files could not be removed." : null,
    });
  } catch (error) {
    return cleanupFailure(stage, error);
  }
}
