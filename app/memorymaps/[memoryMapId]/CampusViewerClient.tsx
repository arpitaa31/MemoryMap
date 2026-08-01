"use client";

import { addDoc, collection, doc, getDoc, getDocs, increment, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MemoryMapLogo from "../../../app/components/MemoryMapLogo";
import MemoryMapWordmark from "../../../app/components/MemoryMapWordmark";
import { useAuth } from "../../../app/providers/AuthProvider";
import { assertFirebaseConfig, db } from "../../../lib/firebase/client";
import { parseCorridor, parseFloor, parseMemory, parseMemoryMap, parseRoom } from "../../../lib/memorymaps/data";
import { uploadMemoryImage } from "../../../lib/uploads/client";
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

  const current = floors.find((item) => item.floor.id === floorId) ?? floors[0];
  const selectedRoom = current?.rooms.find((room) => room.id === roomId) ?? (null as never);

  useEffect(() => {
    if (!user || !db || !selectedRoom || !current) return;
    const firestore = db;
    let cancelled = false;
    const loadMemories = async () => {
      try {
        const snapshot = await getDocs(query(collection(firestore, "memoryMaps", memoryMapId, "memories"), where("roomId", "==", selectedRoom.id), orderBy("createdAt", "desc")));
        if (!cancelled) setMemories(snapshot.docs.map(parseMemory));
      } catch { if (!cancelled) setMemories([]); }
    };
    void loadMemories();
    return () => { cancelled = true; };
  }, [current, memoryMapId, selectedRoom, user]);

  const addIncident = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!db || !user || !current || !selectedRoom) return;
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
      setIncidentOpen(false); setMap((previous) => previous ? { ...previous, memoryCount: previous.memoryCount + 1 } : previous);
    } catch { setError("We could not save that incident. Please try again."); }
    finally { setSaving(false); }
  };

  if (authLoading || loading) return <main className="mm-viewer mm-viewer--loading" aria-busy="true"><p className="sr-only" role="status" aria-live="polite">Loading your campus</p><div className="mm-viewer-loading__bar" aria-hidden="true" /><div className="mm-viewer-loading__map" aria-hidden="true" /></main>;
  if (error || !map || !current) return <main className="mm-state-page mm-state-page--dark"><h1>{error || "Campus not found"}</h1><p>Return to your dashboard and try again.</p><Link href="/dashboard" className="mm-button mm-button--coral">Back to dashboard</Link></main>;

  const addImage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!db || !user || !current || !selectedRoom) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    const title = String(form.get("title") ?? "").trim();
    if (!(file instanceof File) || file.size === 0 || title.length < 2) { setImageError("Choose an image and give it a short title."); return; }
    setSaving(true); setImageError("");
    const memoryRef = await addDoc(collection(db, "memoryMaps", memoryMapId, "memories"), { memoryMapId, floorId: current.floor.id, roomId: selectedRoom.id, createdBy: user.uid, creatorName: user.displayName ?? null, type: "image", title: title.slice(0, 100), description: String(form.get("description") ?? "").trim().slice(0, 3000), eventDate: null, tags: [], imageUrl: null, imageUploadId: null, imageFilename: null, imageSize: null, imageContentType: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    try {
      const uploaded = await uploadMemoryImage(file, memoryMapId, memoryRef.id);
      await updateDoc(memoryRef, { imageUrl: uploaded.url, imageUploadId: uploaded.id, imageFilename: uploaded.filename, imageSize: uploaded.size, imageContentType: uploaded.content_type, updatedAt: serverTimestamp() });
      await updateDoc(doc(db, "memoryMaps", memoryMapId), { memoryCount: increment(1), updatedAt: serverTimestamp() });
      const saved = await getDoc(memoryRef); if (saved.exists()) setMemories((previous) => [parseMemory(saved), ...previous]);
      setMap((previous) => previous ? { ...previous, memoryCount: previous.memoryCount + 1 } : previous); setImageOpen(false);
    } catch { const { deleteDoc } = await import("firebase/firestore"); await deleteDoc(memoryRef); setImageError("The image could not be uploaded. Check the file type and size, then try again."); }
    finally { setSaving(false); }
  };

  return <main className="mm-viewer">
    <header className="mm-viewer__topbar"><Link href="/dashboard" className="mm-brand mm-viewer__brand" aria-label="Back to dashboard"><MemoryMapLogo size={34} variant="light" /><MemoryMapWordmark /></Link><div><strong>{map.name}</strong><span>Private campus</span></div><div className="mm-viewer__actions">{map.ownerId === user?.uid && <Link href={`/memorymaps/${memoryMapId}/setup`} className="mm-viewer__link">Edit campus</Link>}<Link href="/dashboard" className="mm-viewer__link">Dashboard</Link></div></header>
    <nav className="mm-viewer__floors" aria-label="Campus floors">{floors.map((item) => <button type="button" key={item.floor.id} aria-current={item.floor.id === current.floor.id ? "page" : undefined} onClick={() => { setFloorId(item.floor.id); setRoomId(null); }}>{item.floor.name}</button>)}</nav>
    <section className="mm-viewer__layout"><div className="mm-viewer__map" aria-label={`${current.floor.name} rooms`}><h1>{current.floor.name}</h1><div className="mm-viewer__canvas"><svg viewBox="0 0 960 560" aria-hidden="true">{current.corridors.map((corridor) => <polyline key={corridor.id} points={corridor.points.map((point) => `${point.x},${point.y}`).join(" ")} className="mm-viewer-corridor" style={{ strokeWidth: corridor.width }} />)}</svg>{current.rooms.map((room) => <button type="button" key={room.id} className={`mm-viewer-room mm-viewer-room--${room.accent}${room.id === roomId ? " is-selected" : ""}`} style={{ left: `${room.x}px`, top: `${room.y}px`, width: `${room.width}px`, height: `${room.height}px` }} aria-pressed={room.id === roomId} onClick={() => setRoomId(room.id)}><strong>{room.name}</strong><small>{room.type}</small></button>)}</div></div>{selectedRoom && <aside className="mm-viewer__panel" aria-label={`${selectedRoom.name} memories`}><button type="button" className="mm-viewer__close" onClick={() => setRoomId(null)} aria-label="Close memory panel">×</button><p className="mm-eyebrow mm-eyebrow--yellow">Room memories</p><h2>{selectedRoom.name}</h2><p>{memories.length} memories connected to this place.</p><button type="button" className="mm-button mm-button--coral" onClick={() => setIncidentOpen(true)}>Add incident</button><div className="mm-viewer__timeline">{memories.length === 0 ? <p className="mm-viewer__empty">No memories here yet. Add the first incident connected to this room.</p> : memories.map((memory) => <article key={memory.id}><small>{memory.eventDate ? memory.eventDate.toDate().toLocaleDateString() : "Undated memory"}</small><h3>{memory.title}</h3><p>{memory.description}</p><span>{memory.creatorName || "MemoryMap member"}</span></article>)}</div></aside>}</section>
    {incidentOpen && <div className="mm-viewer-modal" role="dialog" aria-modal="true" aria-labelledby="incident-title"><form onSubmit={addIncident}><p className="mm-eyebrow mm-eyebrow--yellow">Add to {selectedRoom.name}</p><h2 id="incident-title">What happened here?</h2><label>Title<input name="title" required minLength={2} maxLength={100} autoFocus /></label><label>What happened?<textarea name="description" required minLength={2} maxLength={3000} rows={5} /></label><label>Date<input name="date" type="date" /></label><div className="mm-viewer-modal__actions"><button type="button" className="mm-button mm-button--outline" onClick={() => setIncidentOpen(false)}>Cancel</button><button type="submit" className="mm-button mm-button--coral" disabled={saving}>{saving ? "Saving…" : "Save incident"}</button></div></form></div>}
    {imageOpen && selectedRoom && <div className="mm-viewer-modal" role="dialog" aria-modal="true" aria-labelledby="image-title"><form onSubmit={addImage}><h2 id="image-title">Add a photo to {selectedRoom.name}</h2>{imageError && <p role="alert" className="mm-auth-message mm-auth-message--error">{imageError}</p>}<label>Title<input name="title" required minLength={2} maxLength={100} autoFocus /></label><label>Image<input name="file" type="file" accept="image/jpeg,image/png,image/webp" required /></label><label>Note<textarea name="description" maxLength={3000} rows={4} /></label><div className="mm-viewer-modal__actions"><button type="button" className="mm-button mm-button--outline" onClick={() => setImageOpen(false)}>Cancel</button><button type="submit" className="mm-button mm-button--coral" disabled={saving}>{saving ? "Uploading…" : "Upload image"}</button></div></form></div>}
  </main>;
}
