import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db, configReady } from "./firebase-init.js";
import { SCHOOL_EMAIL_DOMAIN } from "./firebase-config.js";

export function toAuthEmail(identifier) {
  const raw = String(identifier || "").trim();
  if (!raw) return "";
  if (raw.includes("@")) return raw;
  return `${raw.toLowerCase()}@${SCHOOL_EMAIL_DOMAIN}`;
}

export async function loginWithIdentifier(identifier, password) {
  if (!configReady) {
    throw new Error("Chưa dán firebaseConfig trong js/firebase-config.js");
  }
  const email = toAuthEmail(identifier);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await loadProfile(cred.user.uid);
  return { user: cred.user, profile };
}

export async function loadProfile(uid) {
  if (!db) return null;
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function changePassword({ currentPassword, nextPassword }) {
  if (!configReady || !auth.currentUser) {
    throw new Error("Chưa đăng nhập hoặc chưa gắn Firebase.");
  }
  const email = auth.currentUser.email;
  const cred = EmailAuthProvider.credential(email, currentPassword);
  await reauthenticateWithCredential(auth.currentUser, cred);
  await updatePassword(auth.currentUser, nextPassword);
  if (db) {
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      mustChangePassword: false,
    });
  }
}

export async function requestPasswordReset(identifier) {
  if (!configReady) {
    throw new Error("Chưa dán firebaseConfig trong js/firebase-config.js");
  }
  const email = toAuthEmail(identifier);
  if (email.endsWith(`@${SCHOOL_EMAIL_DOMAIN}`)) {
    throw new Error(
      "Học sinh chưa đổi mật khẩu thì gặp giáo viên nhận lại file phát. Không gửi reset tới email nội bộ."
    );
  }
  await sendPasswordResetEmail(auth, email);
}

export function watchAuth(callback) {
  if (!configReady) {
    callback(null, null);
    return () => {};
  }
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null, null);
      return;
    }
    const profile = await loadProfile(user.uid);
    callback(user, profile);
  });
}

export async function logout() {
  if (auth) await signOut(auth);
}

export function friendlyAuthError(err) {
  const code = err && err.code;
  if (
    code === "auth/invalid-credential" ||
    code === "auth/user-not-found" ||
    code === "auth/wrong-password" ||
    code === "auth/invalid-email"
  ) {
    return "Thông tin đăng nhập không đúng.";
  }
  return err.message || "Không thực hiện được. Thử lại.";
}
