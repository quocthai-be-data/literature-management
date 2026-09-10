import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db, configReady } from "./firebase-init.js";

function needDb() {
  if (!configReady || !db) {
    throw new Error("Chưa dán firebaseConfig hoặc Firestore chưa bật.");
  }
  return db;
}

export async function saveUserProfile(uid, data) {
  const database = needDb();
  await setDoc(
    doc(database, "users", uid),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function createMaterial(payload) {
  const database = needDb();
  return addDoc(collection(database, "materials"), {
    ...payload,
    createdAt: serverTimestamp(),
  });
}

export async function listMaterialsForClass(classId, kind) {
  const database = needDb();
  const clauses = [where("classIds", "array-contains", classId), where("status", "==", "published")];
  if (kind) clauses.push(where("kind", "==", kind));
  const q = query(collection(database, "materials"), ...clauses);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createSubmission(payload) {
  const database = needDb();
  return addDoc(collection(database, "submissions"), {
    ...payload,
    createdAt: serverTimestamp(),
  });
}

export async function updateSubmission(id, payload) {
  const database = needDb();
  await updateDoc(doc(database, "submissions", id), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

export async function getMaterial(id) {
  const database = needDb();
  const snap = await getDoc(doc(database, "materials", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
