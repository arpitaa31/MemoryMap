"use client";

import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { assertFirebaseConfig, auth, db } from "../lib/firebase/client";
import { reserveInviteCode } from "../lib/memorymaps/invite";

type CreateMemoryMapModalProps = {
  open: boolean;
  user: User;
  onClose: () => void;
};

export default function CreateMemoryMapModal({ open, user, onClose }: CreateMemoryMapModalProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    submittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submittingRef.current) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button, input, [href], select, textarea")).filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previous?.focus();
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      setError("Use a place name between 2 and 80 characters.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    let failedOperation = "Firebase configuration";
    try {
      assertFirebaseConfig();
      if (!auth?.currentUser) {
        const sessionError = new Error("Authentication is required.") as Error & { code?: string };
        sessionError.code = "unauthenticated";
        throw sessionError;
      }
      if (auth.currentUser.uid !== user.uid) {
        const identityError = new Error("The authenticated user changed.") as Error & { code?: string };
        identityError.code = "unauthenticated";
        throw identityError;
      }
      if (!db || db.app !== auth.app) throw new Error("Firestore is unavailable.");
      const isGuest = user.isAnonymous === true;
      if (isGuest) {
        const existingGuestIndex = await getDocs(collection(db, "users", user.uid, "memoryMaps"));
        const hasGuestCampus = existingGuestIndex.docs.some((entry) => {
          const data = entry.data() as Record<string, unknown>;
          return data.role === "owner" && data.status === "active";
        });
        if (hasGuestCampus) {
          throw Object.assign(new Error("Guest campus limit reached"), { code: "guest-campus-limit" });
        }
      }
      const inviteCode = isGuest ? null : await reserveInviteCode(db);
      const memoryMapId = doc(collection(db, "memoryMaps")).id;
      const floorId = doc(collection(db, "memoryMaps", memoryMapId, "floors")).id;
      const floorRef = doc(db, "memoryMaps", memoryMapId, "floors", floorId);
      const timestamp = serverTimestamp();
      const memoryMapData = {
        name: trimmedName,
        ownerId: auth.currentUser.uid,
        ownerName: isGuest ? null : auth.currentUser.displayName ?? null,
        ownerEmail: isGuest ? null : auth.currentUser.email ?? null,
        ownerType: isGuest ? "guest" : "registered",
        inviteCode,
        privacy: "private",
        status: "setup",
        roomCount: 0,
        memoryCount: 0,
        memberCount: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const memberData = {
        userId: user.uid,
        displayName: isGuest ? null : user.displayName || null,
        email: isGuest ? null : user.email || null,
        photoURL: isGuest ? null : user.photoURL || null,
        role: "owner",
        status: "active",
        accountType: isGuest ? "guest" : "registered",
        joinedAt: timestamp,
      };
      const ownerIndexData = {
        memoryMapId,
        role: "owner",
        status: "active",
        ownerId: user.uid,
        accountType: isGuest ? "guest" : "registered",
        joinedAt: timestamp,
      };
      const floorData = { name: "Ground Floor", order: 0, createdAt: timestamp, updatedAt: timestamp };
      if (db.app.options.projectId !== "memorymap-bab33") throw new Error("Unexpected Firebase project.");
      if (memoryMapData.ownerId !== user.uid || memberData.userId !== user.uid || memberData.role !== "owner" || memberData.status !== "active" || ownerIndexData.ownerId !== user.uid || ownerIndexData.role !== "owner" || ownerIndexData.status !== "active") throw new Error("Invalid MemoryMap ownership payload.");

      const stageName = (registeredStage: string, guestStage: string) => isGuest ? guestStage : registeredStage;

      failedOperation = stageName("MemoryMap write", "guest MemoryMap write");
      try {
        await setDoc(doc(db, "memoryMaps", memoryMapId), memoryMapData);
      } catch (error) {
        console.error("Map creation failed", error);
        console.error("PARENT_MEMORYMAP_WRITE_FAILED", { code: typeof error === "object" && error !== null && "code" in error ? error.code : "unknown", message: error instanceof Error ? error.message : "Unknown Firestore error" });
        throw Object.assign(new Error("Map creation failed"), { code: "map-creation-failed", cause: error });
      }

      failedOperation = stageName("Owner membership write", "guest owner membership write");
      try {
        await setDoc(doc(db, "memoryMaps", memoryMapId, "members", user.uid), memberData);
      } catch (error) {
        console.error("Owner membership creation failed", error);
        await deleteDoc(doc(db, "memoryMaps", memoryMapId)).catch(() => undefined);
        throw Object.assign(new Error("Owner membership creation failed"), { code: "owner-membership-failed", cause: error });
      }

      failedOperation = stageName("Initial floor write", "guest initial floor write");
      try {
        await setDoc(floorRef, floorData);
      } catch (error) {
        console.error("Ground Floor creation failed", error);
        await deleteDoc(doc(db, "memoryMaps", memoryMapId, "members", user.uid)).catch(() => undefined);
        await deleteDoc(doc(db, "memoryMaps", memoryMapId)).catch(() => undefined);
        throw Object.assign(new Error("Ground Floor creation failed"), { code: "ground-floor-failed", cause: error });
      }

      failedOperation = stageName("Owner membership index write", "guest dashboard-index write");
      try {
        await setDoc(doc(db, "users", user.uid, "memoryMaps", memoryMapId), ownerIndexData);
      } catch (error) {
        console.error("Owner membership index creation failed", error);
        await deleteDoc(doc(db, "memoryMaps", memoryMapId, "floors", floorId)).catch(() => undefined);
        await deleteDoc(doc(db, "memoryMaps", memoryMapId, "members", user.uid)).catch(() => undefined);
        await deleteDoc(doc(db, "memoryMaps", memoryMapId)).catch(() => undefined);
        throw Object.assign(new Error("Owner membership index creation failed"), { code: "owner-index-failed", cause: error });
      }

      if (!isGuest && inviteCode) {
        await setDoc(doc(db, "memoryMaps", memoryMapId), { inviteCode, updatedAt: serverTimestamp() }, { merge: true });
        await setDoc(doc(db, "inviteCodes", inviteCode), { memoryMapId, active: true, createdBy: user.uid, ownerId: user.uid, mapName: trimmedName, ownerName: user.displayName ?? null, createdAt: timestamp });
      }
      router.push(`/memorymaps/${memoryMapId}/setup`);
    } catch (error) {
      console.error("MemoryMap creation failed:", error);
      const errorCode = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "unknown";
      const errorMessage = error instanceof Error ? error.message : "Unknown Firestore error";
      console.error("Failed operation:", failedOperation, errorCode, errorMessage);
      const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "";
      const safeStageError = code === "permission-denied"
        ? `${failedOperation} was denied. Please try again.`
        : code === "map-creation-failed"
          ? `${failedOperation} failed. Please try again.`
          : code === "owner-membership-failed"
            ? `${failedOperation} failed. Please try again.`
            : code === "owner-index-failed"
              ? `${failedOperation} failed. Please try again.`
              : code === "ground-floor-failed"
                ? `${failedOperation} failed. Please try again.`
                : null;
      setError(code === "guest-campus-limit"
        ? "Guest mode allows one campus. Continue with Google to create more."
        : safeStageError
          || (code === "unauthenticated"
            ? "Your sign-in session expired. Please sign in again."
            : code === "unavailable"
              ? "The database is temporarily unavailable. Please try again."
              : "We could not create your MemoryMap. Please try again."));
      setIsSubmitting(false);
    }
  };

  return createPortal((
    <div className="mm-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) onClose(); }}>
      <div ref={dialogRef} className="mm-create-modal" role="dialog" aria-modal="true" aria-labelledby="create-map-modal-title" aria-describedby="create-map-modal-description">
        <p className="mm-eyebrow mm-eyebrow--ochre">Create a new MemoryMap</p>
        <h2 id="create-map-modal-title">What place are we remembering?</h2>
        <p id="create-map-modal-description">Give this private campus a name. You can change it later.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="memorymap-name">Campus or place name</label>
          <input ref={inputRef} id="memorymap-name" name="name" value={name} onChange={(event) => setName(event.target.value.slice(0, 80))} placeholder="ABC School" maxLength={80} autoComplete="off" />
          <small>School, college, coaching centre, office, neighbourhood or another shared place.</small>
          {error && <p className="mm-auth-message mm-auth-message--error" role="alert">{error}</p>}
          <div className="mm-create-modal__actions">
            <button type="button" className="mm-button mm-button--outline" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="mm-button mm-button--coral" disabled={isSubmitting}>{isSubmitting ? "Creatingâ€¦" : "Start building"}</button>
          </div>
        </form>
      </div>
    </div>
  ), document.body);
}
