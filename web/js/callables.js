import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js";
import { functions, configReady } from "./firebase-init.js";

function needFn() {
  if (!configReady || !functions) {
    throw new Error("Chưa dán firebaseConfig — không gọi được Cloud Function.");
  }
}

export async function seedTeacher({ email, displayName, token }) {
  needFn();
  const fn = httpsCallable(functions, "seedTeacher");
  const res = await fn({ email, displayName, token });
  return res.data;
}

export async function provisionStudents(rows) {
  needFn();
  const fn = httpsCallable(functions, "provisionStudents");
  const res = await fn({ rows });
  return res.data;
}
