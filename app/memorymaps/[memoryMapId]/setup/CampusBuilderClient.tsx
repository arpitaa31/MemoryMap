"use client";

import { deleteDoc, collection, doc, getDoc, getDocs, increment, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MemoryMapLogo from "../../../components/MemoryMapLogo";
import MemoryMapWordmark from "../../../components/MemoryMapWordmark";
import { useAuth } from "../../../providers/AuthProvider";
import { assertFirebaseConfig, db } from "../../../../lib/firebase/client";
import { reserveInviteCode } from "../../../../lib/memorymaps/invite";
import UpgradeModal from "../../../../components/UpgradeModal";
import { parseCorridor, parseFloor, parseMember, parseMemoryMap, parseRoom } from "../../../../lib/memorymaps/data";
import type { MemoryMapCorridor, MemoryMapDocument, MemoryMapFloor, MemoryMapMember, MemoryMapRoom, RoomAccent, RoomType } from "../../../../types/memory-map";

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 560;
const MIN_ROOM_WIDTH = 120;
const MIN_ROOM_HEIGHT = 76;
const MAX_ROOM_WIDTH = 360;
const MAX_ROOM_HEIGHT = 250;

type FloorState = { floor: MemoryMapFloor; rooms: MemoryMapRoom[]; corridors: MemoryMapCorridor[] };
type Selection = { kind: "room" | "corridor" | "floor"; id: string } | null;
type DragState = { kind: "room"; roomId: string; floorId: string; mode: "move" | "resize"; startX: number; startY: number; initial: MemoryMapRoom } | { kind: "corridor"; corridorId: string; floorId: string; startX: number; startY: number; initial: MemoryMapCorridor };
type Modal = "floor" | "invite" | "done" | "upgrade" | null;

const roomTypes: Array<{ value: RoomType; label: string }> = [
  { value: "classroom", label: "Classroom" }, { value: "laboratory", label: "Laboratory" }, { value: "library", label: "Library" }, { value: "auditorium", label: "Auditorium" }, { value: "sports", label: "Sports" }, { value: "office", label: "Office" }, { value: "canteen", label: "Canteen" }, { value: "stairs", label: "Stairs" }, { value: "other", label: "Other" },
];
const accents: RoomAccent[] = ["coral", "green", "yellow", "teal", "neutral"];

function mapRefFor(dbInstance: NonNullable<typeof db>, memoryMapId: string) { return doc(dbInstance, "memoryMaps", memoryMapId); }

function normaliseFloorName(value: string) { return value.trim().replace(/\s+/g, " "); }

function pointFromEvent(event: PointerEvent | React.MouseEvent, canvas: HTMLDivElement) {
  const rect = canvas.getBoundingClientRect();
  return { x: Math.max(0, Math.min(CANVAS_WIDTH, ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH)), y: Math.max(0, Math.min(CANVAS_HEIGHT, ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT)) };
}

function RoomNode({ room, preview, selected, onSelect, onPointerDown, onKeyDown }: { room: MemoryMapRoom; preview: boolean; selected: boolean; onSelect: () => void; onPointerDown: (event: React.PointerEvent<HTMLButtonElement>, mode: "move" | "resize") => void; onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void }) {
  return <button type="button" className={`mm-builder-room mm-builder-room--${room.accent}${selected ? " is-selected" : ""}`} style={{ left: `${room.x}px`, top: `${room.y}px`, width: `${room.width}px`, height: `${room.height}px` }} aria-label={`${room.name}, ${room.type}, ${selected ? "selected" : "select room"}`} aria-pressed={selected} onClick={onSelect} onPointerDown={(event) => { if (!preview) onPointerDown(event, "move"); }} onKeyDown={onKeyDown}>
    <span className="mm-builder-room__type">{room.type}</span><strong>{room.name}</strong><small>{selected && !preview ? "Selected" : "Room"}</small>{!preview && selected && <span className="mm-builder-room__resize" aria-hidden="true" onPointerDown={(event) => { event.stopPropagation(); onPointerDown(event as unknown as React.PointerEvent<HTMLButtonElement>, "resize"); }} />}
  </button>;
}

type BuilderIconName = "floor" | "room" | "corridor" | "members" | "layout" | "tip" | "preview" | "check";

function BuilderIcon({ name }: { name: BuilderIconName }) {
  const paths: Record<BuilderIconName, React.ReactNode> = {
    floor: <><path d="M4 7.5 12 4l8 3.5-8 3-8-3Z" /><path d="m4 12.5 8 3 8-3M4 16.5l8 3 8-3" /></>,
    room: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 8h8v8H8z" /></>,
    corridor: <><path d="M4 17c3.5-8 8.5-8 12-2 1.2 2 2.4 2.3 4 .5" /><circle cx="4" cy="17" r="1.5" /><circle cx="20" cy="15.5" r="1.5" /></>,
    members: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.6-3 2.4-4.5 5.5-4.5s4.9 1.5 5.5 4.5" /><path d="M16 6.5a3 3 0 0 1 0 5.8M17 14.8c2.2.3 3.5 1.7 4 4.2" /></>,
    layout: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    tip: <><path d="M8.2 16.5h7.6M9 20h6M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.2 1.2 2h4.8c.1-.8.5-1.5 1.2-2A6 6 0 0 0 12 3Z" /><path d="M12 6v4M10 8h4" /></>,
    preview: <><path d="M3.5 12s3.1-5 8.5-5 8.5 5 8.5 5-3.1 5-8.5 5-8.5-5-8.5-5Z" /><circle cx="12" cy="12" r="2.2" /></>,
    check: <><path d="m5 12 4.2 4L19 6.5" /></>,
  };
  return <span className="mm-builder-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg></span>;
}

export default function CampusBuilderClient({ memoryMapId }: { memoryMapId: string }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [map, setMap] = useState<MemoryMapDocument | null>(null);
  const [floors, setFloors] = useState<FloorState[]>([]);
  const [members, setMembers] = useState<MemoryMapMember[]>([]);
  const [currentFloorId, setCurrentFloorId] = useState("");
  const [selection, setSelection] = useState<Selection>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [drawStyle, setDrawStyle] = useState<"solid" | "stairs">("solid");
  const [draftPoints, setDraftPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [cursorPoint, setCursorPoint] = useState<{ x: number; y: number } | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [floorName, setFloorName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [doneError, setDoneError] = useState("");
  const [accessState, setAccessState] = useState<"loading" | "ready" | "not-found" | "denied" | "error">("loading");
  const [saveState, setSaveState] = useState<"Saved" | "Savingâ€¦" | "Unable to save">("Saved");
  const canvasRef = useRef<HTMLDivElement>(null);
  const saveRoomRef = useRef<(room: MemoryMapRoom, floorId: string) => Promise<void>>(async () => undefined);
  const saveCorridorRef = useRef<(corridor: MemoryMapCorridor, floorId: string) => Promise<void>>(async () => undefined);
  const finishCorridorRef = useRef<() => Promise<void>>(async () => undefined);

  const currentState = floors.find((state) => state.floor.id === currentFloorId) ?? floors[0];
  const selectedRoom = currentState && selection?.kind === "room" ? currentState.rooms.find((room) => room.id === selection.id) ?? null : null;
  const selectedCorridor = currentState && selection?.kind === "corridor" ? currentState.corridors.find((corridor) => corridor.id === selection.id) ?? null : null;
  const roomCount = floors.reduce((total, state) => total + state.rooms.length, 0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace(`/login?next=/memorymaps/${memoryMapId}/setup`); return; }
    let cancelled = false;
    const load = async () => {
      try {
        assertFirebaseConfig();
        if (!db) throw new Error("Firestore unavailable");
        const firestore = db;
        const mapSnapshot = await getDoc(mapRefFor(firestore, memoryMapId));
        const nextMap = parseMemoryMap(mapSnapshot);
        if (!nextMap) { setAccessState("not-found"); return; }
        if (nextMap.ownerId !== user.uid) { setAccessState("denied"); return; }
        const floorSnapshots = await getDocs(query(collection(firestore, "memoryMaps", memoryMapId, "floors"), orderBy("order")));
        const states = await Promise.all(floorSnapshots.docs.map(async (floorSnapshot) => {
          const floor = parseFloor(floorSnapshot);
          const [roomSnapshots, corridorSnapshots] = await Promise.all([
            getDocs(collection(firestore, "memoryMaps", memoryMapId, "floors", floor.id, "rooms")),
            getDocs(collection(firestore, "memoryMaps", memoryMapId, "floors", floor.id, "corridors")),
          ]);
          return { floor, rooms: roomSnapshots.docs.map(parseRoom).sort((a, b) => a.order - b.order), corridors: corridorSnapshots.docs.map(parseCorridor) };
        }));
        const memberSnapshots = await getDocs(collection(firestore, "memoryMaps", memoryMapId, "members"));
        if (cancelled) return;
        setMap(nextMap); setFloors(states); setMembers(memberSnapshots.docs.map(parseMember)); setInviteCode(nextMap.inviteCode); setCurrentFloorId(states[0]?.floor.id ?? ""); setAccessState("ready");
      } catch { if (!cancelled) setAccessState("error"); }
    };
    void load();
    return () => { cancelled = true; };
  }, [authLoading, memoryMapId, router, user]);

  useEffect(() => {
    if (authLoading || !user || !db) return;
    return onSnapshot(mapRefFor(db, memoryMapId), (snapshot) => {
      if (!snapshot.exists()) router.replace("/dashboard?deleted=1");
    }, () => undefined);
  }, [authLoading, memoryMapId, router, user]);

  useEffect(() => {
    if (!drawMode && !drag) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setDrawMode(false); setDraftPoints([]); setCursorPoint(null); setDrag(null); }
      if (drawMode && event.key === "Enter") void finishCorridorRef.current();
    };
    const handleMove = (event: PointerEvent) => {
      if (!drag || !canvasRef.current) return;
      const point = pointFromEvent(event, canvasRef.current);
      const dx = point.x - drag.startX;
      const dy = point.y - drag.startY;
      if (drag.kind === "room") {
        const nextRoom = drag.mode === "move"
          ? { ...drag.initial, x: Math.max(0, Math.min(CANVAS_WIDTH - drag.initial.width, drag.initial.x + dx)), y: Math.max(0, Math.min(CANVAS_HEIGHT - drag.initial.height, drag.initial.y + dy)) }
          : { ...drag.initial, width: Math.max(MIN_ROOM_WIDTH, Math.min(MAX_ROOM_WIDTH, drag.initial.width + dx)), height: Math.max(MIN_ROOM_HEIGHT, Math.min(MAX_ROOM_HEIGHT, drag.initial.height + dy)) };
        setFloors((previous) => previous.map((state) => state.floor.id !== drag.floorId ? state : { ...state, rooms: state.rooms.map((room) => room.id === drag.roomId ? nextRoom : room) }));
      } else {
        const minX = Math.min(...drag.initial.points.map((point) => point.x));
        const maxX = Math.max(...drag.initial.points.map((point) => point.x));
        const minY = Math.min(...drag.initial.points.map((point) => point.y));
        const maxY = Math.max(...drag.initial.points.map((point) => point.y));
        const offsetX = Math.max(-minX, Math.min(CANVAS_WIDTH - maxX, dx));
        const offsetY = Math.max(-minY, Math.min(CANVAS_HEIGHT - maxY, dy));
        const nextCorridor = { ...drag.initial, points: drag.initial.points.map((point) => ({ x: point.x + offsetX, y: point.y + offsetY })) };
        setFloors((previous) => previous.map((state) => state.floor.id !== drag.floorId ? state : { ...state, corridors: state.corridors.map((corridor) => corridor.id === drag.corridorId ? nextCorridor : corridor) }));
      }
    };
    const handleUp = () => {
      if (!drag) return;
      const state = floors.find((item) => item.floor.id === drag.floorId);
      setDrag(null);
      if (drag.kind === "room") {
        const room = state?.rooms.find((item) => item.id === drag.roomId);
        if (room) void saveRoomRef.current(room, drag.floorId);
      } else {
        const corridor = state?.corridors.find((item) => item.id === drag.corridorId);
        if (corridor) void saveCorridorRef.current(corridor, drag.floorId);
      }
    };
    window.addEventListener("keydown", handleKeyDown); window.addEventListener("pointermove", handleMove); window.addEventListener("pointerup", handleUp);
    return () => { window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("pointermove", handleMove); window.removeEventListener("pointerup", handleUp); };
  }, [drag, drawMode, floors]);

  useEffect(() => {
    if (!modal) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setModal(null); };
    window.addEventListener("keydown", closeOnEscape); return () => window.removeEventListener("keydown", closeOnEscape);
  }, [modal]);

  const saveRoom = useCallback(async (room: MemoryMapRoom, floorId: string) => {
    if (!db) return;
    setSaveState("Savingâ€¦");
    try {
      await updateDoc(doc(db, "memoryMaps", memoryMapId, "floors", floorId, "rooms", room.id), { name: room.name, type: room.type, accent: room.accent, x: room.x, y: room.y, width: room.width, height: room.height, rotation: room.rotation, order: room.order, updatedAt: serverTimestamp() });
      await updateDoc(mapRefFor(db, memoryMapId), { updatedAt: serverTimestamp() });
      setSaveState("Saved");
    } catch { setSaveState("Unable to save"); }
  }, [memoryMapId]);

  const saveCorridor = useCallback(async (corridor: MemoryMapCorridor, floorId: string) => {
    if (!db) return;
    setSaveState("Savingâ€¦");
    try { await updateDoc(doc(db, "memoryMaps", memoryMapId, "floors", floorId, "corridors", corridor.id), { points: corridor.points, updatedAt: serverTimestamp() }); await updateDoc(mapRefFor(db, memoryMapId), { updatedAt: serverTimestamp() }); setSaveState("Saved"); } catch { setSaveState("Unable to save"); }
  }, [memoryMapId]);

  const updateRoomLocal = (roomId: string, changes: Partial<MemoryMapRoom>) => {
    if (!currentState) return;
    const nextRoom = currentState.rooms.find((room) => room.id === roomId);
    setFloors((previous) => previous.map((state) => state.floor.id !== currentState.floor.id ? state : { ...state, rooms: state.rooms.map((room) => room.id === roomId ? { ...room, ...changes } : room) }));
    if (nextRoom) void saveRoom({ ...nextRoom, ...changes }, currentState.floor.id);
  };

  const saveMapName = async () => {
    if (!db || !map) return;
    const name = normaliseFloorName(map.name);
    if (name.length < 2 || name.length > 80) return;
    setMap((previous) => previous ? { ...previous, name } : previous);
    setSaveState("Savingâ€¦");
    try { await updateDoc(mapRefFor(db, memoryMapId), { name, updatedAt: serverTimestamp() }); setSaveState("Saved"); } catch { setSaveState("Unable to save"); }
  };

  const addFloor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (user?.isAnonymous) { setModal("upgrade"); return; }
    const name = normaliseFloorName(floorName);
    if (name.length < 2 || name.length > 50) return;
    if (floors.some((state) => state.floor.name.toLowerCase() === name.toLowerCase())) return;
    if (!db) return;
    setSaveState("Savingâ€¦");
    try {
      const floorRef = doc(collection(db, "memoryMaps", memoryMapId, "floors"));
      const order = floors.length;
      await setDoc(floorRef, { name, order, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      const floor = { id: floorRef.id, name, order };
      setFloors((previous) => [...previous, { floor, rooms: [], corridors: [] }]); setCurrentFloorId(floor.id); setFloorName(""); setModal(null); setSaveState("Saved");
    } catch { setSaveState("Unable to save"); }
  };

  const deleteFloor = async () => {
    if (!currentState || floors.length <= 1 || !db || !window.confirm(`Delete ${currentState.floor.name}? Its rooms and corridors will be removed.`)) return;
    const firestore = db;
    const batch = writeBatch(firestore);
    currentState.rooms.forEach((room) => batch.delete(doc(firestore, "memoryMaps", memoryMapId, "floors", currentState.floor.id, "rooms", room.id)));
    currentState.corridors.forEach((corridor) => batch.delete(doc(firestore, "memoryMaps", memoryMapId, "floors", currentState.floor.id, "corridors", corridor.id)));
    batch.delete(doc(firestore, "memoryMaps", memoryMapId, "floors", currentState.floor.id));
    setSaveState("Savingâ€¦");
    try { await batch.commit(); const nextFloors = floors.filter((state) => state.floor.id !== currentState.floor.id); setFloors(nextFloors); setCurrentFloorId(nextFloors[0].floor.id); setSelection(null); setSaveState("Saved"); } catch { setSaveState("Unable to save"); }
  };

  const addRoom = async (preset: { name: string; type: RoomType } = { name: "Untitled Room", type: "other" }) => {
    if (!currentState || !db) return;
    if (user?.isAnonymous && roomCount >= 5) { setModal("upgrade"); return; }
    const roomRef = doc(collection(db, "memoryMaps", memoryMapId, "floors", currentState.floor.id, "rooms"));
    const room: MemoryMapRoom = { id: roomRef.id, name: preset.name, type: preset.type, accent: "neutral", x: 310 + (currentState.rooms.length % 3) * 45, y: 180 + (currentState.rooms.length % 2) * 45, width: 180, height: 110, rotation: 0, order: currentState.rooms.length };
    setSaveState("Savingâ€¦");
    try { await setDoc(roomRef, { ...room, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); await updateDoc(mapRefFor(db, memoryMapId), { roomCount: increment(1), updatedAt: serverTimestamp() }); setFloors((previous) => previous.map((state) => state.floor.id !== currentState.floor.id ? state : { ...state, rooms: [...state.rooms, room] })); setSelection({ kind: "room", id: room.id }); setSaveState("Saved"); } catch { setSaveState("Unable to save"); }
  };

  const deleteRoom = async () => {
    if (!selectedRoom || !currentState || !db || !window.confirm(`Delete ${selectedRoom.name}?`)) return;
    try { await deleteDoc(doc(db, "memoryMaps", memoryMapId, "floors", currentState.floor.id, "rooms", selectedRoom.id)); await updateDoc(mapRefFor(db, memoryMapId), { roomCount: increment(-1), updatedAt: serverTimestamp() }); setFloors((previous) => previous.map((state) => state.floor.id !== currentState.floor.id ? state : { ...state, rooms: state.rooms.filter((room) => room.id !== selectedRoom.id) })); setSelection(null); } catch { setSaveState("Unable to save"); }
  };

  const duplicateRoom = async () => {
    if (!selectedRoom || !currentState || !db) return;
    if (user?.isAnonymous && roomCount >= 5) { setModal("upgrade"); return; }
    const copyRef = doc(collection(db, "memoryMaps", memoryMapId, "floors", currentState.floor.id, "rooms"));
    const room = { ...selectedRoom, id: copyRef.id, name: `${selectedRoom.name} copy`, x: Math.min(CANVAS_WIDTH - selectedRoom.width, selectedRoom.x + 28), y: Math.min(CANVAS_HEIGHT - selectedRoom.height, selectedRoom.y + 28), order: currentState.rooms.length };
    try { await setDoc(copyRef, { ...room, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); await updateDoc(mapRefFor(db, memoryMapId), { roomCount: increment(1), updatedAt: serverTimestamp() }); setFloors((previous) => previous.map((state) => state.floor.id !== currentState.floor.id ? state : { ...state, rooms: [...state.rooms, room] })); setSelection({ kind: "room", id: room.id }); } catch { setSaveState("Unable to save"); }
  };

  const finishCorridor = useCallback(async () => {
    if (!drawMode || draftPoints.length < 2 || !currentState || !db) { setDrawMode(false); setDraftPoints([]); return; }
    const corridorRef = doc(collection(db, "memoryMaps", memoryMapId, "floors", currentState.floor.id, "corridors"));
    const corridor: MemoryMapCorridor = { id: corridorRef.id, label: drawStyle === "stairs" ? "Stairs" : "Corridor", points: draftPoints, width: drawStyle === "stairs" ? 5 : 14, style: drawStyle };
    try { await setDoc(corridorRef, { ...corridor, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); setFloors((previous) => previous.map((state) => state.floor.id !== currentState.floor.id ? state : { ...state, corridors: [...state.corridors, corridor] })); setSelection({ kind: "corridor", id: corridor.id }); setSaveState("Saved"); } catch { setSaveState("Unable to save"); }
    setDrawMode(false); setDraftPoints([]); setCursorPoint(null);
  }, [currentState, draftPoints, drawMode, drawStyle, memoryMapId]);

  useEffect(() => {
    saveRoomRef.current = saveRoom;
    saveCorridorRef.current = saveCorridor;
    finishCorridorRef.current = finishCorridor;
  }, [finishCorridor, saveCorridor, saveRoom]);

  const deleteCorridor = async () => {
    if (!selectedCorridor || !currentState || !db || !window.confirm(`Delete ${selectedCorridor.label}?`)) return;
    try { await deleteDoc(doc(db, "memoryMaps", memoryMapId, "floors", currentState.floor.id, "corridors", selectedCorridor.id)); setFloors((previous) => previous.map((state) => state.floor.id !== currentState.floor.id ? state : { ...state, corridors: state.corridors.filter((corridor) => corridor.id !== selectedCorridor.id) })); setSelection(null); } catch { setSaveState("Unable to save"); }
  };

  const addCorridorPoint = (event: React.MouseEvent<HTMLDivElement>) => { if (!drawMode || !canvasRef.current) return; setDraftPoints((points) => [...points, pointFromEvent(event, canvasRef.current as HTMLDivElement)]); };
  const beginDrag = (event: React.PointerEvent<HTMLButtonElement>, roomId: string, mode: "move" | "resize") => { if (!currentState || drawMode) return; const room = currentState.rooms.find((item) => item.id === roomId); if (!room || !canvasRef.current) return; event.preventDefault(); event.stopPropagation(); const point = pointFromEvent(event.nativeEvent, canvasRef.current); setSelection({ kind: "room", id: roomId }); setDrag({ kind: "room", roomId, floorId: currentState.floor.id, mode, startX: point.x, startY: point.y, initial: room }); };
  const beginCorridorDrag = (event: React.PointerEvent<SVGGElement>, corridor: MemoryMapCorridor) => { if (!currentState || drawMode || !canvasRef.current) return; event.preventDefault(); event.stopPropagation(); const point = pointFromEvent(event.nativeEvent, canvasRef.current); setSelection({ kind: "corridor", id: corridor.id }); setDrag({ kind: "corridor", corridorId: corridor.id, floorId: currentState.floor.id, startX: point.x, startY: point.y, initial: corridor }); };

  const handleRoomKey = (event: React.KeyboardEvent<HTMLButtonElement>, room: MemoryMapRoom) => {
    if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); setSelection({ kind: "room", id: room.id }); void deleteRoom(); return; }
    const step = event.shiftKey ? 10 : 2;
    const changes = event.key === "ArrowLeft" ? { x: Math.max(0, room.x - step) } : event.key === "ArrowRight" ? { x: Math.min(CANVAS_WIDTH - room.width, room.x + step) } : event.key === "ArrowUp" ? { y: Math.max(0, room.y - step) } : event.key === "ArrowDown" ? { y: Math.min(CANVAS_HEIGHT - room.height, room.y + step) } : null;
    if (changes) { event.preventDefault(); updateRoomLocal(room.id, changes); }
  };

  const copyInvite = async () => {
    if (user?.isAnonymous) { setModal("upgrade"); return; }
    const link = `${window.location.origin}/join/${inviteCode}`;
    try { await navigator.clipboard.writeText(link); } catch { const input = document.createElement("textarea"); input.value = link; input.setAttribute("readonly", "true"); input.style.position = "fixed"; input.style.opacity = "0"; document.body.appendChild(input); input.select(); document.execCommand("copy"); input.remove(); }
    setInviteMessage("Invite link copied.");
  };

  const regenerateInvite = async () => {
    if (user?.isAnonymous) { setModal("upgrade"); return; }
    if (!db || !map || !window.confirm("Regenerate this invite link? The old link will stop working.")) return;
    try { const nextCode = await reserveInviteCode(db); const batch = writeBatch(db); batch.update(mapRefFor(db, memoryMapId), { inviteCode: nextCode, updatedAt: serverTimestamp() }); batch.update(doc(db, "inviteCodes", map.inviteCode), { active: false, updatedAt: serverTimestamp() }); batch.set(doc(db, "inviteCodes", nextCode), { memoryMapId, active: true, createdBy: user?.uid, ownerId: user?.uid, mapName: map.name, ownerName: user?.displayName ?? null, createdAt: serverTimestamp() }); await batch.commit(); setInviteCode(nextCode); setMap((previous) => previous ? { ...previous, inviteCode: nextCode } : previous); setInviteMessage("Invite link regenerated."); } catch { setInviteMessage("We could not regenerate the invite link."); }
  };

  const finishSetup = async () => {
    const allRooms = floors.flatMap((state) => state.rooms);
    if (floors.length === 0) { setDoneError("Add at least one floor before finishing."); return; }
    if (allRooms.length === 0) { setDoneError("Add at least one room before finishing."); return; }
    const unnamed = allRooms.find((room) => room.name.trim().toLowerCase() === "untitled room");
    if (unnamed) { setCurrentFloorId(floors.find((state) => state.rooms.some((room) => room.id === unnamed.id))?.floor.id ?? currentFloorId); setSelection({ kind: "room", id: unnamed.id }); setDoneError("Rename every Untitled Room before finishing."); return; }
    setDoneError(""); setModal("done");
  };

  const confirmDone = async () => {
    if (!db || !map) return;
    try { const activeMembers = members.filter((member) => member.status === "active").length || 1; await updateDoc(mapRefFor(db, memoryMapId), { status: "active", roomCount, memberCount: activeMembers, updatedAt: serverTimestamp(), completedAt: serverTimestamp() }); router.push(`/memorymaps/${memoryMapId}`); } catch { setDoneError("We could not finish this MemoryMap. Please try again."); setModal(null); }
  };

  if (authLoading || accessState === "loading") return <main className="mm-builder mm-builder--loading" aria-busy="true"><p className="sr-only" role="status" aria-live="polite">Loading your campus builder</p><div className="mm-builder-loading__bar" aria-hidden="true" /><div className="mm-builder-loading__canvas" aria-hidden="true" /><div className="mm-builder-loading__panel" aria-hidden="true" /></main>;
  if (accessState === "not-found") return <main className="mm-state-page"><h1>MemoryMap not found</h1><p>This campus may have been removed or the link is incorrect.</p><Link href="/dashboard" className="mm-button mm-button--coral">Back to dashboard</Link></main>;
  if (accessState === "denied") return <main className="mm-state-page"><h1>Setup is owner-only</h1><p>You can view a campus after joining, but only its owner can edit the places inside it.</p><Link href={`/memorymaps/${memoryMapId}`} className="mm-button mm-button--coral">Open campus</Link></main>;
  if (accessState === "error" || !map || !currentState) return <main className="mm-state-page"><h1>We could not load this builder</h1><p>Check your connection and try opening the MemoryMap again.</p><Link href="/dashboard" className="mm-button mm-button--coral">Back to dashboard</Link></main>;

  const draftPolyline = [...draftPoints, ...(cursorPoint ? [cursorPoint] : [])].map((point) => `${point.x},${point.y}`).join(" ");
  const corridorCount = floors.reduce((total, state) => total + state.corridors.length, 0);
  const builderSteps = [
    { number: 1, label: "Add a floor", complete: floors.length > 0 },
    { number: 2, label: "Place rooms", complete: roomCount > 0 },
    { number: 3, label: "Connect spaces", complete: corridorCount > 0 },
    { number: 4, label: "Finish setup", complete: map.status === "active" },
  ];
  const activeStep = builderSteps.find((step) => !step.complete)?.number ?? 4;
  const progressPercent = Math.round((builderSteps.filter((step) => step.complete).length / builderSteps.length) * 100);
  const activeRoomCount = currentState.rooms.length;
  const activeCorridorCount = currentState.corridors.length;
  return <main className="mm-builder">
    {modal === "upgrade" && <UpgradeModal onClose={() => setModal(null)} />}
    <header className="mm-builder__topbar">
      <div className="mm-builder__topbar-left"><Link href="/dashboard" className="mm-brand mm-builder__brand" aria-label="Back to dashboard"><MemoryMapLogo size={32} variant="dark" /><MemoryMapWordmark /></Link><span className="mm-builder__topbar-divider" aria-hidden="true" /><div className="mm-builder__identity"><div className="mm-builder__identity-meta"><span className="mm-builder__campus-name-label">Workspace</span><span className="mm-builder__status-pill"><i aria-hidden="true" /> Setup mode</span></div><label className="sr-only" htmlFor="campus-name">Campus name</label><input id="campus-name" className="mm-builder__campus-name" value={map.name} maxLength={80} onChange={(event) => setMap((previous) => previous ? { ...previous, name: event.target.value } : previous)} onBlur={() => void saveMapName()} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} aria-label="Campus name" /></div></div>
      <div className="mm-builder__floor-title"><span>{currentState.floor.name}</span><small aria-live="polite"><i aria-hidden="true" /> {saveState}</small><b>Step {activeStep} of 4</b></div>
      <div className="mm-builder__actions"><Link href={`/memorymaps/${memoryMapId}`} className="mm-builder__preview-action"><BuilderIcon name="preview" />Preview</Link><button type="button" className="mm-button mm-button--coral mm-builder__complete-action" onClick={() => void finishSetup()}><BuilderIcon name="check" />Complete setup</button></div>
    </header>
    <div className="mm-builder__body">
      <aside className="mm-builder__tools" aria-label="Campus builder tools"><span className="mm-builder__tools-label">Build this place</span><button type="button" onClick={() => setModal("floor")}>＋ Add floor</button><button type="button" onClick={() => void addRoom()}>＋ Add room</button><button type="button" onClick={() => { setDrawMode(true); setDrawStyle("stairs"); setDraftPoints([]); setSelection(null); }}>+ Add stairs</button><button type="button" aria-pressed={drawMode} className={drawMode ? "is-active" : ""} onClick={() => { setDrawMode(true); setDrawStyle("solid"); setDraftPoints([]); setSelection(null); }}>⌁ Add corridor</button><button type="button" onClick={() => { if (user?.isAnonymous) { setModal("upgrade"); return; } setModal("invite"); }}>＋ Add members</button><button type="button" className="mm-builder__done-tool" onClick={() => void finishSetup()}>Done</button></aside>
      <section className={`mm-builder__workspace${drawMode ? " is-drawing" : ""}`} aria-label="Campus design workspace">
        <div className="mm-builder__workspace-heading"><div><span className="mm-builder__eyebrow">Canvas</span><h1>Shape the places that matter</h1><p>Place the rooms and paths your group will want to remember.</p></div><div className="mm-builder__canvas-stats"><span><strong>{floors.length}</strong> {floors.length === 1 ? "floor" : "floors"}</span><span><strong>{roomCount}</strong> {roomCount === 1 ? "room" : "rooms"}</span><span><strong>{corridorCount}</strong> {corridorCount === 1 ? "connection" : "connections"}</span></div></div>
        <div className="mm-builder__progress-steps" aria-label={`Setup progress: ${progressPercent}% complete`}>{builderSteps.map((step) => <span className={step.complete ? "is-complete" : step.number === activeStep ? "is-active" : ""} key={step.number}><b>{step.complete ? "✓" : step.number}</b>{step.label}</span>)}</div>
        <div className="mm-builder__floor-tabs" role="tablist" aria-label="Floors">{floors.map((state) => <button type="button" role="tab" aria-selected={state.floor.id === currentFloorId} key={state.floor.id} onClick={() => { setCurrentFloorId(state.floor.id); setSelection(null); }}>{state.floor.name}</button>)}</div>
        <div className="mm-builder__canvas-shell"><div className="mm-builder__canvas-toolbar"><span><i aria-hidden="true" /> {drawMode ? "Drawing mode" : "Select and arrange"}</span><small>{drawMode ? "Click points, then press Enter to finish" : "Drag rooms to place them · drag the corner to resize"}</small></div><div ref={canvasRef} className="mm-builder__canvas" tabIndex={0} onClick={addCorridorPoint} onDoubleClick={() => void finishCorridor()} onMouseMove={(event) => { if (drawMode && canvasRef.current) setCursorPoint(pointFromEvent(event, canvasRef.current)); }} onKeyDown={(event) => { if (drawMode && event.key === "Enter") void finishCorridor(); }}>
          {activeRoomCount === 0 && activeCorridorCount === 0 && !drawMode && <div className="mm-builder__canvas-empty"><div className="mm-builder__canvas-empty-art"><BuilderIcon name="layout" /></div><strong>Start building this place</strong><p>Add rooms, corridors and the spaces people remember.</p><button type="button" className="mm-button mm-button--coral mm-button--small" onClick={(event) => { event.stopPropagation(); void addRoom(); }}>Add your first room</button></div>}
          <span className="mm-builder__canvas-label">{drawMode ? "Click to place points · Enter or double-click to finish · Escape to cancel" : "Ground plan · place rooms where the memories happened"}</span>
          <svg className="mm-builder__corridors" viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} aria-hidden="true">{currentState.corridors.map((corridor) => <g key={corridor.id} onPointerDown={(event) => beginCorridorDrag(event, corridor)} onClick={(event) => { event.stopPropagation(); if (!drawMode) setSelection({ kind: "corridor", id: corridor.id }); }} className={selection?.kind === "corridor" && selection.id === corridor.id ? "is-selected" : ""}><polyline points={corridor.points.map((point) => `${point.x},${point.y}`).join(" ")} className={`mm-builder-corridor mm-builder-corridor--${corridor.style}`} style={{ strokeWidth: corridor.width }} /><text x={corridor.points[0]?.x ?? 0} y={(corridor.points[0]?.y ?? 0) - 10}>{corridor.label}</text></g>)}{draftPolyline && <polyline points={draftPolyline} className="mm-builder-corridor mm-builder-corridor--draft" />}</svg>
          {currentState.rooms.map((room) => <RoomNode key={room.id} room={room} preview={false} selected={selection?.kind === "room" && selection.id === room.id} onSelect={() => { if (!drawMode) setSelection({ kind: "room", id: room.id }); }} onPointerDown={(event, mode) => beginDrag(event, room.id, mode)} onKeyDown={(event) => handleRoomKey(event, room)} />)}
        </div><div className="mm-builder__canvas-footer"><span><kbd>Esc</kbd> cancel drawing</span><span><kbd>Shift</kbd> + drag for precise placement</span><span>{currentState.floor.name} · {activeRoomCount} rooms</span></div></div>
      </section>
      <aside className="mm-builder__inspector" aria-label="Selection inspector">{selectedRoom ? <><span className="mm-builder__tools-label">Selected room</span><label>Room name<input value={selectedRoom.name} onChange={(event) => updateRoomLocal(selectedRoom.id, { name: event.target.value.slice(0, 80) })} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label><label>Room type<select value={selectedRoom.type} onChange={(event) => updateRoomLocal(selectedRoom.id, { type: event.target.value as RoomType })}>{roomTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><span className="mm-builder__field-label">Accent</span><div className="mm-builder__accent-list">{accents.map((accent) => <button type="button" key={accent} aria-pressed={selectedRoom.accent === accent} className={`mm-builder__accent mm-builder__accent--${accent}`} onClick={() => updateRoomLocal(selectedRoom.id, { accent })}>{accent}</button>)}</div><button type="button" className="mm-builder__text-button" onClick={() => void duplicateRoom()}>Duplicate room</button><button type="button" className="mm-builder__danger-button" onClick={() => void deleteRoom()}>Delete room</button></> : selectedCorridor ? <><span className="mm-builder__tools-label">Selected corridor</span><label>Corridor label<input value={selectedCorridor.label} onChange={(event) => { const value = event.target.value; setFloors((previous) => previous.map((state) => state.floor.id !== currentState.floor.id ? state : { ...state, corridors: state.corridors.map((corridor) => corridor.id === selectedCorridor.id ? { ...corridor, label: value } : corridor) })); }} onBlur={async () => { if (db) await updateDoc(doc(db, "memoryMaps", memoryMapId, "floors", currentState.floor.id, "corridors", selectedCorridor.id), { label: selectedCorridor.label, updatedAt: serverTimestamp() }); }} /></label><label>Width<input type="range" min="6" max="30" value={selectedCorridor.width} onChange={(event) => { const width = Number(event.target.value); setFloors((previous) => previous.map((state) => state.floor.id !== currentState.floor.id ? state : { ...state, corridors: state.corridors.map((corridor) => corridor.id === selectedCorridor.id ? { ...corridor, width } : corridor) })); }} onMouseUp={() => { if (db) void updateDoc(doc(db, "memoryMaps", memoryMapId, "floors", currentState.floor.id, "corridors", selectedCorridor.id), { width: selectedCorridor.width, updatedAt: serverTimestamp() }); }} /></label><button type="button" className="mm-builder__danger-button" onClick={() => void deleteCorridor()}>Delete corridor</button></> : <><span className="mm-builder__tools-label">Floor settings</span><label>Floor name<input value={currentState.floor.name} onChange={(event) => setFloors((previous) => previous.map((state) => state.floor.id === currentState.floor.id ? { ...state, floor: { ...state.floor, name: event.target.value } } : state))} onBlur={async () => { if (db && currentState.floor.name.trim().length >= 2) await updateDoc(doc(db, "memoryMaps", memoryMapId, "floors", currentState.floor.id), { name: currentState.floor.name.trim(), updatedAt: serverTimestamp() }); }} /></label><button type="button" className="mm-builder__danger-button" disabled={floors.length <= 1} onClick={() => void deleteFloor()}>Delete floor</button><p className="mm-builder__hint">Select a room to edit its label, type, colour, position or size.</p></>}
      </aside>
    </div>
    {modal === "floor" && <div className="mm-builder-modal" role="dialog" aria-modal="true" aria-labelledby="floor-modal-title"><div><p className="mm-eyebrow mm-eyebrow--ochre">Add a floor</p><h2 id="floor-modal-title">Where does this place begin?</h2><form onSubmit={addFloor}><label>Floor name<input value={floorName} onChange={(event) => setFloorName(event.target.value.slice(0, 50))} placeholder="First Floor" autoFocus /></label><small>Try Ground Floor, First Floor, Sports Area or another name your group uses.</small><div className="mm-builder-modal__actions"><button type="button" className="mm-button mm-button--outline" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="mm-button mm-button--coral">Add floor</button></div></form></div></div>}
    {modal === "invite" && <div className="mm-builder-modal" role="dialog" aria-modal="true" aria-labelledby="invite-modal-title"><div><p className="mm-eyebrow mm-eyebrow--ochre">Private access</p><h2 id="invite-modal-title">Invite people to this MemoryMap</h2><p>Only people with your invite link can request or receive access.</p><div className="mm-builder-invite-link"><code>{typeof window === "undefined" ? "" : `${window.location.origin}/join/${inviteCode}`}</code><button type="button" className="mm-button mm-button--coral mm-button--small" onClick={() => void copyInvite()}>Copy link</button></div><button type="button" className="mm-builder__text-button" onClick={() => void regenerateInvite()}>Regenerate link</button>{inviteMessage && <p className="mm-auth-message" role="status" aria-live="polite">{inviteMessage}</p>}<h3>Current members <span>{members.filter((member) => member.status === "active").length}</span></h3><ul className="mm-builder-members">{members.map((member) => <li key={member.id}><span>{(member.displayName || member.email || "MM").slice(0, 2).toUpperCase()}</span><div><strong>{member.displayName || member.email || "MemoryMap member"}</strong><small>{member.role === "owner" ? "Owner" : "Member"}</small></div></li>)}</ul><button type="button" className="mm-button mm-button--outline" onClick={() => setModal(null)}>Close</button></div></div>}
    {modal === "done" && <div className="mm-builder-modal" role="dialog" aria-modal="true" aria-labelledby="done-modal-title"><div><p className="mm-eyebrow mm-eyebrow--ochre">One last check</p><h2 id="done-modal-title">Finish setting up this MemoryMap?</h2><p>Your campus will be saved and opened in memory mode. You can return to setup later as the owner.</p>{doneError && <p className="mm-auth-message mm-auth-message--error" role="alert">{doneError}</p>}<div className="mm-builder-modal__actions"><button type="button" className="mm-button mm-button--outline" onClick={() => setModal(null)}>Continue editing</button><button type="button" className="mm-button mm-button--coral" onClick={() => void confirmDone()}>Finish and open campus</button></div></div></div>}
  </main>;
}
