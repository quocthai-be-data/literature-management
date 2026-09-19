import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db, configReady } from "./firebase-init.js";
import { watchAuth } from "./auth.js";

const palette = { blue: "#BFDBFE", purple: "#DDD6FE", orange: "#FED7AA", pink: "#FBCFE8" };
const labels = { blue: "Xanh dương", purple: "Tím", orange: "Cam", pink: "Hồng" };
let uid = null, notes = {}, activeDate = "", contextMenu = null;
const $ = (id) => document.getElementById(id);
const textOf = (note) => typeof note === "string" ? note : (note?.text || "");

function normalize(data) {
  return Object.fromEntries(Object.entries(data?.notes || {}).map(([date, note]) => [date, typeof note === "string" ? { text: note, color: "blue" } : { text: note?.text || "", color: note?.color || "blue" }]));
}
function closeMenu() { contextMenu?.remove(); contextMenu = null; }
function closeModal() { $("private-calendar-note-modal")?.classList.add("hidden"); }
async function persist() { if (uid && configReady && db) await setDoc(doc(db, "calendarNotes", uid), { notes }, { merge: true }); }

function ensureModal() {
  if ($("private-calendar-note-modal")) return;
  const wrap = document.createElement("div");
  wrap.id = "private-calendar-note-modal";
  wrap.className = "modal-back hidden";
  wrap.innerHTML = `<section class="calendar-note-editor modal"><div class="panel-heading"><h2 id="private-note-title">Ghi chú</h2><button class="icon-control" id="private-note-close" type="button">&times;</button></div><div id="private-note-text-editor"><label for="private-note-input">Nội dung ghi chú</label><textarea id="private-note-input" rows="8" placeholder="Viết ghi chú cho ngày này..."></textarea></div><div id="private-note-color-editor" class="note-color-editor hidden"><p>Chọn màu</p><div class="private-note-colors">${Object.entries(palette).map(([key, color]) => `<button type="button" class="private-note-color" data-note-color="${key}" style="--note-color:${color}" title="${labels[key]}"></button>`).join("")}</div></div><div class="calendar-note-actions"><button class="btn ghost" id="private-note-cancel" type="button">Hủy</button><button class="btn" id="private-note-save" type="button">Lưu ghi chú</button></div></section>`;
  document.body.appendChild(wrap);
  $("private-note-close").onclick = closeModal;
  $("private-note-cancel").onclick = closeModal;
  $("private-note-save").onclick = saveText;
  document.querySelectorAll("[data-note-color]").forEach((button) => button.onclick = async () => {
    if (!notes[activeDate]) return;
    notes[activeDate].color = button.dataset.noteColor;
    await persist(); decorate(); showColorEditor();
  });
  wrap.onclick = (event) => { if (event.target === wrap) closeModal(); };
}
function showTextEditor() {
  ensureModal(); closeMenu();
  $("private-note-title").textContent = notes[activeDate] ? "Sửa note" : "Thêm note";
  $("private-note-input").value = textOf(notes[activeDate]);
  $("private-note-text-editor").classList.remove("hidden");
  $("private-note-color-editor").classList.add("hidden");
  $("private-note-save").classList.remove("hidden");
  $("private-calendar-note-modal").classList.remove("hidden");
  $("private-note-input").focus();
}
function showColorEditor() {
  ensureModal(); closeMenu();
  $("private-note-title").textContent = "Đổi màu";
  $("private-note-text-editor").classList.add("hidden");
  $("private-note-color-editor").classList.remove("hidden");
  $("private-note-save").classList.add("hidden");
  const selected = notes[activeDate]?.color || "blue";
  document.querySelectorAll("[data-note-color]").forEach((button) => button.classList.toggle("selected", button.dataset.noteColor === selected));
  $("private-calendar-note-modal").classList.remove("hidden");
}
async function saveText() {
  const text = $("private-note-input").value.trim();
  if (text) notes[activeDate] = { text, color: notes[activeDate]?.color || "blue" };
  else delete notes[activeDate];
  await persist(); closeModal(); decorate();
}
function openMenu(event, date) {
  closeMenu(); activeDate = date;
  if (!notes[date]) { showTextEditor(); return; }
  contextMenu = document.createElement("div");
  contextMenu.className = "calendar-context-menu menu";
  contextMenu.innerHTML = '<button type="button" data-action="edit">Sửa note</button><button type="button" data-action="color">Đổi màu</button>';
  document.body.appendChild(contextMenu);
  const rect = event.target.getBoundingClientRect();
  contextMenu.style.top = `${rect.bottom + window.scrollY + 4}px`;
  contextMenu.style.left = `${Math.max(8, rect.left + window.scrollX)}px`;
  contextMenu.onclick = (click) => click.target.dataset.action === "edit" ? showTextEditor() : showColorEditor();
  setTimeout(() => document.addEventListener("click", closeMenu, { once: true }), 0);
}
function decorate() {
  document.querySelectorAll("[data-calendar-note], [data-date]").forEach((day) => {
    const date = day.dataset.calendarNote || day.dataset.date, note = notes[date];
    day.classList.toggle("private-calendar-note", !!textOf(note));
    if (note) day.style.setProperty("--private-calendar-color", palette[note.color] || palette.blue);
    else day.style.removeProperty("--private-calendar-color");
    day.title = textOf(note);
  });
}
async function load(user) {
  if (!user || !configReady || !db) return;
  uid = user.uid;
  const snapshot = await getDoc(doc(db, "calendarNotes", uid));
  notes = normalize(snapshot.exists() ? snapshot.data() : {});
  decorate();
}

document.addEventListener("contextmenu", (event) => {
  const day = event.target.closest("[data-calendar-note], [data-date]");
  if (!day) return;
  event.preventDefault(); event.stopImmediatePropagation();
  openMenu(event, day.dataset.calendarNote || day.dataset.date);
}, true);
new MutationObserver(decorate).observe($("mini-calendar") || document.body, { childList: true, subtree: true });
watchAuth((user) => { if (user) load(user); });
