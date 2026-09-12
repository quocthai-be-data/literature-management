import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db, configReady } from "./firebase-init.js";

function needDb() {
  if (!configReady || !db) throw new Error("Chưa gắn Firebase / Firestore.");
  return db;
}

export async function listMaterialFolders() {
  const snap = await getDocs(
    query(collection(needDb(), "materialFolders"), orderBy("order"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addMaterialFolder(title) {
  const list = await listMaterialFolders();
  const order = list.length ? Math.max(...list.map((w) => Number(w.order) || 0)) + 1 : 1;
  const ref = await addDoc(collection(needDb(), "materialFolders"), {
    title: title.trim(),
    order,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, title: title.trim(), order };
}

export async function renameMaterialFolder(id, title) {
  await updateDoc(doc(needDb(), "materialFolders", id), { title: title.trim() });
}

export async function saveMaterialFolderOrder(folders) {
  const database = needDb();
  const batch = writeBatch(database);
  folders.forEach((f, i) => {
    batch.update(doc(database, "materialFolders", f.id), { order: i + 1 });
  });
  await batch.commit();
}

export async function listMaterialItems(folderId) {
  const snap = await getDocs(
    query(collection(needDb(), "materialItems"), where("folderId", "==", folderId))
  );
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => {
    const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return ta - tb;
  });
  return rows;
}

export async function addMaterialItem(folderId, title, url) {
  const ref = await addDoc(collection(needDb(), "materialItems"), {
    folderId,
    title: title.trim(),
    url: url.trim(),
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, folderId, title: title.trim(), url: url.trim() };
}

export async function updateMaterialItem(id, title, url) {
  await updateDoc(doc(needDb(), "materialItems", id), {
    title: title.trim(),
    url: url.trim(),
  });
}

export async function deleteMaterialItem(id) {
  await deleteDoc(doc(needDb(), "materialItems", id));
}

export async function deleteMaterialFolderAndItems(folderId) {
  const items = await listMaterialItems(folderId);
  const database = needDb();
  const batch = writeBatch(database);
  items.forEach((it) => batch.delete(doc(database, "materialItems", it.id)));
  batch.delete(doc(database, "materialFolders", folderId));
  await batch.commit();
}
