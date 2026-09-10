/**
 * Config web (public) — project mới.
 * e-learning-website-d78b5
 */
export const firebaseConfig = {
  apiKey: "AIzaSyCa1acsFfs91rCGUH0fLnDybCVsd7-vHls",
  authDomain: "e-learning-website-d78b5.firebaseapp.com",
  projectId: "e-learning-website-d78b5",
  storageBucket: "e-learning-website-d78b5.firebasestorage.app",
  messagingSenderId: "442704921428",
  appId: "1:442704921428:web:b7e5736ae5628331467ec1",
};

export const SCHOOL_EMAIL_DOMAIN = "school.local";

export function isConfigReady() {
  return Boolean(
    firebaseConfig.apiKey &&
      !String(firebaseConfig.apiKey).startsWith("PASTE_")
  );
}
