import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { storage, configReady } from "./firebase-init.js";

export async function uploadTeacherBackground(file, teacherId) {
  if (!configReady || !storage) {
    throw new Error("Chưa dán firebaseConfig hoặc Storage chưa bật.");
  }
  const safe = String(file.name || "bg").replace(/[^\w.\-]+/g, "_");
  const path = `backgrounds/${teacherId}/${Date.now()}-${safe}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}
