import { Timestamp } from "firebase/firestore";
import type { DocumentData, DocumentSnapshot, QueryDocumentSnapshot } from "firebase/firestore";
import type { MemoryDocument, MemoryMapCorridor, MemoryMapDocument, MemoryMapFloor, MemoryMapMember, MemoryMapRoom } from "../../types/memory-map";

function stringOr(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function timestampOrUndefined(value: unknown) {
  return value instanceof Timestamp ? value : undefined;
}

function timestampOrNull(value: unknown) {
  return value instanceof Timestamp ? value : null;
}

function dataOf(snapshot: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>) {
  return snapshot.data() ?? {};
}

export function parseFloor(snapshot: QueryDocumentSnapshot<DocumentData>): MemoryMapFloor {
  const data = dataOf(snapshot);
  return { id: snapshot.id, name: stringOr(data.name, "Untitled Floor"), order: numberOr(data.order, 0), createdAt: timestampOrUndefined(data.createdAt), updatedAt: timestampOrUndefined(data.updatedAt) };
}

export function parseMemoryMap(snapshot: DocumentSnapshot<DocumentData>): MemoryMapDocument | null {
  if (!snapshot.exists()) return null;
  const data = dataOf(snapshot);
  return {
    id: snapshot.id,
    name: stringOr(data.name, "Untitled MemoryMap"),
    ownerId: stringOr(data.ownerId, ""),
    ownerName: nullableString(data.ownerName),
    ownerEmail: nullableString(data.ownerEmail),
    privacy: "private",
    status: data.status === "active" ? "active" : "setup",
    inviteCode: stringOr(data.inviteCode, ""),
    roomCount: numberOr(data.roomCount, 0), memoryCount: numberOr(data.memoryCount, 0), memberCount: numberOr(data.memberCount, 1),
    createdAt: timestampOrUndefined(data.createdAt), updatedAt: timestampOrUndefined(data.updatedAt), completedAt: timestampOrUndefined(data.completedAt),
  };
}

export function parseRoom(snapshot: QueryDocumentSnapshot<DocumentData>): MemoryMapRoom {
  const data = dataOf(snapshot);
  const rotation = data.rotation === 0 ? 0 : 0;
  return {
    id: snapshot.id,
    name: stringOr(data.name, "Untitled Room"),
    type: data.type === "classroom" || data.type === "laboratory" || data.type === "library" || data.type === "auditorium" || data.type === "sports" || data.type === "office" || data.type === "canteen" ? data.type : "other",
    accent: data.accent === "coral" || data.accent === "green" || data.accent === "yellow" || data.accent === "teal" ? data.accent : "neutral",
    x: numberOr(data.x, 36), y: numberOr(data.y, 36), width: numberOr(data.width, 180), height: numberOr(data.height, 110), rotation,
    order: numberOr(data.order, 0), createdAt: timestampOrUndefined(data.createdAt), updatedAt: timestampOrUndefined(data.updatedAt),
  };
}

export function parseCorridor(snapshot: QueryDocumentSnapshot<DocumentData>): MemoryMapCorridor {
  const data = dataOf(snapshot);
  const points = Array.isArray(data.points) ? data.points.flatMap((point) => {
    if (!point || typeof point !== "object") return [];
    const value = point as Record<string, unknown>;
    return typeof value.x === "number" && typeof value.y === "number" ? [{ x: value.x, y: value.y }] : [];
  }) : [];
  return { id: snapshot.id, label: stringOr(data.label, "Corridor"), points, width: numberOr(data.width, 14), style: data.style === "dashed" ? "dashed" : "solid", createdAt: timestampOrUndefined(data.createdAt), updatedAt: timestampOrUndefined(data.updatedAt) };
}

export function parseMember(snapshot: QueryDocumentSnapshot<DocumentData>): MemoryMapMember {
  const data = dataOf(snapshot);
  return { id: snapshot.id, userId: stringOr(data.userId, snapshot.id), displayName: nullableString(data.displayName), email: nullableString(data.email), photoURL: nullableString(data.photoURL), role: data.role === "member" ? "member" : "owner", status: data.status === "inactive" ? "inactive" : "active", joinedAt: timestampOrUndefined(data.joinedAt) };
}

export function parseMemory(snapshot: QueryDocumentSnapshot<DocumentData>): MemoryDocument {
  const data = dataOf(snapshot);
  return {
    id: snapshot.id, memoryMapId: stringOr(data.memoryMapId, ""), floorId: stringOr(data.floorId, ""), roomId: stringOr(data.roomId, ""), createdBy: stringOr(data.createdBy, ""), creatorName: nullableString(data.creatorName), type: data.type === "image" ? "image" : "incident", title: stringOr(data.title, "Untitled memory"), description: stringOr(data.description, ""), eventDate: timestampOrNull(data.eventDate), tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === "string") : [], imageUrl: nullableString(data.imageUrl), imageUploadId: nullableString(data.imageUploadId), imageFilename: nullableString(data.imageFilename), imageSize: typeof data.imageSize === "number" ? data.imageSize : null, imageContentType: nullableString(data.imageContentType), createdAt: timestampOrUndefined(data.createdAt), updatedAt: timestampOrUndefined(data.updatedAt),
  };
}
