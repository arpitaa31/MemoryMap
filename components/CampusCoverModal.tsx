"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { deleteCampusCover, updateCampusCoverPosition, uploadCampusCover, type CampusCoverImage } from "../lib/uploads/client";
import type { CoverImagePosition } from "../types/memory-map";

type CampusCoverTarget = {
  id: string;
  name: string;
  ownerType?: "guest" | "registered";
  coverImageUrl: string | null;
  coverImageStorageId: string | null;
  coverImagePosition: CoverImagePosition;
};

type CampusCoverModalProps = {
  campus: CampusCoverTarget;
  isGuest?: boolean;
  onClose: () => void;
  onSaved: (cover: CampusCoverImage | null) => void;
  onSignIn?: () => void;
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

function validateFile(file: File | null) {
  if (!file) return "Please choose a cover photo.";
  if (!ACCEPTED_TYPES.includes(file.type.toLowerCase())) return "Please choose a JPEG, PNG or WebP image.";
  if (file.size > MAX_BYTES) return "Image size must be under 5 MB.";
  return "";
}

export default function CampusCoverModal({ campus, isGuest = false, onClose, onSaved, onSignIn }: CampusCoverModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [position, setPosition] = useState<CoverImagePosition>(campus.coverImagePosition || "center");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [existingImageBroken, setExistingImageBroken] = useState(false);
  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : campus.coverImageUrl, [campus.coverImageUrl, file]);

  useEffect(() => {
    return () => { if (file && previewUrl && previewUrl !== campus.coverImageUrl) URL.revokeObjectURL(previewUrl); };
  }, [campus.coverImageUrl, file, previewUrl]);

  useEffect(() => {
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button, input, [href], select, textarea")].filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  const chooseFile = (nextFile: File | null) => {
    setError(validateFile(nextFile));
    setExistingImageBroken(false);
    setFile(nextFile);
  };

  const save = async () => {
    if (isGuest) { onSignIn?.(); return; }
    if (!file && !campus.coverImageUrl) { setError("Please choose a cover photo."); return; }
    if (file) {
      const validation = validateFile(file);
      if (validation) { setError(validation); return; }
    }
    setSaving(true);
    setError("");
    try {
      const cover = file
        ? await uploadCampusCover(file, campus.id, position)
        : await updateCampusCoverPosition(campus.id, position, campus.coverImageUrl || "", campus.coverImageStorageId || "");
      onSaved(cover);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "We couldn’t save the cover photo. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (isGuest || !campus.coverImageUrl || !window.confirm("Remove this campus cover photo?")) return;
    setSaving(true);
    setError("");
    try {
      await deleteCampusCover(campus.id);
      onSaved(null);
      onClose();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "We couldn’t remove the cover photo. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="mm-cover-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <div ref={dialogRef} className="mm-cover-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="campus-cover-title" aria-describedby="campus-cover-description" tabIndex={-1}>
      <div className="mm-cover-modal__header"><div><p className="mm-eyebrow mm-eyebrow--ochre">Personalise {campus.name}</p><h2 id="campus-cover-title">Campus cover photo</h2></div><button type="button" className="mm-cover-modal__close" onClick={onClose} disabled={saving} aria-label="Close cover photo dialog">×</button></div>
      <p id="campus-cover-description" className="mm-cover-modal__supporting">Add a photo that reminds you of this place.</p>
      {isGuest ? <div className="mm-cover-modal__guest"><p role="alert">Sign in with Google to add a campus cover photo.</p><button type="button" className="mm-button mm-button--coral" onClick={onSignIn}>Sign in with Google</button><button type="button" className="mm-button mm-button--outline" onClick={onClose}>Cancel</button></div> : <>
        <button type="button" className={`mm-cover-dropzone${dragging ? " is-dragging" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0] ?? null); }} aria-label="Choose a JPEG, PNG or WebP campus cover photo">
          {previewUrl && !existingImageBroken ? <img src={previewUrl} alt={`Preview of ${campus.name} cover photo`} sizes="(max-width: 700px) 100vw, 560px" style={{ objectPosition: position }} onError={() => setExistingImageBroken(true)} /> : <span className="mm-cover-dropzone__empty"><strong>{file ? "Preview unavailable" : "Drop a photo here"}</strong><small>or click to browse</small></span>}
          <span className="mm-cover-dropzone__hint">JPEG, PNG or WebP · Maximum 5 MB</span>
        </button>
        <input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} aria-label="Select campus cover photo" />
        {(file || campus.coverImageUrl) && <button type="button" className="mm-cover-modal__replace" onClick={() => inputRef.current?.click()} disabled={saving}>{file ? "Replace selected photo" : "Replace photo"}</button>}
        <fieldset className="mm-cover-position"><legend>Photo position</legend><div>{(["top", "center", "bottom"] as CoverImagePosition[]).map((value) => <button type="button" key={value} className={position === value ? "is-selected" : ""} aria-pressed={position === value} onClick={() => setPosition(value)} disabled={saving}>{value}</button>)}</div></fieldset>
        {error && <p className="mm-cover-modal__error" role="alert">{error}</p>}
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{saving ? "Saving cover photo..." : ""}</p>
        <div className="mm-cover-modal__actions">{campus.coverImageUrl && <button type="button" className="mm-button mm-button--danger-quiet" onClick={() => void remove()} disabled={saving}>{saving ? "Saving…" : "Remove photo"}</button>}<span /><button type="button" className="mm-button mm-button--outline" onClick={onClose} disabled={saving}>Cancel</button><button type="button" className="mm-button mm-button--coral" onClick={() => void save()} disabled={saving || (!file && !campus.coverImageUrl)}>{saving ? "Saving cover photo…" : campus.coverImageUrl && !file ? "Save position" : "Save cover photo"}</button></div>
      </>}
    </div>
  </div>;
}
