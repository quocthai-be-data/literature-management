import { mountChrome } from "./shell.js";
import { watchAuth } from "./auth.js";
import {
  listWeeks,
  seedWeeksIfEmpty,
  addWeek,
  renameWeek,
  saveWeekOrder,
  listLessons,
  addLesson,
  updateLesson,
  deleteLesson,
  deleteWeekAndLessons,
} from "./weeks.js";

const isTeacher = window.NV_ROLE === "teacher";
const LESSON_IMG = "assets/lesson_image.jpg";

function $(id) {
  return document.getElementById(id);
}

function confirmBox(msg) {
  return window.confirm(msg);
}

function promptBox(msg, def = "") {
  return window.prompt(msg, def);
}

function normalizeUrl(raw) {
  let u = String(raw || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return "https://" + u;
}

let weeks = [];
let currentId = null;
let lessons = [];
let lessonModalMode = "add";
let lessonModalWeek = null;
let lessonModalItem = null;
let folderModalMode = "add"; // add | rename
let folderModalWeek = null;

function ensureLessonModal() {
  if ($("lesson-modal")) return;
  const wrap = document.createElement("div");
  wrap.id = "lesson-modal";
  wrap.className = "modal-back hidden";
  wrap.innerHTML = `
    <div class="modal">
      <h2 id="lesson-modal-heading">Thêm bài giảng</h2>
      <label>Tên bài giảng</label>
      <input id="lesson-title" placeholder="Ví dụ: Nghị luận xã hội" />
      <label>Link bài giảng</label>
      <input id="lesson-url" placeholder="https://docs.google.com/..." />
      <p class="err" id="lesson-err"></p>
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" type="button" id="lesson-cancel">Hủy</button>
        <button class="btn" type="button" id="lesson-ok">Lưu</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  $("lesson-cancel").addEventListener("click", closeLessonModal);
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) closeLessonModal();
  });
  $("lesson-ok").addEventListener("click", submitLessonModal);
}

function ensureFolderModal() {
  if ($("folder-modal")) return;
  const wrap = document.createElement("div");
  wrap.id = "folder-modal";
  wrap.className = "modal-back hidden";
  wrap.innerHTML = `
    <div class="modal">
      <h2 id="folder-modal-heading">Thêm thẻ</h2>
      <label>Tên bài giảng</label>
      <input id="folder-title" placeholder="Ví dụ: Tuần 5 / Nghị luận xã hội" />
      <label>Link bài giảng</label>
      <input id="folder-url" placeholder="https://docs.google.com/... (có thể để trống)" />
      <p class="err" id="folder-err"></p>
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" type="button" id="folder-cancel">Hủy</button>
        <button class="btn" type="button" id="folder-ok">Lưu</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  $("folder-cancel").addEventListener("click", closeFolderModal);
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) closeFolderModal();
  });
  $("folder-ok").addEventListener("click", submitFolderModal);
}

function openFolderModal({ mode, week } = { mode: "add" }) {
  ensureFolderModal();
  folderModalMode = mode || "add";
  folderModalWeek = week || null;
  if (folderModalMode === "rename" && week) {
    $("folder-modal-heading").textContent = "Đổi tên thẻ";
    $("folder-title").value = week.title || "";
    $("folder-url").value = "";
    $("folder-url").closest("label")?.classList.add("hidden");
    // hide url field on rename
    const urlInput = $("folder-url");
    urlInput.style.display = "none";
    if (urlInput.previousElementSibling) urlInput.previousElementSibling.style.display = "none";
  } else {
    $("folder-modal-heading").textContent = "Thêm thẻ";
    $("folder-title").value = "";
    $("folder-url").value = "";
    const urlInput = $("folder-url");
    urlInput.style.display = "";
    if (urlInput.previousElementSibling) urlInput.previousElementSibling.style.display = "";
  }
  $("folder-err").textContent = "";
  $("folder-modal").classList.remove("hidden");
  $("folder-title").focus();
}

function closeFolderModal() {
  const el = $("folder-modal");
  if (el) el.classList.add("hidden");
}

async function submitFolderModal() {
  const title = $("folder-title").value.trim();
  const url = normalizeUrl($("folder-url").value);
  const err = $("folder-err");
  err.textContent = "";
  if (!title) {
    err.textContent = "Nhập tên bài giảng.";
    return;
  }
  try {
    if (folderModalMode === "rename" && folderModalWeek) {
      await renameWeek(folderModalWeek.id, title);
      folderModalWeek.title = title;
      renderWeeks();
      if (currentId === folderModalWeek.id) $("week-title").textContent = title;
      closeFolderModal();
      return;
    }
    const w = await addWeek(title);
    weeks.push(w);
    if (url) {
      await addLesson(w.id, title, url);
    }
    closeFolderModal();
    renderWeeks();
    await selectWeek(w.id);
  } catch (e) {
    err.textContent = e.message;
  }
}

function openLessonModal({ mode, week, lesson }) {
  ensureLessonModal();
  lessonModalMode = mode;
  lessonModalWeek = week || null;
  lessonModalItem = lesson || null;
  $("lesson-modal-heading").textContent = mode === "edit" ? "Sửa bài giảng" : "Thêm bài giảng";
  $("lesson-title").value = lesson ? lesson.title : "";
  $("lesson-url").value = lesson ? lesson.url || lesson.link || "" : "";
  $("lesson-err").textContent = "";
  $("lesson-modal").classList.remove("hidden");
  $("lesson-title").focus();
}

function closeLessonModal() {
  const el = $("lesson-modal");
  if (el) el.classList.add("hidden");
}

async function submitLessonModal() {
  const title = $("lesson-title").value.trim();
  const url = normalizeUrl($("lesson-url").value);
  const err = $("lesson-err");
  err.textContent = "";
  if (!title) {
    err.textContent = "Nhập tên bài giảng.";
    return;
  }
  if (!url) {
    err.textContent = "Nhập link bài giảng.";
    return;
  }
  try {
    if (lessonModalMode === "edit" && lessonModalItem) {
      await updateLesson(lessonModalItem.id, title, url);
    } else if (lessonModalWeek) {
      await addLesson(lessonModalWeek.id, title, url);
    }
    closeLessonModal();
    if (currentId) await selectWeek(currentId);
  } catch (e) {
    err.textContent = e.message;
  }
}

function renderWeeks() {
  const ul = $("week-list");
  ul.innerHTML = "";
  weeks.forEach((w) => {
    const li = document.createElement("li");
    li.className = "week-item" + (w.id === currentId ? " on" : "");
    li.dataset.id = w.id;
    if (isTeacher) li.draggable = true;
    li.innerHTML = `<span class="title"></span>${
      isTeacher ? `<button class="kebab" type="button" data-act="week-menu">⋮</button>` : ""
    }`;
    li.querySelector(".title").textContent = w.title;
    li.addEventListener("click", (e) => {
      if (e.target.closest("[data-act]")) return;
      selectWeek(w.id);
    });
    if (isTeacher) {
      li.querySelector("[data-act=week-menu]").addEventListener("click", (e) => {
        e.stopPropagation();
        openWeekMenu(e.currentTarget, w);
      });
      li.addEventListener("dragstart", () => li.classList.add("dragging"));
      li.addEventListener("dragend", async () => {
        li.classList.remove("dragging");
        const ids = [...ul.querySelectorAll(".week-item")].map((el) => el.dataset.id);
        weeks.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
        try {
          await saveWeekOrder(weeks);
        } catch (err) {
          alert(err.message);
        }
      });
      li.addEventListener("dragover", (e) => {
        e.preventDefault();
        const dragging = ul.querySelector(".dragging");
        if (!dragging || dragging === li) return;
        const rect = li.getBoundingClientRect();
        const after = e.clientY > rect.top + rect.height / 2;
        ul.insertBefore(dragging, after ? li.nextSibling : li);
      });
    }
    ul.appendChild(li);
  });
}

async function selectWeek(id) {
  currentId = id;
  const w = weeks.find((x) => x.id === id);
  $("week-title").textContent = w ? w.title : "";
  renderWeeks();
  try {
    lessons = await listLessons(id);
  } catch (err) {
    lessons = [];
    $("lesson-list").innerHTML = `<p class="sub">${err.message}</p>`;
    return;
  }
  renderLessons();
}

function renderLessons() {
  const box = $("lesson-list");
  if (!lessons.length) {
    box.innerHTML = `<p class="sub">Chưa có bài giảng trong thẻ này.</p>`;
    return;
  }
  box.innerHTML = "";
  lessons.forEach((l) => {
    const href = normalizeUrl(l.url || l.link || "");
    const wrap = document.createElement(href ? "a" : "div");
    wrap.className = "lesson-card";
    if (href) {
      wrap.href = href;
      wrap.target = "_blank";
      wrap.rel = "noopener noreferrer";
    }
    wrap.innerHTML = `
      <img src="${LESSON_IMG}" alt="" />
      <div class="grow">
        <div class="name"></div>
        <div class="meta">${href ? "Mở bài giảng" : "Chưa có link"}</div>
      </div>
      ${isTeacher ? `<button class="kebab" type="button">⋮</button>` : ""}`;
    wrap.querySelector(".name").textContent = l.title;
    if (isTeacher) {
      wrap.querySelector(".kebab").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openLessonMenu(e.currentTarget, l);
      });
    }
    box.appendChild(wrap);
  });
}

function closeMenus() {
  document.querySelectorAll(".menu").forEach((m) => m.remove());
}

function placeMenu(anchor, html) {
  closeMenus();
  const menu = document.createElement("div");
  menu.className = "menu";
  menu.innerHTML = html;
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.top = `${r.bottom + window.scrollY + 4}px`;
  menu.style.left = `${Math.max(8, r.right + window.scrollX - 170)}px`;
  setTimeout(() => {
    const off = (ev) => {
      if (!menu.contains(ev.target)) {
        menu.remove();
        document.removeEventListener("click", off);
      }
    };
    document.addEventListener("click", off);
  }, 0);
  return menu;
}

function openWeekMenu(anchor, week) {
  const menu = placeMenu(
    anchor,
    `<button type="button" data-k="add">Thêm bài giảng</button>
     <button type="button" data-k="rename">Đổi tên</button>
     <button type="button" data-k="del">Xóa thẻ</button>`
  );
  menu.addEventListener("click", async (e) => {
    const k = e.target.getAttribute("data-k");
    if (!k) return;
    menu.remove();
    try {
      if (k === "add") {
        openLessonModal({ mode: "add", week });
      }
      if (k === "rename") {
        openFolderModal({ mode: "rename", week });
      }
      if (k === "del") {
        if (!confirmBox(`Xóa thẻ “${week.title}” và toàn bộ bài giảng trong thẻ?`)) return;
        await deleteWeekAndLessons(week.id);
        weeks = weeks.filter((w) => w.id !== week.id);
        if (currentId === week.id) {
          currentId = weeks[0] ? weeks[0].id : null;
          if (currentId) await selectWeek(currentId);
          else {
            $("week-title").textContent = "";
            $("lesson-list").innerHTML = "";
            renderWeeks();
          }
        } else renderWeeks();
      }
    } catch (err) {
      alert(err.message);
    }
  });
}

function openLessonMenu(anchor, lesson) {
  const menu = placeMenu(
    anchor,
    `<button type="button" data-k="edit">Sửa tên / link</button>
     <button type="button" data-k="del">Xóa bài</button>`
  );
  menu.addEventListener("click", async (e) => {
    const k = e.target.getAttribute("data-k");
    if (!k) return;
    menu.remove();
    try {
      if (k === "edit") {
        openLessonModal({ mode: "edit", lesson });
      }
      if (k === "del") {
        if (!confirmBox(`Xóa bài “${lesson.title}”?`)) return;
        await deleteLesson(lesson.id);
        await selectWeek(currentId);
      }
    } catch (err) {
      alert(err.message);
    }
  });
}

async function boot() {
  ensureLessonModal();
  ensureFolderModal();
  mountChrome({
    active: "hoc",
    role: isTeacher ? "teacher" : "student",
    who: isTeacher ? "Giáo viên" : "Học sinh",
  });
  watchAuth((user, profile) => {
    if (!user) return;
    const name = (profile && profile.hoTen) || user.email || "";
    mountChrome({
      active: "hoc",
      role: isTeacher ? "teacher" : "student",
      who: name,
    });
  });

  $("btn-add-week")?.addEventListener("click", () => {
    openFolderModal({ mode: "add" });
  });

  try {
    weeks = isTeacher ? await seedWeeksIfEmpty() : await listWeeks();
    weeks.sort((a, b) => (a.order || 0) - (b.order || 0));
    if (weeks[0]) await selectWeek(weeks[0].id);
    else {
      $("week-title").textContent = "Chưa có thẻ";
      $("lesson-list").innerHTML = `<p class="sub">Chưa có bài giảng</p>`;
    }
  } catch (err) {
    $("lesson-list").innerHTML = `<p class="sub">${err.message}</p>`;
  }
}

boot();
