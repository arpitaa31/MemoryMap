"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../app/providers/AuthProvider";

type DeleteCampusModalProps = {
  campusId: string;
  campusName: string;
  onClose: () => void;
  onDeleted: (imageCleanup: { failed: number; missing: number; code?: string }) => void;
};

function getErrorMessage(status: number, code: string) {
  if (status === 401 || code === "unauthenticated") return "Your sign-in session expired. Please sign in again.";
  if (status === 403 || code === "not-owner") return "Only the campus owner can delete this campus.";
  if (status === 404 || code === "campus-not-found") return "This campus no longer exists.";
  if (code === "server-not-configured" || code === "service-unavailable") return "The server deletion service is not configured.";
  if (code === "image-cleanup-failed") return "Some uploaded images could not be removed.";
  if (code === "cleanup-failed") return "The campus data could not be removed.";
  return "The campus data could not be removed.";
}

export default function DeleteCampusModal({ campusId, campusName, onClose, onDeleted }: DeleteCampusModalProps) {
  const { user } = useAuth();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const deleteInFlightRef = useRef(false);
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const isDeletingRef = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isDeletingRef.current) {
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
  }, [onClose]);

  const deleteCampus = async () => {
    if (deleteInFlightRef.current || !user) return;
    deleteInFlightRef.current = true;
    isDeletingRef.current = true;
    setError("");
    setIsDeleting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/memorymaps/${encodeURIComponent(campusId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const result = await response.json().catch(() => ({})) as { deleted?: boolean; error?: { code?: string; message?: string; stage?: string }; imageCleanup?: { failed?: number; missing?: number } };
      const errorCode = typeof result.error?.code === "string" ? result.error.code : "";
      if (!response.ok && result.deleted !== true) {
        setError(getErrorMessage(response.status, errorCode));
        deleteInFlightRef.current = false;
        isDeletingRef.current = false;
        setIsDeleting(false);
        return;
      }
      onDeleted({ failed: result.imageCleanup?.failed ?? 0, missing: result.imageCleanup?.missing ?? 0, code: errorCode || undefined });
      onClose();
    } catch {
      setError("We could not connect to the campus deletion service. Please try again.");
      deleteInFlightRef.current = false;
      isDeletingRef.current = false;
      setIsDeleting(false);
    }
  };

  return (
    <div className="mm-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isDeleting) onClose(); }}>
      <div ref={dialogRef} className="mm-create-modal mm-delete-campus-modal" role="dialog" aria-modal="true" aria-labelledby="delete-campus-title" aria-describedby="delete-campus-description">
        <p className="mm-eyebrow mm-eyebrow--ochre">DELETE CAMPUS</p>
        <h2 id="delete-campus-title">Delete “{campusName}”?</h2>
        <p id="delete-campus-description">This will permanently remove the campus layout, rooms, corridors, members and memories connected to it. This action cannot be undone.</p>
        {error && <p className="mm-auth-message mm-auth-message--error" role="alert">{error}</p>}
        <div className="mm-create-modal__actions">
          <button ref={cancelButtonRef} type="button" className="mm-button mm-button--outline" onClick={onClose} disabled={isDeleting}>Cancel</button>
          <button type="button" className="mm-button mm-delete-campus-modal__danger" onClick={() => void deleteCampus()} disabled={isDeleting}>{isDeleting ? "Deleting…" : "Delete permanently"}</button>
        </div>
      </div>
    </div>
  );
}
