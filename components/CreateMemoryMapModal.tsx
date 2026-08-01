"use client";

import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
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
      failedOperation = "invite code lookup";
      const inviteCode = await reserveInviteCode(db);
      const mapRef = doc(collection(db, "memoryMaps"));
      const floorRef = doc(collection(mapRef, "floors"));
      const timestamp = serverTimestamp();
      const batch = writeBatch(db);

      batch.set(mapRef, {
        name: trimmedName,
        ownerId: user.uid,
        ownerName: user.displayName || null,
        ownerEmail: user.email || null,
        privacy: "private",
        status: "setup",
        inviteCode,
        roomCount: 0,
        memoryCount: 0,
        memberCount: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      batch.set(doc(mapRef, "members", user.uid), {
        userId: user.uid,
        displayName: user.displayName || null,
        email: user.email || null,
        photoURL: user.photoURL || null,
        role: "owner",
        status: "active",
        joinedAt: timestamp,
      });
      batch.set(floorRef, { name: "Ground Floor", order: 0, createdAt: timestamp, updatedAt: timestamp });
      batch.set(doc(db, "inviteCodes", inviteCode), { memoryMapId: mapRef.id, active: true, createdBy: user.uid, ownerId: user.uid, mapName: name, ownerName: user.displayName ?? null, createdAt: timestamp });
      failedOperation = "writeBatch.commit (MemoryMap, owner membership, Ground Floor, invite code)";
      await batch.commit();
      router.push(`/memorymaps/${mapRef.id}/setup`);
    } catch (error) {
      console.error("MemoryMap creation failed:", error);
      console.error("MemoryMap creation operation:", failedOperation);
      const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "";
      setError(code === "permission-denied" ? "The database denied this request. Please check the Firestore rules." : code === "unauthenticated" ? "Your sign-in session expired. Please sign in again." : code === "unavailable" ? "The database is temporarily unavailable. Please try again." : "We could not create your MemoryMap. Please try again.");
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
