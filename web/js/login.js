import { loginWithIdentifier, friendlyAuthError } from "./auth.js";
import { configReady } from "./firebase-init.js";

const form = document.getElementById("login-form");
const err = document.getElementById("login-error");
const note = document.getElementById("config-note");

if (!configReady && note) {
  note.hidden = false;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  err.textContent = "";
  const identifier = form.identifier.value.trim();
  const password = form.password.value;
  const roleHint = form.role.value;

  if (!configReady) {
    if (roleHint === "teacher") location.href = "home.html";
    else location.href = "home-hs.html";
    return;
  }

  try {
    const { profile } = await loginWithIdentifier(identifier, password);
    if (profile && profile.mustChangePassword) {
      location.href = "doi-mat-khau.html";
      return;
    }
    const role = (profile && profile.role) || roleHint;
    location.href = role === "teacher" ? "home.html" : "home-hs.html";
  } catch (ex) {
    err.textContent = friendlyAuthError(ex);
  }
});
