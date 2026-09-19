import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db, configReady } from "./firebase-init.js";
import { watchAuth } from "./auth.js";

const COLORS = {
  teal: "#04B4C4",
  blue: "#BFDBFE",
  purple: "#DDD6FE",
  orange: "#FED7AA",
  pink: "#FBCFE8",
};
const COLOR_NAMES = { teal: "Teal", blue: "Xanh dương", purple: "Tím", orange: "Cam", pink: "Hồng" };
const role = document.body.classList.contains("teacher-home-page") ? "teacher" : "student";
const ownCollection = "calendarNotes";
const sharedRef = () => doc(db, "sharedCalendarNotes", "all-students");
let uid = null;
let ownNotes = {};
let sharedNotes = {};
let activeDate = "";
let activeKind = "own";
let menu = null;

const $ = (id) => document.getElementById(id);
const esc = (value) => { const el = document.createElement("div"); el.textContent = value || ""; return el.innerHTML; };
function normalizeNotes(value, fallbackColor = "blue") {
  const source = value && value.notes ? value.notes : value || {};
  return Object.fromEntries(Object.entries(source).map(([date, entry]) => [date, typeof entry === "string" ? { text: entry, color: fallbackColor } : { text: entry.text || "", color: entry.color || fallbackColor }]));
}
function noteText(entry) { return typeof entry === "string" ? entry : (entry && entry.text) || ""; }
function closeMenu() { if (menu) { menu.remove(); menu = null; } }
function closeModal() { $("calendar-note-editor")?.classList.add("hidden"); }
function ensureModal() {
  if ($("calendar-note-editor")) return;
  const wrap = document.createElement("div");
  wrap.id = "calendar-note-editor";
  wrap.className = "modal-back hidden";
  wrap.innerHTML = `<section class="calendar-note-editor modal"><div class="panel-heading"><h2 id="calendar-editor-title">Ghi chú</h2><button class="icon-control" id="calendar-editor-close" type="button">&times;</button></div><div id="teacher-private-editor" class="note-editor-section"><label for="teacher-private-note">Note riêng</label><textarea id="teacher-private-note" rows="5" placeholder="Chỉ bạn nhìn thấy ghi chú này..."></textarea></div><div id="teacher-shared-editor" class="note-editor-section"><label for="teacher-shared-note">Note cho học sinh</label><textarea id="teacher-shared-note" rows="5" placeholder="Tất cả học sinh sẽ nhìn thấy ghi chú này..."></textarea></div><div id="student-shared-view" class="note-editor-section"><label>Note của giáo viên</label><div id="student-shared-note" class="shared-note-readonly"></div><div class="note-divider"></div><label for="student-own-note">Note của tôi</label><textarea id="student-own-note" rows="5" placeholder="Ghi chú cá nhân của bạn..."></textarea></div><div id="calendar-color-editor" class="note-color-editor"><p>Đổi màu</p><div id="calendar-color-options" class="calendar-color-options"></div></div><div class="calendar-note-actions"><button class="btn ghost" id="calendar-editor-cancel" type="button">Hủy</button><button class="btn" id="calendar-editor-save" type="button">Lưu ghi chú</button></div></section>`;
  document.body.appendChild(wrap);
  $("calendar-editor-close").onclick = closeModal;
  $("calendar-editor-cancel").onclick = closeModal;
  $("calendar-editor-save").onclick = saveEditor;
  wrap.onclick = (event) => { if (event.target === wrap) closeModal(); };
}
function showEditor({ mode = "edit", kind = "own" } = {}) {
  ensureModal(); closeMenu(); activeKind = kind;
  const own = ownNotes[activeDate] || { text: "", color: role === "teacher" ? "purple" : "orange" };
  const shared = sharedNotes[activeDate] || { text: "", color: "blue" };
  $("calendar-editor-title").textContent = mode === "color" ? "Đổi màu ghi chú" : "Ghi chú";
  const teacher = role === "teacher";
  $("teacher-private-editor").classList.toggle("hidden", !teacher || (mode === "edit" && kind === "shared"));
  $("teacher-shared-editor").classList.toggle("hidden", !teacher || (mode === "edit" && kind === "private"));
  $("student-shared-view").classList.toggle("hidden", teacher);
  $("calendar-color-editor").classList.toggle("hidden", mode !== "color");
  $("calendar-editor-save").classList.toggle("hidden", mode === "color");
  $("teacher-private-note").value = own.text;
  $("teacher-shared-note").value = shared.text;
  $("student-shared-note").textContent = shared.text || "Chưa có note từ giáo viên.";
  $("student-own-note").value = own.text;
  if (mode === "color") renderColorOptions(teacher ? [own.text && "private", shared.text && "shared"].filter(Boolean) : ["own"], own, shared);
  $("calendar-note-editor").classList.remove("hidden");
  if (mode !== "color") (teacher ? (kind === "shared" ? $("teacher-shared-note") : $("teacher-private-note")) : $("student-own-note")).focus();
}
function renderColorOptions(targets, own, shared) {
  $("calendar-color-options").innerHTML = targets.map((target) => { const current = target === "shared" ? shared.color : own.color; const label = target === "shared" ? "Note cho học sinh" : role === "teacher" ? "Note riêng" : "Note của tôi"; return `<div class="color-choice-group"><span>${label}</span><div>${Object.entries(COLORS).map(([key, color]) => `<button type="button" class="calendar-color-swatch${current === key ? " selected" : ""}" data-color-target="${target}" data-color="${key}" style="--swatch:${color}" title="${COLOR_NAMES[key]}">${current === key ? "✓" : ""}</button>`).join("")}</div></div>`; }).join(""); document.querySelectorAll("[data-color-target]").forEach((button) => button.onclick = async () => { const target = button.dataset.colorTarget; const entry = target === "shared" ? sharedNotes[activeDate] : ownNotes[activeDate]; if (!entry) return; entry.color = button.dataset.color; await persist(target === "shared" ? "shared" : "own"); showEditor({ mode: "color" }); decorateCalendar(); });
}
async function persist(type) { if (!configReady || !db || !uid) return; if (type === "shared") await setDoc(sharedRef(), { notes: sharedNotes }, { merge: true }); else await setDoc(doc(db, ownCollection, uid), { notes: ownNotes }, { merge: true }); }
async function saveEditor() { if (role === "teacher") { const privateText = $("teacher-private-note").value.trim(), sharedText = $("teacher-shared-note").value.trim(); if (privateText) ownNotes[activeDate] = { ...(ownNotes[activeDate] || {}), text: privateText, color: ownNotes[activeDate]?.color || "purple" }; else delete ownNotes[activeDate]; if (sharedText) sharedNotes[activeDate] = { ...(sharedNotes[activeDate] || {}), text: sharedText, color: sharedNotes[activeDate]?.color || "blue" }; else delete sharedNotes[activeDate]; await persist("own"); await persist("shared"); } else { const text = $("student-own-note").value.trim(); if (text) ownNotes[activeDate] = { ...(ownNotes[activeDate] || {}), text, color: ownNotes[activeDate]?.color || "orange" }; else delete ownNotes[activeDate]; await persist("own"); } closeModal(); decorateCalendar(); }
function openMenu(event, date) { closeMenu(); activeDate = date; menu = document.createElement("div"); menu.className = "calendar-context-menu menu"; const own = !!noteText(ownNotes[date]), shared = !!noteText(sharedNotes[date]); if (role === "teacher" && !own && !shared) menu.innerHTML = `<button type="button" data-action="private">Note riêng</button><button type="button" data-action="shared">Note cho học sinh</button>`; else menu.innerHTML = `<button type="button" data-action="edit">Sửa note</button><button type="button" data-action="color">Đổi màu</button>`; document.body.appendChild(menu); const rect=event.target.getBoundingClientRect(); menu.style.top = `${rect.bottom + window.scrollY + 4}px`; menu.style.left = `${Math.max(8, rect.left + window.scrollX)}px`; menu.onclick = (click) => { const action=click.target.dataset.action; if (action === "private") showEditor({ mode: "edit", kind: "private" }); if (action === "shared") showEditor({ mode: "edit", kind: "shared" }); if (action === "edit") showEditor({ mode: "edit" }); if (action === "color") showEditor({ mode: "color" }); }; setTimeout(() => document.addEventListener("click", closeMenu, { once: true }), 0); }
function decorateCalendar() { document.querySelectorAll("[data-calendar-note], [data-date]").forEach((day) => { const date = day.dataset.calendarNote || day.dataset.date, own=ownNotes[date], shared=sharedNotes[date]; day.classList.toggle("has-private-note", role === "teacher" && !!noteText(own)); day.classList.toggle("has-shared-note", !!noteText(shared)); day.classList.toggle("has-note", role === "student" && !!noteText(own)); if (role === "student" && own?.color) day.style.setProperty("--note-color", COLORS[own.color] || COLORS.orange); if (role === "teacher" && own?.color) day.style.setProperty("--private-note-color", COLORS[own.color] || COLORS.purple); if (shared?.color) day.style.setProperty("--shared-note-color", COLORS[shared.color] || COLORS.blue); day.title = [shared && `Note giáo viên: ${noteText(shared)}`, own && `Note cá nhân: ${noteText(own)}`].filter(Boolean).join("\n"); day.oncontextmenu = (event) => { event.preventDefault(); event.stopImmediatePropagation(); openMenu(event, date); }; }); }
async function loadNotes(user) { if (!user) return; uid=user.uid; if (!configReady || !db) return; const ownSnap=await getDoc(doc(db, ownCollection, uid)), sharedSnap=await getDoc(sharedRef()); ownNotes=normalizeNotes(ownSnap.exists()?ownSnap.data():{}, role === "teacher" ? "purple" : "orange"); sharedNotes=normalizeNotes(sharedSnap.exists()?sharedSnap.data():{}, "blue"); decorateCalendar(); }
const observer = new MutationObserver(() => decorateCalendar()); observer.observe($("mini-calendar") || document.body, { childList: true, subtree: true });
watchAuth((user) => { if (user) loadNotes(user); });
