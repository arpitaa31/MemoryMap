import type { Timestamp } from "firebase/firestore";

export type MemoryMapStatus = "setup" | "active";
export type MemoryType = "incident" | "image";
export type RoomType = "classroom" | "laboratory" | "library" | "auditorium" | "sports" | "office" | "canteen" | "stairs" | "other";
export type RoomAccent = "coral" | "green" | "yellow" | "teal" | "neutral";
export type CorridorStyle = "solid" | "dashed" | "stairs";

export type MemoryMapDocument = {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerType?: "guest" | "registered";
  privacy: "private";
  status: MemoryMapStatus;
  inviteCode: string;
  roomCount: number;
  memoryCount: number;
  memberCount: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  completedAt?: Timestamp;
};

export type MemoryMapMember = {
  id: string;
  userId: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role: "owner" | "member";
  status: "active" | "inactive";
  joinedAt?: Timestamp;
};

export type MemoryMapFloor = {
  id: string;
  name: string;
  order: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type MemoryMapRoom = {
  id: string;
  name: string;
  type: RoomType;
  accent: RoomAccent;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: 0;
  order: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type MemoryMapPoint = { x: number; y: number };

export type MemoryMapCorridor = {
  id: string;
  label: string;
  points: MemoryMapPoint[];
  width: number;
  style: CorridorStyle;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type MemoryDocument = {
  id: string;
  memoryMapId: string;
  floorId: string;
  roomId: string;
  createdBy: string;
  creatorName: string | null;
  type: MemoryType;
  title: string;
  description: string;
  eventDate?: Timestamp | null;
  tags: string[];
  imageUrl: string | null;
  imageUploadId: string | null;
  imageFilename: string | null;
  imageSize: number | null;
  imageContentType: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type SafeImageUploadResult = {
  id: string;
  url: string;
  filename: string;
  size: number;
  content_type: "image/jpeg" | "image/png" | "image/webp";
};

export type ApiErrorResponse = { error: string };
