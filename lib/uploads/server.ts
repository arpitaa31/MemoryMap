import { NextResponse } from "next/server";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const FIREBASE_LOOKUP_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";
const FIRESTORE_API_URL = "https://firestore.googleapis.com/v1";
const HACKCLUB_UPLOAD_URL = "https://cdn.hackclub.com/api/v4/upload";

type JsonRecord = Record<string, unknown>;

export type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: null;
  timestampValue?: string;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
};

type FirestoreDocumentResponse = {
  fields?: Record<string, FirestoreValue>;
};

export type VerifiedRequest = {
  idToken: string;
  uid: string;
  isAnonymous: boolean;
};

export type CdnUploadMetadata = {
  id: string;
  url: string;
  filename: string;
  size: number;
  contentType: (typeof ALLOWED_IMAGE_TYPES)[number];
};

export type CdnOperationFailure = {
  kind: "missing-key" | "network" | "upstream" | "invalid-response";
  status?: number;
};

export type CdnOperationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: CdnOperationFailure };

export type FirestoreReadResult =
  | { ok: true; data: JsonRecord }
  | { ok: false; kind: "not-found" | "request-failed"; status?: number };

export type FirestorePatchResult =
  | { ok: true }
  | { ok: false; status?: number };

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization || !authorization.toLowerCase().startsWith("bearer ")) return null;

  const token = authorization.slice(7).trim();
  return token && token.length <= 4096 ? token : null;
}

export async function authenticateRequest(request: Request): Promise<
  | { ok: true; request: VerifiedRequest }
  | { ok: false; response: NextResponse }
> {
  const idToken = getBearerToken(request);
  if (!idToken) {
    return { ok: false, response: NextResponse.json({ error: "Sign-in is required." }, { status: 401 }) };
  }

  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!firebaseApiKey) {
    return { ok: false, response: NextResponse.json({ error: "Authentication is not configured." }, { status: 503 }) };
  }

  try {
    const response = await fetch(`${FIREBASE_LOOKUP_URL}?key=${encodeURIComponent(firebaseApiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
    });

    if (!response.ok) {
      return { ok: false, response: NextResponse.json({ error: "Your sign-in session is no longer valid." }, { status: 401 }) };
    }

    const payload = await readJson(response);
    const users = isRecord(payload) && Array.isArray(payload.users) ? payload.users : [];
    const firebaseUser = users[0];
    const uid = isRecord(firebaseUser) && typeof firebaseUser.localId === "string" ? firebaseUser.localId : null;
    const disabled = isRecord(firebaseUser) && firebaseUser.disabled === true;
    const providerUserInfo = isRecord(firebaseUser) && Array.isArray(firebaseUser.providerUserInfo) ? firebaseUser.providerUserInfo : [];
    const isAnonymous = isRecord(firebaseUser) && !firebaseUser.email && providerUserInfo.length === 0;

    if (!uid) {
      return { ok: false, response: NextResponse.json({ error: "Your sign-in session is no longer valid." }, { status: 401 }) };
    }

    if (disabled) {
      return { ok: false, response: NextResponse.json({ error: "This account is disabled." }, { status: 403 }) };
    }

    return { ok: true, request: { idToken, uid, isAnonymous } };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Authentication could not be verified." }, { status: 503 }) };
  }
}

function firestoreDocumentUrl(path: string) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;

  const encodedPath = path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `${FIRESTORE_API_URL}/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodedPath}`;
}

function decodeFirestoreValue(value: FirestoreValue): unknown {
  if (typeof value.stringValue === "string") return value.stringValue;
  if (typeof value.integerValue === "string") return Number(value.integerValue);
  if (typeof value.doubleValue === "number") return value.doubleValue;
  if (typeof value.booleanValue === "boolean") return value.booleanValue;
  if (value.nullValue === null) return null;
  if (typeof value.timestampValue === "string") return value.timestampValue;
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(decodeFirestoreValue);
  if (value.mapValue) return decodeFirestoreFields(value.mapValue.fields ?? {});
  return undefined;
}

function decodeFirestoreFields(fields: Record<string, FirestoreValue>) {
  const data: JsonRecord = {};
  for (const [key, value] of Object.entries(fields)) {
    const decoded = decodeFirestoreValue(value);
    if (decoded !== undefined) data[key] = decoded;
  }
  return data;
}

export async function getFirestoreDocument(path: string, idToken: string): Promise<FirestoreReadResult> {
  const url = firestoreDocumentUrl(path);
  if (!url) return { ok: false, kind: "request-failed" };

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
    });

    if (response.status === 404) return { ok: false, kind: "not-found", status: 404 };
    if (!response.ok) return { ok: false, kind: "request-failed", status: response.status };

    const payload = await readJson(response);
    if (!isRecord(payload)) return { ok: false, kind: "request-failed", status: 502 };

    const document = payload as FirestoreDocumentResponse;
    return { ok: true, data: decodeFirestoreFields(document.fields ?? {}) };
  } catch {
    return { ok: false, kind: "request-failed" };
  }
}

export async function patchFirestoreDocument(
  path: string,
  idToken: string,
  fields: Record<string, FirestoreValue>,
  updateMask: string[],
): Promise<FirestorePatchResult> {
  const url = firestoreDocumentUrl(path);
  if (!url) return { ok: false };

  const requestUrl = new URL(url);
  for (const fieldPath of updateMask) {
    requestUrl.searchParams.append("updateMask.fieldPaths", fieldPath);
  }

  try {
    const response = await fetch(requestUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
      cache: "no-store",
    });

    return response.ok ? { ok: true } : { ok: false, status: response.status };
  } catch {
    return { ok: false };
  }
}

function isActiveMember(mapData: JsonRecord, uid: string) {
  if (mapData.ownerId === uid) return true;

  if (Array.isArray(mapData.memberIds) && mapData.memberIds.some((memberId) => memberId === uid)) {
    return true;
  }

  if (Array.isArray(mapData.members)) {
    return mapData.members.some((member) => {
      if (member === uid) return true;
      if (!isRecord(member)) return false;
      const memberId = member.uid ?? member.userId ?? member.id;
      return memberId === uid && (member.status === undefined || member.status === "active");
    });
  }

  if (isRecord(mapData.members)) {
    const membership = mapData.members[uid];
    if (membership === true) return true;
    return isRecord(membership) && (membership.status === undefined || membership.status === "active");
  }

  return false;
}

export async function requireMemoryMapAccess(
  memoryMapId: string,
  idToken: string,
  uid: string,
): Promise<
  | { ok: true; mapData: JsonRecord; isOwner: boolean }
  | { ok: false; response: NextResponse }
> {
  const result = await getFirestoreDocument(`memoryMaps/${memoryMapId}`, idToken);
  if (!result.ok) {
    const status = result.kind === "request-failed" && result.status !== 403 ? 503 : 404;
    return { ok: false, response: NextResponse.json({ error: "MemoryMap not found or inaccessible." }, { status }) };
  }

  if (!isActiveMember(result.data, uid)) {
    return { ok: false, response: NextResponse.json({ error: "You do not have access to this MemoryMap." }, { status: 403 }) };
  }

  return { ok: true, mapData: result.data, isOwner: result.data.ownerId === uid };
}

function allowedContentType(value: unknown): value is (typeof ALLOWED_IMAGE_TYPES)[number] {
  return typeof value === "string" && (ALLOWED_IMAGE_TYPES as readonly string[]).includes(value);
}

function safeCdnUrl(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("https://cdn.hackclub.com/")) return null;
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function parseCdnSize(value: unknown) {
  const size = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(size) && size > 0 && size <= MAX_IMAGE_BYTES ? size : null;
}

export async function uploadToHackClubCdn(file: File): Promise<CdnOperationResult<CdnUploadMetadata>> {
  const apiKey = process.env.HACKCLUB_CDN_API_KEY;
  if (!apiKey) {
    console.error("Hack Club CDN upload failed", { stage: "configuration", status: 401, responseBody: "missing API key", fileName: file.name, fileSize: file.size, fileType: file.type });
    return { ok: false, error: { kind: "missing-key", status: 401 } };
  }

  const safeFilename = (file.name || "memory-image").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "memory-image";
  const cdnFormData = new FormData();
  cdnFormData.append("file", file, safeFilename);

  let response: Response;
  try {
    response = await fetch(HACKCLUB_UPLOAD_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: cdnFormData,
      cache: "no-store",
    });
  } catch (error) {
    console.error("Hack Club CDN upload failed", { stage: "network", status: undefined, responseBody: error instanceof Error ? error.message : "network error", fileName: safeFilename, fileSize: file.size, fileType: file.type });
    return { ok: false, error: { kind: "network" } };
  }

  const responseText = await response.text();
  let responseBody: unknown = responseText.slice(0, 1000);
  try { responseBody = JSON.parse(responseText); } catch { /* keep a bounded text body */ }
  if (!response.ok) {
    console.error("Hack Club CDN upload failed", { stage: "upstream", status: response.status, responseBody, fileName: safeFilename, fileSize: file.size, fileType: file.type });
    return { ok: false, error: { kind: "upstream", status: response.status } };
  }

  let payload: unknown = null;
  try { payload = JSON.parse(responseText); } catch { payload = null; }
  if (!isRecord(payload)) return { ok: false, error: { kind: "invalid-response" } };

  const id = typeof payload.id === "string" ? payload.id : null;
  const url = safeCdnUrl(payload.url);
  const filename = typeof payload.filename === "string" && payload.filename ? payload.filename : null;
  const size = parseCdnSize(payload.size);
  const contentType = allowedContentType(payload.content_type) ? payload.content_type : null;

  if (!id || !url || !filename || !size || !contentType) {
    console.error("Hack Club CDN upload failed", { stage: "response-mapping", status: response.status, responseBody, fileName: safeFilename, fileSize: file.size, fileType: file.type });
    return { ok: false, error: { kind: "invalid-response" } };
  }

  return { ok: true, data: { id, url, filename, size, contentType } };
}

export async function deleteFromHackClubCdn(uploadId: string): Promise<CdnOperationResult<null>> {
  const apiKey = process.env.HACKCLUB_CDN_API_KEY;
  if (!apiKey) return { ok: false, error: { kind: "missing-key" } };

  try {
    const response = await fetch(`${HACKCLUB_UPLOAD_URL}/${encodeURIComponent(uploadId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (!response.ok) return { ok: false, error: { kind: "upstream", status: response.status } };
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { kind: "network" } };
  }
}

export function cdnErrorResponse(failure: CdnOperationFailure, operation: "upload" | "delete") {
  if (failure.kind === "missing-key") {
    return NextResponse.json({ error: "The image service is not configured correctly." }, { status: 401 });
  }

  if (failure.kind === "network") {
    return NextResponse.json({ error: "The image service is temporarily unavailable." }, { status: 500 });
  }

  if (failure.kind === "invalid-response") {
    return NextResponse.json({ error: "The image service is temporarily unavailable." }, { status: 500 });
  }

  switch (failure.status) {
    case 400:
      return NextResponse.json({ error: `${operation === "delete" ? "The deletion" : "The upload"} request was rejected.` }, { status: 502 });
    case 401:
      return NextResponse.json({ error: "The image-service API key was rejected." }, { status: 401 });
    case 402:
      return NextResponse.json({ error: "The image-storage quota has been reached." }, { status: 402 });
    case 404:
      return NextResponse.json({ error: "The requested upload was not found." }, { status: 404 });
    case 422:
      return NextResponse.json({ error: "The image service rejected this file." }, { status: 422 });
    default:
      return NextResponse.json({ error: "The image service is temporarily unavailable." }, { status: 500 });
  }
}

export function imageFirestoreFields(metadata: CdnUploadMetadata, uid: string): Record<string, FirestoreValue> {
  return {
    imageUrl: { stringValue: metadata.url },
    imageUploadId: { stringValue: metadata.id },
    imageFilename: { stringValue: metadata.filename },
    imageSize: { integerValue: String(metadata.size) },
    imageContentType: { stringValue: metadata.contentType },
    imageUploaderId: { stringValue: uid },
  };
}
