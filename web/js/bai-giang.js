import { mountChrome } from "./shell.js";
import { watchAuth, logout } from "./auth.js";
import { saveUserProfile } from "./firestore.js";
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

function $(id) {
  return document.getElementById(id);
}

function confirmBox(msg) {
  return window.confirm(msg);
}

function promptBox(msg, def = "") {
  return window.prompt(msg, def);
}

let weeks = [];
let currentId = null;
let lessons = [];

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
    const wrap = document.createElement("div");
    wrap.className = "lesson-card";
    wrap.innerHTML = `
      <img src="assets/lesson_image.jpg" alt="" />
      <div class="grow">
        <div class="name"></div>
        <div class="meta">Mở bài giảng</div>
      </div>
      ${isTeacher ? `<button class="kebab" type="button">⋮</button>` : ""}`;
    wrap.querySelector(".name").textContent = l.title;
    wrap.addEventListener("click", (e) => {
      if (e.target.closest(".kebab")) return;
      if (l.url) window.open(l.url, "_blank", "noopener");
    });
    if (isTeacher) {
      wrap.querySelector(".kebab").addEventListener("click", (e) => {
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
    `<button type="button" data-k="add">Thêm tài liệu</button>
     <button type="button" data-k="rename">Đổi tên</button>
     <button type="button" data-k="del">Xóa thẻ</button>`
  );
  menu.addEventListener("click", async (e) => {
    const k = e.target.getAttribute("data-k");
    if (!k) return;
    menu.remove();
    try {
      if (k === "add") {
        const title = promptBox("Tên bài giảng");
        if (!title) return;
        const url = promptBox("Link bài giảng");
        if (!url) return;
        await addLesson(week.id, title, url);
        if (currentId === week.id) await selectWeek(week.id);
      }
      if (k === "rename") {
        const title = promptBox("Tên thẻ mới", week.title);
        if (!title) return;
        await renameWeek(week.id, title);
        week.title = title.trim();
        renderWeeks();
        if (currentId === week.id) $("week-title").textContent = week.title;
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
        const title = promptBox("Tên bài giảng", lesson.title);
        if (!title) return;
        const url = promptBox("Link bài giảng", lesson.url || "");
        if (url == null) return;
        await updateLesson(lesson.id, title, url);
        await selectWeek(currentId);
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

  $("btn-add-week")?.addEventListener("click", async () => {
    const title = promptBox("Tên thẻ mới");
    if (!title) return;
    try {
      const w = await addWeek(title);
      weeks.push(w);
      renderWeeks();
      await selectWeek(w.id);
    } catch (err) {
      alert(err.message);
    }
  });

  try {
    weeks = isTeacher ? await seedWeeksIfEmpty() : await listWeeks();
    weeks.sort((a, b) => (a.order || 0) - (b.order || 0));
    if (weeks[0]) await selectWeek(weeks[0].id);
    else {
      $("week-title").textContent = "Chưa có thẻ";
      $("lesson-list").innerHTML = `<p class="sub">Cô chưa tạo tuần / thẻ bài giảng.</p>`;
    }
  } catch (err) {
    $("lesson-list").innerHTML = `<p class="sub">${err.message}</p>`;
  }
}

boot();
