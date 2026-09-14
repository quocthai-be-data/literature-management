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

const SEED_ROOTS = [
  { title: "Đọc - hiểu", seedKey: "doc-hieu", kind: "de", order: 1 },
  { title: "Nghị luận văn học", seedKey: "nlvh", kind: "de", order: 2 },
  { title: "Nghị luận xã hội", seedKey: "nlxh", kind: "de", order: 3 },
  { title: "Đề thi các năm", seedKey: "de-nam", kind: "de", order: 4 },
  { title: "Bài tập", seedKey: "bai-tap", kind: "baitap", order: 5 },
];

function needDb() {
  if (!configReady || !db) throw new Error("Chưa gắn Firebase / Firestore.");
  return db;
}

export async function listFolders() {
  const snap = await getDocs(query(collection(needDb(), "practiceFolders"), orderBy("order")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function seedFoldersIfEmpty() {
  const existing = await listFolders();
  if (existing.length) return existing;
  const database = needDb();
  const batch = writeBatch(database);
  const created = [];
  SEED_ROOTS.forEach((s) => {
    const ref = doc(collection(database, "practiceFolders"));
    batch.set(ref, {
      title: s.title,
      parentId: null,
      seedKey: s.seedKey,
      kind: s.kind,
      order: s.order,
      createdAt: serverTimestamp(),
    });
    created.push({
      id: ref.id,
      title: s.title,
      parentId: null,
      seedKey: s.seedKey,
      kind: s.kind,
      order: s.order,
    });
  });
  await batch.commit();
  return created;
}

export async function addFolder({ title, parentId = null, kind = "de" }) {
  const list = await listFolders();
  const siblings = list.filter((f) => (f.parentId || null) === (parentId || null));
  const order = siblings.length
    ? Math.max(...siblings.map((f) => Number(f.order) || 0)) + 1
    : 1;
  const payload = {
    title: title.trim(),
    parentId: parentId || null,
    order,
    createdAt: serverTimestamp(),
  };
  if (!parentId) payload.kind = kind || "de";
  const ref = await addDoc(collection(needDb(), "practiceFolders"), payload);
  return { id: ref.id, ...payload, title: title.trim() };
}

export async function renameFolder(id, title) {
  await updateDoc(doc(needDb(), "practiceFolders", id), { title: title.trim() });
}

export async function saveFolderOrder(folders) {
  const database = needDb();
  const batch = writeBatch(database);
  folders.forEach((f, i) => {
    batch.update(doc(database, "practiceFolders", f.id), { order: i + 1 });
  });
  await batch.commit();
}

export async function listItems(folderId) {
  const snap = await getDocs(
    query(collection(needDb(), "practiceItems"), where("folderId", "==", folderId))
  );
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => {
    const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return ta - tb;
  });
  return rows;
}

export async function addItem({ folderId, title, url, deadline = null }) {
  const payload = {
    folderId,
    title: title.trim(),
    url: url.trim(),
    deadline: deadline || null,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(needDb(), "practiceItems"), payload);
  return { id: ref.id, ...payload };
}

export async function updateItem(id, { title, url, deadline }) {
  const payload = {
    title: title.trim(),
    url: url.trim(),
  };
  if (deadline !== undefined) payload.deadline = deadline || null;
  await updateDoc(doc(needDb(), "practiceItems", id), payload);
}

export async function deleteItem(id) {
  await deleteDoc(doc(needDb(), "practiceItems", id));
}

export async function deleteFolderCascade(folderId, allFolders) {
  const database = needDb();
  const childIds = allFolders
    .filter((f) => f.parentId === folderId)
    .map((f) => f.id);
  const idsToClear = [folderId, ...childIds];
  const batch = writeBatch(database);
  for (const fid of idsToClear) {
    const items = await listItems(fid);
    items.forEach((it) => batch.delete(doc(database, "practiceItems", it.id)));
    batch.delete(doc(database, "practiceFolders", fid));
  }
  await batch.commit();
}

/** Resolve effective kind for a folder (walk to root). */
export function folderKind(folder, allFolders) {
  if (!folder) return "de";
  let cur = folder;
  const byId = Object.fromEntries(allFolders.map((f) => [f.id, f]));
  while (cur && cur.parentId) {
    cur = byId[cur.parentId];
  }
  if (!cur) return "de";
  if (cur.kind === "baitap" || cur.seedKey === "bai-tap") return "baitap";
  // fallback: title "Bài tập" (khi GV tạo lại thẻ gốc không có kind)
  if (/bài\s*tập/i.test(String(cur.title || ""))) return "baitap";
  return "de";
}
