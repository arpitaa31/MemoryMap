"use client";

import { auth } from "../firebase/client";

export type MemoryImageUpload = {
  id: string;
  url: string;
  filename: string;
  size: number;
  content_type: "image/jpeg" | "image/png" | "image/webp";
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
    && (payload.content_type === "image/jpeg" || payload.content_type === "image/png" || payload.content_type === "image/webp");
}

async function getIdToken() {
  const user = auth?.currentUser;
  if (!user) throw new Error("You must be signed in to upload an image.");
  return user.getIdToken();
}

export async function uploadMemoryImage(file: File, memoryMapId: string, memoryId: string) {
  const idToken = await getIdToken();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("memoryMapId", memoryMapId);
  formData.append("memoryId", memoryId);

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
