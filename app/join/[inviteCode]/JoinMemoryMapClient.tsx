"use client";

import { doc, getDoc, increment, serverTimestamp, writeBatch } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../app/providers/AuthProvider";
import { assertFirebaseConfig, db } from "../../../lib/firebase/client";
import { linkCurrentUserToGoogle } from "../../../lib/auth/google";
import type { CoverImagePosition } from "../../../types/memory-map";

type InviteData = {
  memoryMapId: string;
  ownerId: string;
  mapName: string;
  ownerName: string | null;
  coverImageUrl: string | null;
  coverImagePosition: CoverImagePosition;
};

type InviteErrorKind = "invalid" | "inactive" | "permission" | "network";
type InviteError = { kind: InviteErrorKind; message: string };

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "unknown";
}

function inviteErrorFor(error: unknown): InviteError {
  const code = errorCode(error);
  if (code === "permission-denied") {
    return { kind: "permission", message: "You do not have permission to access this invite." };
  }
  if (["unavailable", "deadline-exceeded", "network-request-failed", "failed-precondition"].includes(code)) {
    return { kind: "network", message: "We could not check the invite. Please try again." };
  }
  return { kind: "network", message: "We could not check the invite. Please try again." };
}

function StatePage({ children }: { children: React.ReactNode }) {
  return <main className="mm-state-page mm-join-state"><div className="mm-join-state__card">{children}</div></main>;
}

export default function JoinMemoryMapClient({ inviteCode }: { inviteCode: string }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [inviteLoading, setInviteLoading] = useState(true);
  const [inviteError, setInviteError] = useState<InviteError | null>(null);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [joining, setJoining] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [inviteImageFailed, setInviteImageFailed] = useState(false);
  const nextPath = `/join/${inviteCode}`;

  useEffect(() => {
    let cancelled = false;

    if (authLoading) return () => { cancelled = true; };

    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
      return () => { cancelled = true; };
    }

    if (user.isAnonymous) {
      return () => { cancelled = true; };
    }

    const loadInvite = async () => {
      setInviteLoading(true);
      setInviteError(null);
      setInviteData(null);

      try {
        assertFirebaseConfig();
        if (!db) throw new Error("Firestore unavailable");

        // This runs only after AuthProvider reports a resolved, signed-in user.
        const inviteSnap = await getDoc(doc(db, "inviteCodes", inviteCode));
        if (cancelled) return;
        if (!inviteSnap.exists()) {
          setInviteError({ kind: "invalid", message: "This invite link is invalid or has expired." });
          return;
        }

        const data = inviteSnap.data();
        if (data.active !== true) {
          setInviteError({ kind: "inactive", message: "This invite link is no longer active." });
          return;
        }
        if (typeof data.memoryMapId !== "string") {
          setInviteError({ kind: "invalid", message: "This invite link is invalid or has expired." });
          return;
        }

        const memoryMapId = data.memoryMapId;
        const ownerId = typeof data.ownerId === "string" ? data.ownerId : "";
        if (ownerId === user.uid) {
          router.replace(`/memorymaps/${memoryMapId}`);
          return;
        }

        const membership = await getDoc(doc(db, "memoryMaps", memoryMapId, "members", user.uid));
        if (cancelled) return;
        if (membership.exists() && membership.data().status === "active") {
          router.replace(`/memorymaps/${memoryMapId}`);
          return;
        }

        setInviteData({
          memoryMapId,
          ownerId,
          mapName: typeof data.mapName === "string" ? data.mapName : "Private MemoryMap",
          ownerName: typeof data.ownerName === "string" ? data.ownerName : null,
          coverImageUrl: typeof data.coverImageUrl === "string" ? data.coverImageUrl : null,
          coverImagePosition: data.coverImagePosition === "top" || data.coverImagePosition === "bottom" ? data.coverImagePosition : "center",
        });
      } catch (error) {
        if (cancelled) return;
        const code = errorCode(error);
        console.error("Invite lookup failed", {
          code,
          message: error instanceof Error ? error.message : String(error),
          signedIn: Boolean(user),
          authLoading,
          hasInviteCode: Boolean(inviteCode),
        });
        setInviteError(inviteErrorFor(error));
      } finally {
        if (!cancelled) setInviteLoading(false);
      }
    };

    void loadInvite();
    return () => { cancelled = true; };
  }, [authLoading, inviteCode, nextPath, router, user]);

  const continueWithGoogle = async () => {
    if (!user?.isAnonymous) return;
    setActionError("");
    setUpgrading(true);
    try {
      await linkCurrentUserToGoogle(user);
      router.replace(nextPath);
    } catch (error) {
      const code = errorCode(error);
      setActionError(code === "auth/credential-already-in-use" || code === "auth/email-already-in-use"
        ? "That Google account already has a MemoryMap. Sign in with that account to continue."
        : code === "auth/popup-closed-by-user"
          ? "Google sign-in was cancelled."
          : code === "auth/popup-blocked"
            ? "Allow pop-ups in your browser to continue with Google."
            : "We could not continue with Google. Please try again.");
    } finally {
      setUpgrading(false);
    }
  };

  const join = async () => {
    if (!db || !user || !inviteData || user.isAnonymous) return;
    setActionError("");
    setJoining(true);
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "memoryMaps", inviteData.memoryMapId, "members", user.uid), {
        userId: user.uid,
        displayName: user.displayName ?? null,
        email: user.email ?? null,
        photoURL: user.photoURL ?? null,
        role: "member",
        status: "active",
        joinedAt: serverTimestamp(),
        inviteCode,
      }, { merge: true });
      batch.set(doc(db, "users", user.uid, "memoryMaps", inviteData.memoryMapId), {
        memoryMapId: inviteData.memoryMapId,
        role: "member",
        status: "active",
        ownerId: inviteData.ownerId,
        joinedAt: serverTimestamp(),
      }, { merge: true });
      batch.update(doc(db, "memoryMaps", inviteData.memoryMapId), {
        memberCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      router.push(`/memorymaps/${inviteData.memoryMapId}`);
    } catch (error) {
      console.error("Invite join failed", {
        code: errorCode(error),
        message: error instanceof Error ? error.message : String(error),
        signedIn: Boolean(user),
        authLoading,
        hasInviteCode: Boolean(inviteCode),
      });
      setActionError("We could not join this MemoryMap. Please try again.");
      setJoining(false);
    }
  };

  if (authLoading) {
    return <StatePage><p role="status" aria-live="polite">Checking your sign-in...</p></StatePage>;
  }

  if (!user) {
    return <StatePage><p role="status" aria-live="polite">Taking you to sign in...</p></StatePage>;
  }

  if (user.isAnonymous) {
    return <StatePage>
      <p className="mm-eyebrow mm-eyebrow--ochre">Private invitation</p>
      <h1>This private campus requires Google sign-in.</h1>
      <p>Continue with Google to check this invite and join the shared campus.</p>
      {actionError && <p className="mm-auth-message mm-auth-message--error" role="alert">{actionError}</p>}
      <button type="button" className="mm-button mm-button--coral" onClick={() => void continueWithGoogle()} disabled={upgrading}>
        {upgrading ? "Connecting..." : "Continue with Google"}
      </button>
      <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="mm-button mm-button--outline">Use Google sign-in</Link>
    </StatePage>;
  }

  if (inviteLoading) {
    return <StatePage><p role="status" aria-live="polite">Checking invite...</p></StatePage>;
  }

  if (inviteError) {
    return <StatePage>
      <p className="mm-eyebrow mm-eyebrow--ochre">Private invitation</p>
      <h1>{inviteError.kind === "inactive" ? "Invite expired" : inviteError.kind === "permission" ? "Invite access denied" : "Invite unavailable"}</h1>
      <p role="alert">{inviteError.message}</p>
      <Link href="/dashboard" className="mm-button mm-button--coral">Back to dashboard</Link>
    </StatePage>;
  }

  if (!inviteData || joining) {
    return <StatePage><p role="status" aria-live="polite">{joining ? "Joining your MemoryMap..." : "Checking invite..."}</p></StatePage>;
  }

  return <StatePage>
    <p className="mm-eyebrow mm-eyebrow--ochre">Private invitation</p>
    {inviteData.coverImageUrl && !inviteImageFailed && <div className="mm-join-cover"><img src={inviteData.coverImageUrl} alt={`${inviteData.mapName} campus cover`} width="1200" height="525" style={{ objectPosition: inviteData.coverImagePosition }} onError={() => setInviteImageFailed(true)} /></div>}
    <h1>Join {inviteData.mapName}</h1>
    <p>{inviteData.ownerName ? `${inviteData.ownerName} invited you to this private campus.` : "You have been invited to a private MemoryMap."}</p>
    {actionError && <p className="mm-auth-message mm-auth-message--error" role="alert">{actionError}</p>}
    <button type="button" className="mm-button mm-button--coral" onClick={() => void join()}>Join MemoryMap</button>
    <Link href="/dashboard" className="mm-button mm-button--outline">Back to dashboard</Link>
  </StatePage>;
}
