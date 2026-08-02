"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../app/providers/AuthProvider";

type DeleteCampusModalProps = {
  campusId: string;
  campusName: string;
  onClose: () => void;
  onDeleted: (imageCleanup: { failed: number; missing: number }) => void;
};

function getErrorMessage(status: number, code: string) {
  if (status === 401 || code === "unauthenticated") return "Your sign-in session expired. Please sign in again.";
  if (status === 403 || code === "not-owner") return "Only the campus owner can delete this campus.";
  if (status === 404 || code === "campus-not-found") return "This campus no longer exists.";
  if (code === "service-unavailable") return "Campus deletion is temporarily unavailable. Please try again.";
  return "We could not delete this campus. Please try again.";
}

export default function DeleteCampusModal({ campusId, campusName, onClose, onDeleted }: DeleteCampusModalProps) {
  const { user } = useAuth();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typedName, setTypedName] = useState("");
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isDeleting) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button, input, [href], select, textarea")).filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus();
    };
  }, [isDeleting, onClose]);

  const canDelete = typedName === campusName && !isDeleting;

  const deleteCampus = async () => {
    if (!canDelete || !user) return;
    setError("");
    setIsDeleting(true);
    try {
      const idToken = await user.getIdToken(true);
      const response = await fetch(`/api/memorymaps/${encodeURIComponent(campusId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const result = await response.json().catch(() => ({})) as { code?: string; error?: string; imageCleanup?: { failed?: number; missing?: number } };
      if (!response.ok || result.code === "cleanup-failed") {
        setError(getErrorMessage(response.status, typeof result.code === "string" ? result.code : ""));
        setIsDeleting(false);
        return;
      }
      onDeleted({ failed: result.imageCleanup?.failed ?? 0, missing: result.imageCleanup?.missing ?? 0 });
      onClose();
    } catch {
      setError("We could not connect to the campus deletion service. Please try again.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="mm-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isDeleting) onClose(); }}>
      <div ref={dialogRef} className="mm-create-modal mm-delete-campus-modal" role="dialog" aria-modal="true" aria-labelledby="delete-campus-title" aria-describedby="delete-campus-description">
        <p className="mm-eyebrow mm-eyebrow--ochre">DELETE CAMPUS</p>
        <h2 id="delete-campus-title">Delete “{campusName}”?</h2>
        <p id="delete-campus-description">This will permanently remove the campus layout, rooms, corridors, members and memories connected to it. This action cannot be undone.</p>
        <label htmlFor="delete-campus-name">Type the campus name to continue</label>
        <input ref={inputRef} id="delete-campus-name" value={typedName} onChange={(event) => setTypedName(event.target.value)} autoComplete="off" disabled={isDeleting} />
        {error && <p className="mm-auth-message mm-auth-message--error" role="alert">{error}</p>}
        <div className="mm-create-modal__actions">
          <button type="button" className="mm-button mm-button--outline" onClick={onClose} disabled={isDeleting}>Cancel</button>
          <button type="button" className="mm-button mm-delete-campus-modal__danger" onClick={() => void deleteCampus()} disabled={!canDelete}>{isDeleting ? "Deleting…" : "Delete permanently"}</button>
        </div>
      </div>
    </div>
  );
}
