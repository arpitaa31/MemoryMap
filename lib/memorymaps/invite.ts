import { doc, getDoc, type Firestore } from "firebase/firestore";

export function createInviteCode() {
  const raw = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID().replace(/-/g, "")
    : Array.from(crypto.getRandomValues(new Uint32Array(4)), (part) => part.toString(36)).join("");
  return `MM-${raw.slice(0, 4)}-${raw.slice(4, 8)}`.toUpperCase();
}

export async function reserveInviteCode(db: Firestore) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = createInviteCode();
    if (!(await getDoc(doc(db, "inviteCodes", code))).exists()) return code;
  }
  throw new Error("Could not reserve an invite code.");
}
