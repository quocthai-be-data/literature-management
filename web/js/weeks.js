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

export async function listWeeks() {
  const snap = await getDocs(query(collection(needDb(), "weeks"), orderBy("order")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function seedWeeksIfEmpty() {
  const existing = await listWeeks();
  if (existing.length) return existing;
  const database = needDb();
  const batch = writeBatch(database);
  const created = [];
  for (let i = 1; i <= 20; i += 1) {
    const ref = doc(collection(database, "weeks"));
    batch.set(ref, { title: `Tuần ${i}`, order: i, createdAt: serverTimestamp() });
    created.push({ id: ref.id, title: `Tuần ${i}`, order: i });
  }
  await batch.commit();
  return created;
}

export async function addWeek(title) {
  const list = await listWeeks();
  const order = list.length ? Math.max(...list.map((w) => Number(w.order) || 0)) + 1 : 1;
  const ref = await addDoc(collection(needDb(), "weeks"), {
    title: title.trim(),
    order,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, title: title.trim(), order };
}

export async function renameWeek(id, title) {
  await updateDoc(doc(needDb(), "weeks", id), { title: title.trim() });
}

export async function saveWeekOrder(weeks) {
  const database = needDb();
  const batch = writeBatch(database);
  weeks.forEach((w, i) => {
    batch.update(doc(database, "weeks", w.id), { order: i + 1 });
  });
  await batch.commit();
}

export async function listLessons(weekId) {
  const snap = await getDocs(
    query(collection(needDb(), "lessons"), where("weekId", "==", weekId))
  );
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => {
    const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return ta - tb;
  });
  return rows;
}

export async function addLesson(weekId, title, url) {
  const ref = await addDoc(collection(needDb(), "lessons"), {
    weekId,
    title: title.trim(),
    url: url.trim(),
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, weekId, title: title.trim(), url: url.trim() };
}

export async function updateLesson(id, title, url) {
  await updateDoc(doc(needDb(), "lessons", id), {
    title: title.trim(),
    url: url.trim(),
  });
}

export async function deleteLesson(id) {
  await deleteDoc(doc(needDb(), "lessons", id));
}

export async function deleteWeekAndLessons(weekId) {
  const lessons = await listLessons(weekId);
  const database = needDb();
  const batch = writeBatch(database);
  lessons.forEach((l) => batch.delete(doc(database, "lessons", l.id)));
  batch.delete(doc(database, "weeks", weekId));
  await batch.commit();
}
