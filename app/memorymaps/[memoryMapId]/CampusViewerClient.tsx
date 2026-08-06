"use client";

import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, onSnapshot, orderBy, query, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MemoryMapLogo from "../../../app/components/MemoryMapLogo";
import MemoryMapWordmark from "../../../app/components/MemoryMapWordmark";
import { useAuth } from "../../../app/providers/AuthProvider";
import { assertFirebaseConfig, db } from "../../../lib/firebase/client";
import { parseCorridor, parseFloor, parseMemory, parseMemoryMap, parseRoom } from "../../../lib/memorymaps/data";
import { deleteMemoryImage, uploadMemoryImage } from "../../../lib/uploads/client";
import { reserveInviteCode } from "../../../lib/memorymaps/invite";
import UpgradeModal from "../../../components/UpgradeModal";
import type { MemoryDocument, MemoryMapDocument, MemoryMapFloor, MemoryMapRoom, MemoryMapCorridor } from "../../../types/memory-map";

type FloorData = { floor: MemoryMapFloor; rooms: MemoryMapRoom[]; corridors: MemoryMapCorridor[] };

export default function CampusViewerClient({ memoryMapId }: { memoryMapId: string }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [map, setMap] = useState<MemoryMapDocument | null>(null);
  const [floors, setFloors] = useState<FloorData[]>([]);
  const [floorId, setFloorId] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [memories, setMemories] = useState<MemoryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [incidentCount, setIncidentCount] = useState(0);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const imagePreview = useMemo(() => imageFile ? URL.createObjectURL(imageFile) : null, [imageFile]);

  useEffect(() => {
    return () => { if (imagePreview) URL.revokeObjectURL(imagePreview); };
  }, [imagePreview]);

  useEffect(() => {
    if (!user?.isAnonymous || !imageOpen) return;
    // This closes a restricted modal immediately when an anonymous session attempts to open it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImageOpen(false);
    setImageFile(null);
    setImageError("");
    setUpgradeOpen(true);
  }, [imageOpen, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace(`/login?next=/memorymaps/${memoryMapId}`); return; }
    let cancelled = false;
    const load = async () => {
      try {
        assertFirebaseConfig();
        if (!db) throw new Error("Firestore unavailable");
        const firestore = db;
        const mapSnapshot = await getDoc(doc(firestore, "memoryMaps", memoryMapId));
        const nextMap = parseMemoryMap(mapSnapshot);
        if (!nextMap) { setError("This MemoryMap could not be found."); return; }
        const floorSnapshots = await getDocs(query(collection(firestore, "memoryMaps", memoryMapId, "floors"), orderBy("order")));
        const nextFloors = await Promise.all(floorSnapshots.docs.map(async (snapshot) => {
          const floor = parseFloor(snapshot);
          const [rooms, corridors] = await Promise.all([
            getDocs(collection(firestore, "memoryMaps", memoryMapId, "floors", floor.id, "rooms")),
            getDocs(collection(firestore, "memoryMaps", memoryMapId, "floors", floor.id, "corridors")),
          ]);
          return { floor, rooms: rooms.docs.map(parseRoom), corridors: corridors.docs.map(parseCorridor) };
        }));
        if (cancelled) return;
        setMap(nextMap); setFloors(nextFloors); setFloorId(nextFloors[0]?.floor.id ?? "");
      } catch { if (!cancelled) setError("We could not load this campus. Check your connection and try again."); }
      finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [authLoading, memoryMapId, router, user]);

  useEffect(() => {
    if (authLoading || !user || !db) return;
    return onSnapshot(doc(db, "memoryMaps", memoryMapId), (snapshot) => {
      if (!snapshot.exists()) router.replace("/dashboard?deleted=1");
    }, () => undefined);
  }, [authLoading, memoryMapId, router, user]);

  const current = floors.find((item) => item.floor.id === floorId) ?? floors[0];
  const selectedRoom = current?.rooms.find((room) => room.id === roomId) ?? (null as never);

  useEffect(() => {
    if (!user || !db || !selectedRoom || !current) return;
    const firestore = db;
    let cancelled = false;
    const loadMemories = async () => {
      try {
        const snapshot = await getDocs(collection(firestore, "memoryMaps", memoryMapId, "memories"));
        const roomMemories = snapshot.docs.map(parseMemory)
          .filter((memory) => memory.roomId === selectedRoom.id)
          .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
        if (!cancelled) {
          setMemories(roomMemories);
          setIncidentCount(snapshot.docs.map(parseMemory).filter((memory) => memory.type === "incident").length);
        }
      } catch { if (!cancelled) setMemories([]); }
    };
    void loadMemories();
    return () => { cancelled = true; };
  }, [current, memoryMapId, selectedRoom, user]);

  const addIncident = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!db || !user || !current || !selectedRoom) return;
    if (user.isAnonymous && incidentCount >= 3) {
      setUpgradeOpen(true);
      return;
    }
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const eventDate = String(form.get("date") ?? "").trim();
    if (title.length < 2 || description.length < 2) return;
    setSaving(true);
    try {
      const memoryRef = await addDoc(collection(db, "memoryMaps", memoryMapId, "memories"), { memoryMapId, floorId: current.floor.id, roomId: selectedRoom.id, createdBy: user.uid, creatorName: user.displayName ?? null, type: "incident", title: title.slice(0, 100), description: description.slice(0, 3000), eventDate: eventDate ? new Date(`${eventDate}T00:00:00Z`) : null, tags: [], imageUrl: null, imageUploadId: null, imageFilename: null, imageSize: null, imageContentType: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      await updateDoc(doc(db, "memoryMaps", memoryMapId), { memoryCount: increment(1), updatedAt: serverTimestamp() });
      const saved = await getDoc(memoryRef);
      if (saved.exists()) setMemories((previous) => [parseMemory(saved), ...previous]);
      if (user.isAnonymous) setIncidentCount((count) => count + 1);
      setIncidentOpen(false); setMap((previous) => previous ? { ...previous, memoryCount: previous.memoryCount + 1 } : previous);
    } catch { setError("We could not save that incident. Please try again."); }
    finally { setSaving(false); }
  };

  const copyInvite = async () => {
    if (!map) return;
    const link = `${window.location.origin}/join/${map.inviteCode}`;
    try { await navigator.clipboard.writeText(link); } catch { const input = document.createElement("textarea"); input.value = link; input.setAttribute("readonly", "true"); input.style.position = "fixed"; input.style.opacity = "0"; document.body.appendChild(input); input.select(); document.execCommand("copy"); input.remove(); }
    setInviteMessage("Invite link copied");
  };

  const regenerateInvite = async () => {
    if (!db || !map || user?.isAnonymous || map.ownerId !== user?.uid || !window.confirm("Regenerate this invite link? The old link will stop working.")) return;
try { const nextCode = await reserveInviteCode(db); const batch = writeBatch(db); batch.update(doc(db, "memoryMaps", memoryMapId), { inviteCode: nextCode, updatedAt: serverTimestamp() }); batch.update(doc(db, "inviteCodes", map.inviteCode), { active: false, updatedAt: serverTimestamp() }); batch.set(doc(db, "inviteCodes", nextCode), { memoryMapId, active: true, createdBy: user.uid, ownerId: user.uid, mapName: map.name, ownerName: user.displayName ?? null, coverImageUrl: map.coverImageUrl ?? null, coverImagePosition: map.coverImagePosition, createdAt: serverTimestamp() }); await batch.commit(); setMap((previous) => previous ? { ...previous, inviteCode: nextCode } : previous); setInviteMessage("Invite link regenerated"); } catch { setInviteMessage("We could not regenerate the invite link."); }
  };

  const deleteMemory = async (memory: MemoryDocument) => {
    if (!db || !user || !current || !window.confirm(`Delete “${memory.title}” permanently?`)) return;
    setSaving(true);
    try {
      if (memory.type === "image" && memory.imageUploadId) await deleteMemoryImage(memory.imageUploadId, memoryMapId, memory.id);
      await deleteDoc(doc(db, "memoryMaps", memoryMapId, "memories", memory.id));
      await updateDoc(doc(db, "memoryMaps", memoryMapId), { memoryCount: increment(-1), updatedAt: serverTimestamp() });
      setMemories((previous) => previous.filter((item) => item.id !== memory.id));
      if (user.isAnonymous && memory.type === "incident") setIncidentCount((count) => Math.max(0, count - 1));
      setMap((previous) => previous ? { ...previous, memoryCount: Math.max(0, previous.memoryCount - 1) } : previous);
    } catch { setError("We could not delete that memory. Please try again."); }
    finally { setSaving(false); }
  };

  if (authLoading || loading) return <main className="mm-viewer mm-viewer--loading" aria-busy="true"><p className="sr-only" role="status" aria-live="polite">Loading your campus</p><div className="mm-viewer-loading__bar" aria-hidden="true" /><div className="mm-viewer-loading__map" aria-hidden="true" /></main>;
  if (error || !map || !current) return <main className="mm-state-page mm-state-page--dark"><h1>{error || "Campus not found"}</h1><p>Return to your dashboard and try again.</p><Link href="/dashboard" className="mm-button mm-button--coral">Back to dashboard</Link></main>;

  const addImage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!db || !user || !current || !selectedRoom) return;
    if (user.isAnonymous) {
      setUpgradeOpen(true);
      return;
    }
    const form = new FormData(event.currentTarget);
    const file = imageFile;
    const title = String(form.get("title") ?? "").trim();
    if (!(file instanceof File) || file.size === 0 || title.length < 2) { setImageError("Choose an image and give it a short title."); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setImageError("Only JPEG, PNG and WebP images are supported."); return; }
    if (file.size > 5 * 1024 * 1024) { setImageError("Images must be 5 MB or smaller."); return; }
    setSaving(true); setImageError("");
    const memoryRef = await addDoc(collection(db, "memoryMaps", memoryMapId, "memories"), { memoryMapId, floorId: current.floor.id, roomId: selectedRoom.id, createdBy: user.uid, creatorName: user.displayName ?? null, type: "image", title: title.slice(0, 100), description: String(form.get("description") ?? "").trim().slice(0, 3000), eventDate: String(form.get("date") ?? "") ? new Date(`${String(form.get("date"))}T00:00:00Z`) : null, tags: String(form.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 10), imageUrl: null, imageUploadId: null, imageFilename: null, imageSize: null, imageContentType: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    let uploadedId: string | null = null;
    try {
      const uploaded = await uploadMemoryImage(file, memoryMapId, memoryRef.id, current.floor.id, selectedRoom.id);
      uploadedId = uploaded.id;
      await updateDoc(memoryRef, { imageUrl: uploaded.url, imageUploadId: uploaded.id, imageFilename: uploaded.filename, imageSize: uploaded.size, imageContentType: uploaded.contentType, updatedAt: serverTimestamp() });
      await updateDoc(doc(db, "memoryMaps", memoryMapId), { memoryCount: increment(1), updatedAt: serverTimestamp() });
      const saved = await getDoc(memoryRef); if (saved.exists()) setMemories((previous) => [parseMemory(saved), ...previous]);
      setMap((previous) => previous ? { ...previous, memoryCount: previous.memoryCount + 1 } : previous); setImageOpen(false);
    } catch (error) { const { deleteDoc } = await import("firebase/firestore"); if (uploadedId) { try { await deleteMemoryImage(uploadedId, memoryMapId, memoryRef.id); } catch { /* preserve the original safe error */ } } await deleteDoc(memoryRef); setImageError(error instanceof Error ? error.message : "The image could not be uploaded."); }
    finally { setSaving(false); }
  };

  return <main className="mm-viewer">
    {upgradeOpen && <UpgradeModal onClose={() => setUpgradeOpen(false)} />}
    <header className="mm-viewer__topbar"><div className="mm-viewer__nav-grid"><div className="mm-viewer__left-zone"><Link href="/dashboard" className="mm-brand mm-viewer__brand" aria-label="Back to dashboard"><MemoryMapLogo size={38} variant="light" /><MemoryMapWordmark /></Link><div className="mm-viewer__campus"><strong>{map.name}</strong><span>Private campus</span></div></div><div className="mm-viewer__floor-control"><span>FLOOR</span><div className="mm-viewer__floor-tabs" role="tablist" aria-label="Campus floors">{floors.map((item) => <button type="button" role="tab" key={item.floor.id} aria-selected={item.floor.id === current.floor.id} onClick={() => { setFloorId(item.floor.id); setRoomId(null); }}>{item.floor.name}</button>)}</div></div><div className="mm-viewer__actions">{map.ownerId === user?.uid && !user.isAnonymous && <button type="button" className="mm-viewer__invite" onClick={() => { setInviteMessage(""); setInviteOpen(true); }}>Invite</button>}{map.ownerId === user?.uid && <Link href={`/memorymaps/${memoryMapId}/setup`} className="mm-viewer__link mm-viewer__edit">Edit campus</Link>}<Link href="/dashboard" className="mm-viewer__link mm-viewer__dashboard">Dashboard</Link><span className="mm-viewer__avatar" aria-label="Account">{user?.isAnonymous ? "G" : (user?.displayName || user?.email || "MM").slice(0, 2).toUpperCase()}</span></div></div></header>

    <section className="mm-viewer__layout"><div className="mm-viewer__map" aria-label={`${current.floor.name} rooms`}><h1>{current.floor.name}</h1><div className="mm-viewer__canvas"><svg viewBox="0 0 960 560" aria-hidden="true">{current.corridors.map((corridor) => <polyline key={corridor.id} points={corridor.points.map((point) => `${point.x},${point.y}`).join(" ")} className={`mm-viewer-corridor mm-viewer-corridor--${corridor.style}`} style={{ strokeWidth: corridor.width }} />)}</svg>{current.rooms.map((room) => <button type="button" key={room.id} className={`mm-viewer-room mm-viewer-room--${room.accent}${room.id === roomId ? " is-selected" : ""}`} style={{ left: `${room.x}px`, top: `${room.y}px`, width: `${room.width}px`, height: `${room.height}px` }} aria-pressed={room.id === roomId} onClick={() => setRoomId(room.id)}><strong>{room.name}</strong><small>{room.type}</small></button>)}</div></div>{selectedRoom && <aside className="mm-viewer__panel" aria-label={`${selectedRoom.name} memories`}><button type="button" className="mm-viewer__close" onClick={() => setRoomId(null)} aria-label="Close room memories">×</button><p className="mm-eyebrow mm-eyebrow--yellow">Room memories</p><h2>{selectedRoom.name}</h2><p>{memories.length} memories connected to this place.</p><div className="mm-viewer__actions"><button type="button" className="mm-button mm-button--outline" onClick={() => { setImageError(""); setImageOpen(true); }}>Add image</button><button type="button" className="mm-button mm-button--coral" onClick={() => setIncidentOpen(true)}>Add incident</button></div><div className="mm-viewer__timeline">{memories.length === 0 ? <p className="mm-viewer__empty">No memories here yet. Add the first incident connected to this room.</p> : memories.map((memory) => <article key={memory.id}>{memory.type === "image" && memory.imageUrl && <button type="button" className="mm-memory-thumb-button" onClick={() => setLightboxUrl(memory.imageUrl)} aria-label={`Open larger image for ${memory.title}`}><img className="mm-memory-thumb" src={memory.imageUrl} alt="" /></button>}<small>{memory.eventDate ? memory.eventDate.toDate().toLocaleDateString() : "Undated memory"}</small><h3>{memory.title}</h3><p>{memory.description}</p><span>{memory.creatorName || "MemoryMap member"}</span>{map.ownerId === user?.uid && <button type="button" className="mm-memory-delete" onClick={() => void deleteMemory(memory)} disabled={saving}>Delete</button>}</article>)}</div></aside>}</section>
    {incidentOpen && <div className="mm-viewer-modal" role="dialog" aria-modal="true" aria-labelledby="incident-title"><form onSubmit={addIncident}><p className="mm-eyebrow mm-eyebrow--yellow">Add to {selectedRoom.name}</p><h2 id="incident-title">What happened here?</h2><label>Title<input name="title" required minLength={2} maxLength={100} autoFocus /></label><label>What happened?<textarea name="description" required minLength={2} maxLength={3000} rows={5} /></label><label>Date<input name="date" type="date" /></label><div className="mm-viewer-modal__actions"><button type="button" className="mm-button mm-button--outline" onClick={() => setIncidentOpen(false)}>Cancel</button><button type="submit" className="mm-button mm-button--coral" disabled={saving}>{saving ? "Savingâ€¦" : "Save incident"}</button></div></form></div>}
    {imageOpen && selectedRoom && <div className="mm-viewer-modal" role="dialog" aria-modal="true" aria-labelledby="image-title"><form onSubmit={addImage}><p className="mm-eyebrow mm-eyebrow--yellow">ADD TO {selectedRoom.name}</p><h2 id="image-title">Add a photo memory</h2>{imageError && <p role="alert" className="mm-auth-message mm-auth-message--error">{imageError}</p>}<label>Image<input name="file" type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => { const next = event.target.files?.[0] ?? null; setImageError(next && next.size > 5 * 1024 * 1024 ? "Images must be 5 MB or smaller." : next && !["image/jpeg", "image/png", "image/webp"].includes(next.type) ? "Only JPEG, PNG and WebP images are supported." : ""); setImageFile(next); }} /><small>JPEG, PNG or WebP · Maximum 5 MB</small></label>{imagePreview && <img className="mm-image-preview" src={imagePreview} alt="Selected upload preview" />}<label>Title<input name="title" required minLength={2} maxLength={100} autoFocus /></label><label>Description<textarea name="description" maxLength={3000} rows={4} /></label><label>Date<input name="date" type="date" /></label><label>Optional tags<input name="tags" placeholder="e.g. friends, sports day" /></label><div className="mm-viewer-modal__actions"><button type="button" className="mm-button mm-button--outline" onClick={() => { if (!saving) { setImageOpen(false); setImageFile(null); } }}>Cancel</button><button type="submit" className="mm-button mm-button--coral" disabled={saving}>{saving ? "Uploadingâ€¦" : "Upload image"}</button></div></form></div>}
    {lightboxUrl && <div className="mm-image-lightbox" role="dialog" aria-modal="true" aria-label="Image preview" onClick={() => setLightboxUrl(null)}><button type="button" className="mm-image-lightbox__close" aria-label="Close image preview" onClick={() => setLightboxUrl(null)}>×</button><img src={lightboxUrl} alt="Expanded memory" onClick={(event) => event.stopPropagation()} /></div>}\n    {inviteOpen && map && <div className="mm-viewer-modal" role="dialog" aria-modal="true" aria-labelledby="invite-title" onClick={() => setInviteOpen(false)}><form onSubmit={(event) => event.preventDefault()} onClick={(event) => event.stopPropagation()}><p className="mm-eyebrow mm-eyebrow--yellow">PRIVATE ACCESS</p><h2 id="invite-title">Invite people to this MemoryMap</h2><p>Share this private link with people you trust.</p><label>Invite link<input readOnly value={`${typeof window === "undefined" ? "" : window.location.origin}/join/${map.inviteCode}`} /></label>{inviteMessage && <p role="status" className="mm-auth-message">{inviteMessage}</p>}<div className="mm-viewer-modal__actions"><button type="button" className="mm-button mm-button--outline" onClick={() => setInviteOpen(false)}>Close</button><button type="button" className="mm-button mm-button--outline" onClick={() => void regenerateInvite()}>Regenerate link</button><button type="button" className="mm-button mm-button--coral" onClick={() => void copyInvite()}>Copy link</button></div></form></div>}\n  </main>;
}
