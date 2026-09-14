import { mountChrome } from "./shell.js";
import { watchAuth } from "./auth.js";
import {
  listFolders,
  seedFoldersIfEmpty,
  addFolder,
  renameFolder,
  saveFolderOrder,
  listItems,
  addItem,
  updateItem,
  deleteItem,
  deleteFolderCascade,
  folderKind,
} from "./practice.js";

const isTeacher = window.NV_ROLE === "teacher";
const IMG_DE = "assets/image_de.jpg";
const IMG_BT = "assets/image_baitap.jpg";

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

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") {
    try { return value.toDate(); } catch { /* ignore */ }
  }
  if (typeof value === "object" && value.seconds != null) {
    return new Date(Number(value.seconds) * 1000);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDeadlineInput(val) {
  if (!val) return null;
  const [datePart, timePart] = val.split("T");
  if (!datePart || !timePart) return null;
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  const pad = (n) => String(n).padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00+07:00`;
}

function deadlineToInput(iso) {
  if (!iso) return "";
  try {
    const d = toDate(iso);
    if (!d) return "";
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  } catch {
    return "";
  }
}

function formatDeadline(iso) {
  const d = toDate(iso);
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return "";
  }
}

function isOverdue(iso) {
  const d = toDate(iso);
  if (!d) return false;
  return Date.now() > d.getTime();
}

let folders = [];
let currentId = null;
let items = [];
let itemModalMode = "add";
let itemModalFolder = null;
let itemModalItem = null;
let itemModalBaitap = false;
let cardModalMode = "add";
let cardModalFolder = null;

function ensureItemModal() {
  if ($("item-modal")) return;
  const wrap = document.createElement("div");
  wrap.id = "item-modal";
  wrap.className = "modal-back hidden";
  wrap.innerHTML = `
    <div class="modal">
      <h2 id="item-modal-heading">Thêm tài liệu</h2>
      <label id="item-title-label">Tên</label>
      <input id="item-title" placeholder="Tên đề / bài tập" />
      <label id="item-url-label">Link</label>
      <input id="item-url" placeholder="https://docs.google.com/... hoặc form nộp" />
      <div id="item-deadline-wrap" class="hidden">
        <label>Thời hạn</label>
        <input id="item-deadline" type="datetime-local" />
      </div>
      <p class="err" id="item-err"></p>
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" type="button" id="item-cancel">Hủy</button>
        <button class="btn" type="button" id="item-ok">Lưu</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  $("item-cancel").addEventListener("click", closeItemModal);
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) closeItemModal();
  });
  $("item-ok").addEventListener("click", submitItemModal);
}

function ensureCardModal() {
  if ($("card-modal")) return;
  const wrap = document.createElement("div");
  wrap.id = "card-modal";
  wrap.className = "modal-back hidden";
  wrap.innerHTML = `
    <div class="modal">
      <h2 id="card-modal-heading">Thêm thẻ</h2>
      <label>Tên thẻ</label>
      <input id="card-title" placeholder="Ví dụ: Đề đọc hiểu tuần 3" />
      <p class="err" id="card-err"></p>
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" type="button" id="card-cancel">Hủy</button>
        <button class="btn" type="button" id="card-ok">Lưu</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  $("card-cancel").addEventListener("click", closeCardModal);
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) closeCardModal();
  });
  $("card-ok").addEventListener("click", submitCardModal);
}

function openCardModal({ mode, folder } = { mode: "add" }) {
  ensureCardModal();
  cardModalMode = mode || "add";
  cardModalFolder = folder || null;
  if (cardModalMode === "rename") {
    $("card-modal-heading").textContent = "Đổi tên thẻ";
    $("card-title").value = folder ? folder.title : "";
  } else if (cardModalMode === "child") {
    $("card-modal-heading").textContent = "Thêm thẻ con";
    $("card-title").value = "";
  } else {
    $("card-modal-heading").textContent = "Thêm thẻ";
    $("card-title").value = "";
  }
  $("card-err").textContent = "";
  $("card-modal").classList.remove("hidden");
  $("card-title").focus();
}

function closeCardModal() {
  const el = $("card-modal");
  if (el) el.classList.add("hidden");
}

async function submitCardModal() {
  const title = $("card-title").value.trim();
  const err = $("card-err");
  err.textContent = "";
  if (!title) {
    err.textContent = "Nhập tên thẻ.";
    return;
  }
  try {
    if (cardModalMode === "rename" && cardModalFolder) {
      await renameFolder(cardModalFolder.id, title);
      cardModalFolder.title = title;
      renderFolders();
      if (currentId === cardModalFolder.id) $("folder-title").textContent = title;
      closeCardModal();
      return;
    }
    if (cardModalMode === "child" && cardModalFolder) {
      const child = await addFolder({ title, parentId: cardModalFolder.id });
      folders.push(child);
      closeCardModal();
      renderFolders();
      await selectFolder(child.id);
      return;
    }
    const kindGuess = /bài\s*tập/i.test(title) ? "baitap" : "de";
    const f = await addFolder({ title, parentId: null, kind: kindGuess });
    folders.push(f);
    closeCardModal();
    renderFolders();
    await selectFolder(f.id);
  } catch (e) {
    err.textContent = e.message;
  }
}

function openItemModal({ mode, folder, item, baitap }) {
  ensureItemModal();
  itemModalMode = mode;
  itemModalFolder = folder || null;
  itemModalItem = item || null;
  itemModalBaitap = !!baitap;
  const heading =
    mode === "edit"
      ? baitap
        ? "Sửa bài tập"
        : "Sửa tài liệu"
      : baitap
        ? "Thêm bài tập"
        : "Thêm tài liệu";
  $("item-modal-heading").textContent = heading;
  $("item-title-label").textContent = baitap ? "Tên bài tập" : "Tên bài tập / đề";
  $("item-url-label").textContent = baitap ? "Link bài tập" : "Link bài tập / đề";
  $("item-title").value = item ? item.title : "";
  $("item-url").value = item ? item.url || "" : "";
  $("item-err").textContent = "";
  const dlWrap = $("item-deadline-wrap");
  if (baitap) {
    dlWrap.classList.remove("hidden");
    $("item-deadline").value = item ? deadlineToInput(item.deadline) : "";
  } else {
    dlWrap.classList.add("hidden");
    $("item-deadline").value = "";
  }
  $("item-modal").classList.remove("hidden");
  $("item-title").focus();
}

function closeItemModal() {
  const el = $("item-modal");
  if (el) el.classList.add("hidden");
}

async function submitItemModal() {
  const title = $("item-title").value.trim();
  const url = normalizeUrl($("item-url").value);
  const err = $("item-err");
  err.textContent = "";
  if (!title) {
    err.textContent = itemModalBaitap ? "Nhập tên bài tập." : "Nhập tên.";
    return;
  }
  if (!url) {
    err.textContent = itemModalBaitap ? "Nhập link bài tập." : "Nhập link.";
    return;
  }
  let deadline = null;
  if (itemModalBaitap) {
    const raw = $("item-deadline").value;
    if (!raw) {
      err.textContent = "Chọn thời hạn nộp.";
      return;
    }
    deadline = parseDeadlineInput(raw);
    if (!deadline) {
      err.textContent = "Thời hạn không hợp lệ.";
      return;
    }
  }
  try {
    if (itemModalMode === "edit" && itemModalItem) {
      await updateItem(itemModalItem.id, { title, url, deadline });
    } else if (itemModalFolder) {
      await addItem({ folderId: itemModalFolder.id, title, url, deadline });
    }
    closeItemModal();
    if (currentId) await selectFolder(currentId);
  } catch (e) {
    err.textContent = e.message;
  }
}

function rootsAndChildren() {
  const roots = folders
    .filter((f) => !f.parentId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const out = [];
  roots.forEach((r) => {
    out.push({ folder: r, depth: 0 });
    folders
      .filter((c) => c.parentId === r.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach((c) => out.push({ folder: c, depth: 1 }));
  });
  return out;
}

function renderFolders() {
  const ul = $("folder-list");
  ul.innerHTML = "";
  const rows = rootsAndChildren();
  rows.forEach(({ folder: f, depth }) => {
    const li = document.createElement("li");
    li.className =
      "week-item" +
      (f.id === currentId ? " on" : "") +
      (depth === 1 ? " child" : "");
    li.dataset.id = f.id;
    li.dataset.parent = f.parentId || "";
    if (isTeacher && depth === 0) li.draggable = true;
    if (isTeacher && depth === 1) li.draggable = true;
    li.innerHTML = `<span class="title"></span>${
      isTeacher ? `<button class="kebab" type="button" data-act="menu">⋮</button>` : ""
    }`;
    li.querySelector(".title").textContent = f.title;
    li.addEventListener("click", (e) => {
      if (e.target.closest("[data-act]")) return;
      selectFolder(f.id);
    });
    if (isTeacher) {
      li.querySelector("[data-act=menu]").addEventListener("click", (e) => {
        e.stopPropagation();
        openFolderMenu(e.currentTarget, f, depth === 0);
      });
      li.addEventListener("dragstart", () => li.classList.add("dragging"));
      li.addEventListener("dragend", async () => {
        li.classList.remove("dragging");
        await persistOrderFromDom();
      });
      li.addEventListener("dragover", (e) => {
        e.preventDefault();
        const dragging = ul.querySelector(".dragging");
        if (!dragging || dragging === li) return;
        if ((dragging.dataset.parent || "") !== (li.dataset.parent || "")) return;
        const rect = li.getBoundingClientRect();
        const after = e.clientY > rect.top + rect.height / 2;
        ul.insertBefore(dragging, after ? li.nextSibling : li);
      });
    }
    ul.appendChild(li);
  });
}

async function persistOrderFromDom() {
  const ul = $("folder-list");
  const ids = [...ul.querySelectorAll(".week-item")].map((el) => el.dataset.id);
  const byId = Object.fromEntries(folders.map((f) => [f.id, f]));
  const groups = {};
  ids.forEach((id) => {
    const f = byId[id];
    if (!f) return;
    const key = f.parentId || "__root__";
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  });
  const updates = [];
  Object.values(groups).forEach((list) => {
    list.forEach((f, i) => {
      f.order = i + 1;
      updates.push(f);
    });
  });
  try {
    await saveFolderOrder(updates);
    folders.sort((a, b) => (a.order || 0) - (b.order || 0));
    renderFolders();
  } catch (err) {
    alert(err.message);
  }
}

async function selectFolder(id) {
  currentId = id;
  const f = folders.find((x) => x.id === id);
  $("folder-title").textContent = f ? f.title : "Luyện tập";
  renderFolders();
  try {
    items = await listItems(id);
  } catch (err) {
    items = [];
    $("item-list").innerHTML = `<p class="sub">${err.message}</p>`;
    return;
  }
  renderItems();
}

function renderItems() {
  const box = $("item-list");
  const folder = folders.find((f) => f.id === currentId);
  const kind = folderKind(folder, folders);
  const img = kind === "baitap" ? IMG_BT : IMG_DE;
  if (!items.length) {
    box.innerHTML = `<p class="sub">Chưa có ${kind === "baitap" ? "bài tập" : "tài liệu"} trong thẻ này.</p>`;
    return;
  }
  box.innerHTML = "";
  items.forEach((it) => {
    const href = normalizeUrl(it.url || it.link || "");
    const hasDeadline = !!(it.deadline);
    const overdue = hasDeadline && isOverdue(it.deadline);
    const dlLabel = formatDeadline(it.deadline);
    const dlText =
      hasDeadline && dlLabel
        ? overdue
          ? `Hết hạn ${dlLabel}`
          : `Hạn ${dlLabel}`
        : "";

    const blocked = !isTeacher && overdue;
    const wrap = document.createElement(href && !blocked ? "a" : "div");
    wrap.className = "lesson-card";
    if (href && !blocked) {
      wrap.href = href;
      wrap.target = "_blank";
      wrap.rel = "noopener noreferrer";
    }
    wrap.innerHTML = `
      <img src="${img}" alt="" />
      <div class="grow">
        <div class="name"></div>
        <div class="meta">${href ? (kind === "baitap" || hasDeadline ? "Mở bài tập" : "Mở đề") : "Chưa có link"}</div>
      </div>
      ${dlText ? `<span class="deadline${overdue ? " over" : ""}">${dlText}</span>` : ""}
      ${isTeacher ? `<button class="kebab" type="button">⋮</button>` : ""}`;
    wrap.querySelector(".name").textContent = it.title;

    if (blocked) {
      wrap.addEventListener("click", (e) => {
        if (e.target.closest(".kebab")) return;
        e.preventDefault();
        window.alert("Đã hết hạn nộp");
      });
    } else if (href) {
      wrap.addEventListener("click", (e) => {
        if (e.target.closest(".kebab")) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      });
    }

    if (isTeacher) {
      const keb = wrap.querySelector(".kebab");
      if (keb) {
        keb.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openItemMenu(e.currentTarget, it, kind === "baitap" || hasDeadline);
        });
      }
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

function openFolderMenu(anchor, folder, isRoot) {
  const kind = folderKind(folder, folders);
  const addLabel = kind === "baitap" ? "Thêm bài tập" : "Thêm tài liệu";
  const rootExtra = isRoot
    ? `<button type="button" data-k="child">Thêm thẻ con</button>`
    : "";
  const menu = placeMenu(
    anchor,
    `${rootExtra}
     <button type="button" data-k="add">${addLabel}</button>
     <button type="button" data-k="rename">Đổi tên</button>
     <button type="button" data-k="del">Xóa thẻ</button>`
  );
  menu.addEventListener("click", async (e) => {
    const k = e.target.getAttribute("data-k");
    if (!k) return;
    menu.remove();
    try {
      if (k === "child") {
        openCardModal({ mode: "child", folder });
      }
      if (k === "add") {
        openItemModal({ mode: "add", folder, baitap: kind === "baitap" });
      }
      if (k === "rename") {
        openCardModal({ mode: "rename", folder });
      }
      if (k === "del") {
        const hasKids = folders.some((f) => f.parentId === folder.id);
        const msg = hasKids
          ? `Xóa thẻ “${folder.title}” và toàn bộ thẻ con + tài liệu bên trong?`
          : `Xóa thẻ “${folder.title}” và toàn bộ tài liệu bên trong?`;
        if (!confirmBox(msg)) return;
        await deleteFolderCascade(folder.id, folders);
        folders = folders.filter((f) => f.id !== folder.id && f.parentId !== folder.id);
        if (currentId === folder.id || folders.find((f) => f.id === currentId)?.parentId === folder.id) {
          currentId = folders[0] ? folders[0].id : null;
          if (currentId) await selectFolder(currentId);
          else {
            $("folder-title").textContent = "Luyện tập";
            $("item-list").innerHTML = "";
            renderFolders();
          }
        } else renderFolders();
      }
    } catch (err) {
      alert(err.message);
    }
  });
}

function openItemMenu(anchor, item, baitap) {
  const menu = placeMenu(
    anchor,
    `<button type="button" data-k="edit">Sửa</button>
     <button type="button" data-k="del">Xóa</button>`
  );
  menu.addEventListener("click", async (e) => {
    const k = e.target.getAttribute("data-k");
    if (!k) return;
    menu.remove();
    try {
      if (k === "edit") {
        const folder = folders.find((f) => f.id === currentId);
        openItemModal({ mode: "edit", folder, item, baitap });
      }
      if (k === "del") {
        if (!confirmBox(`Xóa “${item.title}”?`)) return;
        await deleteItem(item.id);
        await selectFolder(currentId);
      }
    } catch (err) {
      alert(err.message);
    }
  });
}

async function boot() {
  ensureItemModal();
  ensureCardModal();
  mountChrome({
    active: "luyen",
    role: isTeacher ? "teacher" : "student",
    who: isTeacher ? "Giáo viên" : "Học sinh",
  });
  watchAuth((user, profile) => {
    if (!user) return;
    const name = (profile && profile.hoTen) || user.email || "";
    mountChrome({
      active: "luyen",
      role: isTeacher ? "teacher" : "student",
      who: name,
    });
  });

  $("btn-add-folder")?.addEventListener("click", () => {
    openCardModal({ mode: "add" });
  });

  try {
    folders = isTeacher ? await seedFoldersIfEmpty() : await listFolders();
    folders.sort((a, b) => (a.order || 0) - (b.order || 0));
    if (folders[0]) await selectFolder(folders.find((f) => !f.parentId)?.id || folders[0].id);
    else {
      $("folder-title").textContent = "Chưa có thẻ";
      $("item-list").innerHTML = `<p class="sub">Chưa có tài liệu</p>`;
    }
  } catch (err) {
    $("item-list").innerHTML = `<p class="sub">${err.message}</p>`;
  }
}

boot();
