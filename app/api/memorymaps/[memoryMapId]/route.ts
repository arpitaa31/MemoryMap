import { NextResponse } from "next/server";
import { deleteFromHackClubCdn } from "../../../../lib/uploads/server";
import { getAdminServices } from "../../../../lib/firebase/admin";

export const runtime = "nodejs";

const MEMORY_MAP_ID_PATTERN = /^[^/\\]{1,150}$/;

type ImageCleanup = { attempted: number; deleted: number; missing: number; failed: number };

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token && token.length <= 4096 ? token : null;
}

function safeError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, error: message, code }, { status });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ memoryMapId: string }> },
) {
  const { memoryMapId } = await params;
  if (!MEMORY_MAP_ID_PATTERN.test(memoryMapId)) return safeError("A valid campus is required.", 400, "invalid-campus");

  const idToken = getBearerToken(request);
  if (!idToken) return safeError("Your sign-in session is required.", 401, "unauthenticated");

  let auth;
  let firestore;
  try {
    ({ auth, firestore } = getAdminServices());
  } catch (error) {
    console.error("Campus deletion authentication is unavailable", error instanceof Error ? error.message : "configuration error");
    return safeError("Campus deletion is temporarily unavailable.", 503, "service-unavailable");
  }

  let verifiedToken;
  try {
    verifiedToken = await auth.verifyIdToken(idToken);
  } catch {
    return safeError("Your sign-in session is no longer valid.", 401, "unauthenticated");
  }

  try {
    const mapRef = firestore.collection("memoryMaps").doc(memoryMapId);
    const mapSnapshot = await mapRef.get();
    if (!mapSnapshot.exists) return safeError("This campus no longer exists.", 404, "campus-not-found");

    const mapData = mapSnapshot.data() ?? {};
    if (mapData.ownerId !== verifiedToken.uid) return safeError("Only the campus owner can delete this campus.", 403, "not-owner");

    const [memberSnapshot, memorySnapshot] = await Promise.all([
      mapRef.collection("members").get(),
      mapRef.collection("memories").get(),
    ]);
    const memberIds = new Set<string>([verifiedToken.uid]);
    memberSnapshot.docs.forEach((member) => {
      const userId = member.data().userId;
      memberIds.add(typeof userId === "string" && userId ? userId : member.id);
    });

    const uploadIds = [...new Set(memorySnapshot.docs
      .map((memory) => memory.data().imageUploadId)
      .filter((uploadId): uploadId is string => typeof uploadId === "string" && uploadId.length > 0))];
    const imageCleanup: ImageCleanup = { attempted: uploadIds.length, deleted: 0, missing: 0, failed: 0 };
    for (const uploadId of uploadIds) {
      const removed = await deleteFromHackClubCdn(uploadId);
      if (removed.ok) {
        imageCleanup.deleted += 1;
      } else if (removed.error.status === 404) {
        imageCleanup.missing += 1;
      } else {
        imageCleanup.failed += 1;
        console.error("Campus image cleanup failed", { memoryMapId, uploadId, kind: removed.error.kind, status: removed.error.status });
      }
    }

    await firestore.recursiveDelete(mapRef);

    const indexDeletes = [...memberIds].map((userId) => firestore.collection("users").doc(userId).collection("memoryMaps").doc(memoryMapId).delete());
    await Promise.all(indexDeletes);

    const inviteCode = typeof mapData.inviteCode === "string" ? mapData.inviteCode : "";
    if (inviteCode) await firestore.collection("inviteCodes").doc(inviteCode).delete();

    return NextResponse.json({ ok: true, deleted: true, imageCleanup });
  } catch (error) {
    console.error("Campus Firestore cleanup failed", { memoryMapId, message: error instanceof Error ? error.message : "unknown error" });
    return safeError("The campus could not be fully deleted. Please try again.", 500, "cleanup-failed");
  }
}
