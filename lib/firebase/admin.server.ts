import type { App } from "firebase-admin/app";

// This module is server-only: it is imported only by route handlers and never by client components.
let adminApp: App | null = null;
let adminAppPromise: Promise<App> | null = null;

async function getAdminApp() {
  const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  const privateKey = rawPrivateKey
    ?.trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");

  console.log("Firebase Admin configuration", {
    hasProjectId: Boolean(process.env.FIREBASE_ADMIN_PROJECT_ID),
    hasClientEmail: Boolean(process.env.FIREBASE_ADMIN_CLIENT_EMAIL),
    hasPrivateKey: Boolean(rawPrivateKey),
    privateKeyLooksValid:
      privateKey?.includes("BEGIN PRIVATE KEY") === true &&
      privateKey.includes("END PRIVATE KEY"),
  });

  if (adminApp) return adminApp;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();

  if (!projectId || !clientEmail || !rawPrivateKey) {
    throw new Error("Firebase Admin credentials are not configured.");
  }

  if (!privateKey?.includes("BEGIN PRIVATE KEY") || !privateKey.includes("END PRIVATE KEY")) {
    throw new Error("Firebase Admin private key is invalid.");
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
