import { GoogleAuthProvider, linkWithPopup, type User } from "firebase/auth";
import { collection, getDocs, query, where, writeBatch } from "firebase/firestore";
import { assertFirebaseConfig, auth, db } from "../firebase/client";

export async function linkCurrentUserToGoogle(user: User) {
  assertFirebaseConfig();
  if (!auth || !db || auth.currentUser?.uid !== user.uid || !user.isAnonymous) {
    throw new Error("Only the current anonymous session can be linked.");
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await linkWithPopup(user, provider);
  const ownedMaps = await getDocs(query(collection(db, "memoryMaps"), where("ownerId", "==", user.uid)));
  const batch = writeBatch(db);
  ownedMaps.docs.forEach((memoryMap) => {
    batch.update(memoryMap.ref, {
      ownerType: "registered",
      ownerName: credential.user.displayName ?? null,
      ownerEmail: credential.user.email ?? null,
      updatedAt: new Date(),
    });
  });
  await batch.commit();
  return credential.user;
}
