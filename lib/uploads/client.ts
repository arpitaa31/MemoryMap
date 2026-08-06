"use client";

import { auth } from "../firebase/client";

export type MemoryImageUpload = {
  id: string;
  url: string;
  filename: string;
  size: number;
  contentType: "image/jpeg" | "image/png" | "image/webp";
};

export type CampusCoverImage = {
  url: string;
  storageId: string;
  position: "top" | "center" | "bottom";
};

async function readUploadResponse(response: Response) {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "The image request could not be completed.";
    throw new Error(message);
  }

  return payload;
}

function isMemoryImageUpload(value: unknown): value is MemoryImageUpload {
  if (typeof value !== "object" || value === null) return false;
  const payload = value as Record<string, unknown>;
  return typeof payload.id === "string"
    && typeof payload.url === "string"
    && typeof payload.filename === "string"
    && typeof payload.size === "number"
    && (payload.contentType === "image/jpeg" || payload.contentType === "image/png" || payload.contentType === "image/webp");
}

async function getIdToken() {
  const user = auth?.currentUser;
  if (!user) throw new Error("You must be signed in to upload an image.");
  return user.getIdToken();
}

function isCampusCoverImage(value: unknown): value is CampusCoverImage {
  if (typeof value !== "object" || value === null) return false;
  const payload = value as Record<string, unknown>;
  return typeof payload.url === "string"
    && typeof payload.storageId === "string"
    && (payload.position === "top" || payload.position === "center" || payload.position === "bottom");
}

export async function uploadCampusCover(file: File, memoryMapId: string, position: CampusCoverImage["position"]) {
  const idToken = await getIdToken();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("position", position);
  const response = await fetch(`/api/memorymaps/${encodeURIComponent(memoryMapId)}/cover-image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
    body: formData,
  });
  const payload = await readUploadResponse(response);
  if (!isCampusCoverImage(typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>).coverImage : null)) {
    throw new Error("The cover photo response was invalid.");
  }
  return (payload as { coverImage: CampusCoverImage }).coverImage;
}

export async function deleteCampusCover(memoryMapId: string) {
  const idToken = await getIdToken();
  const response = await fetch(`/api/memorymaps/${encodeURIComponent(memoryMapId)}/cover-image`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  await readUploadResponse(response);
}

export async function updateCampusCoverPosition(memoryMapId: string, position: CampusCoverImage["position"], url: string, storageId: string) {
  const idToken = await getIdToken();
  const response = await fetch(`/api/memorymaps/${encodeURIComponent(memoryMapId)}/cover-image`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ position, url, storageId }),
  });
  const payload = await readUploadResponse(response);
  if (!isCampusCoverImage(typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>).coverImage : null)) throw new Error("The cover photo response was invalid.");
  return (payload as { coverImage: CampusCoverImage }).coverImage;
}

export async function uploadMemoryImage(file: File, memoryMapId: string, memoryId: string, floorId: string, roomId: string) {
  const idToken = await getIdToken();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("memoryMapId", memoryMapId);
  formData.append("memoryId", memoryId);
  formData.append("floorId", floorId);
  formData.append("roomId", roomId);

  const response = await fetch(`/api/memorymaps/${encodeURIComponent(memoryMapId)}/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
    body: formData,
  });
  const payload = await readUploadResponse(response);

  if (!isMemoryImageUpload(payload)) throw new Error("The upload response was invalid.");
  return payload;
}

export async function deleteMemoryImage(uploadId: string, memoryMapId: string, memoryId: string) {
  const idToken = await getIdToken();
  const response = await fetch(`/api/memorymaps/${encodeURIComponent(memoryMapId)}/images/${encodeURIComponent(uploadId)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ memoryMapId, memoryId }),
  });
  await readUploadResponse(response);
}
