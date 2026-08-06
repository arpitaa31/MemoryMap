import type { App } from "firebase-admin/app";

// This module is server-only: it is imported only by route handlers and never by client components.
let adminApp: App | null = null;
let adminAppPromise: Promise<App> | null = null;

function configurationError(code: "missing-config" | "invalid-private-key" | "project-mismatch", message: string) {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

async function getAdminApp() {
  const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  const privateKey = rawPrivateKey
    ?.trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");

  if (adminApp) return adminApp;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const frontendProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();

  if (!projectId || !clientEmail || !rawPrivateKey) {
    throw configurationError("missing-config", "Firebase Admin credentials are not configured.");
  }

  if (!frontendProjectId || frontendProjectId !== projectId) {
    throw configurationError("project-mismatch", "Firebase frontend and Admin projects do not match.");
  }

  if (!clientEmail.endsWith(`@${projectId}.iam.gserviceaccount.com`)) {
    throw configurationError("project-mismatch", "Firebase Admin client email does not belong to the configured project.");
  }

  if (!privateKey?.includes("BEGIN PRIVATE KEY") || !privateKey.includes("END PRIVATE KEY")) {
    throw configurationError("invalid-private-key", "Firebase Admin private key is invalid.");
  }

  if (!adminAppPromise) {
    adminAppPromise = (async () => {
      const { cert, getApps, initializeApp } = await import("firebase-admin/app");
      const existing = getApps()[0];
      if (existing) return existing;
      return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    })().catch((error) => {
      adminAppPromise = null;
      throw error;
    });
  }

  adminApp = await adminAppPromise;
  return adminApp;
}

export async function getAdminServices() {
  const app = await getAdminApp();
  const [{ getAuth }, { getFirestore }] = await Promise.all([
    import("firebase-admin/auth"),
    import("firebase-admin/firestore"),
  ]);
  return { auth: getAuth(app), firestore: getFirestore(app) };
}
