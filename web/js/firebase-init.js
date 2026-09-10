import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js";
import { firebaseConfig, isConfigReady } from "./firebase-config.js";

export const configReady = isConfigReady();
export const FUNCTIONS_REGION = "asia-southeast1";

let app = null;
let auth = null;
let db = null;
let storage = null;
let functions = null;

if (configReady) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  functions = getFunctions(app, FUNCTIONS_REGION);
}

export { app, auth, db, storage, functions };
