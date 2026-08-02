"use client";

import { doc, getDoc, increment, serverTimestamp, writeBatch } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../app/providers/AuthProvider";
import { assertFirebaseConfig, db } from "../../../lib/firebase/client";

type InviteData = { memoryMapId: string; ownerId: string; mapName: string; ownerName: string | null; active: boolean };

export default function JoinMemoryMapClient({ inviteCode }: { inviteCode: string }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "invalid" | "error" | "joining">("loading");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace(`/login?next=/join/${inviteCode}`); return; }
    if (user.isAnonymous) return;
    const load = async () => {
      try { assertFirebaseConfig(); if (!db) throw new Error("Firestore unavailable"); const snapshot = await getDoc(doc(db, "inviteCodes", inviteCode)); const data = snapshot.data(); if (!snapshot.exists() || !data || data.active !== true || typeof data.memoryMapId !== "string") { setState("invalid"); return; } const memoryMapId = data.memoryMapId; const ownerId = typeof data.ownerId === "string" ? data.ownerId : ""; if (ownerId === user.uid) { router.replace(`/memorymaps/${memoryMapId}`); return; } const membership = await getDoc(doc(db, "memoryMaps", memoryMapId, "members", user.uid)); if (membership.exists() && membership.data().status === "active") { router.replace(`/memorymaps/${memoryMapId}`); return; } setInvite({ memoryMapId, ownerId, mapName: typeof data.mapName === "string" ? data.mapName : "Private MemoryMap", ownerName: typeof data.ownerName === "string" ? data.ownerName : null, active: true }); setState("ready"); } catch { setState("error"); }
    };
    void load();
  }, [authLoading, inviteCode, router, user]);
  const join = async () => {
    if (!db || !user || !invite) return;
    if (invite.ownerId === user.uid) { router.push(`/memorymaps/${invite.memoryMapId}`); return; }
    setState("joining");
    try { const batch = writeBatch(db); batch.set(doc(db, "memoryMaps", invite.memoryMapId, "members", user.uid), { userId: user.uid, displayName: user.displayName ?? null, email: user.email ?? null, photoURL: user.photoURL ?? null, role: "member", status: "active", joinedAt: serverTimestamp(), inviteCode }, { merge: true }); batch.set(doc(db, "users", user.uid, "memoryMaps", invite.memoryMapId), { memoryMapId: invite.memoryMapId, role: "member", status: "active", ownerId: invite.ownerId, joinedAt: serverTimestamp() }, { merge: true }); batch.update(doc(db, "memoryMaps", invite.memoryMapId), { memberCount: increment(1), updatedAt: serverTimestamp() }); await batch.commit(); router.push(`/memorymaps/${invite.memoryMapId}`); } catch { setMessage("We could not join this MemoryMap. Please try again."); setState("ready"); }
  };
  if (authLoading || state === "loading" || state === "joining") return <main className="mm-state-page"><p role="status" aria-live="polite">{state === "joining" ? "Joining your MemoryMap…" : "Checking this invite…"}</p></main>;
  if (user?.isAnonymous) return <main className="mm-state-page"><h1>Guest sessions stay private</h1><p>Continue with Google to join shared campuses.</p><Link href="/dashboard" className="mm-button mm-button--coral">Back to dashboard</Link></main>;
  if (state === "invalid" || state === "error" || !invite) return <main className="mm-state-page"><h1>Invite link unavailable</h1><p>{message || (state === "error" ? "We could not check this invite. Try again later." : "This invite link is no longer valid.")}</p><Link href="/dashboard" className="mm-button mm-button--coral">Back to dashboard</Link></main>;
  return <main className="mm-state-page mm-join-page"><p className="mm-eyebrow mm-eyebrow--ochre">Private invitation</p><h1>Join {invite.mapName}</h1><p>{invite.ownerName ? `${invite.ownerName} invited you to this private campus.` : "You have been invited to a private MemoryMap."}</p>{message && <p className="mm-auth-message mm-auth-message--error" role="alert">{message}</p>}<button type="button" className="mm-button mm-button--coral" onClick={() => void join()}>Join MemoryMap</button><Link href="/dashboard" className="mm-button mm-button--outline">Back to dashboard</Link></main>;
}
