import { mountChrome } from "./shell.js";
import { watchAuth } from "./auth.js";
import {
  listMaterialFolders,
  addMaterialFolder,
  renameMaterialFolder,
  saveMaterialFolderOrder,
  listMaterialItems,
  addMaterialItem,
  updateMaterialItem,
  deleteMaterialItem,
  deleteMaterialFolderAndItems,
} from "./materials.js";

const DOC_IMG = "assets/image_tltk.jpg";

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

let isTeacher = false;
let folders = [];
let currentId = null;
let items = [];
let itemModalMode = "add";
let itemModalFolder = null;
let itemModalItem = null;

function ensureItemModal() {
  if ($("mat-modal")) return;
  const wrap = document.createElement("div");
  wrap.id = "mat-modal";
  wrap.className = "modal-back hidden";
  wrap.innerHTML = `
    <div class="modal">
      <h2 id="mat-modal-heading">Thêm tài liệu</h2>
      <label>Tên tài liệu</label>
      <input id="mat-title" placeholder="Ví dụ: Ngữ liệu nghị luận ngoài SGK" />
      <label>Link tài liệu</label>
      <input id="mat-url" placeholder="https://docs.google.com/..." />
      <p class="err" id="mat-err"></p>
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" type="button" id="mat-cancel">Hủy</button>
        <button class="btn" type="button" id="mat-ok">Lưu</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  $("mat-cancel").addEventListener("click", closeItemModal);
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) closeItemModal();
  });
  $("mat-ok").addEventListener("click", submitItemModal);
}

function openItemModal({ mode, folder, item }) {
  ensureItemModal();
  itemModalMode = mode;
  itemModalFolder = folder || null;
  itemModalItem = item || null;
  $("mat-modal-heading").textContent = mode === "edit" ? "Sửa tài liệu" : "Thêm tài liệu";
  $("mat-title").value = item ? item.title : "";
  $("mat-url").value = item ? item.url || item.link || "" : "";
  $("mat-err").textContent = "";
  $("mat-modal").classList.remove("hidden");
  $("mat-title").focus();
}

function closeItemModal() {
  const el = $("mat-modal");
  if (el) el.classList.add("hidden");
}

async function submitItemModal() {
  const title = $("mat-title").value.trim();
  const url = normalizeUrl($("mat-url").value);
  const err = $("mat-err");
  err.textContent = "";
  if (!title) {
    err.textContent = "Nhập tên tài liệu.";
    return;
  }
  if (!url) {
    err.textContent = "Nhập link tài liệu.";
    return;
  }
  try {
    if (itemModalMode === "edit" && itemModalItem) {
      await updateMaterialItem(itemModalItem.id, title, url);
    } else if (itemModalFolder) {
      await addMaterialItem(itemModalFolder.id, title, url);
    }
    closeItemModal();
    if (currentId) await selectFolder(currentId);
  } catch (e) {
    err.textContent = e.message;
  }
}

function renderFolders() {
  const ul = $("folder-list");
  ul.innerHTML = "";
  folders.forEach((f) => {
    const li = document.createElement("li");
    li.className = "week-item" + (f.id === currentId ? " on" : "");
    li.dataset.id = f.id;
    if (isTeacher) li.draggable = true;
    li.innerHTML = `<span class="title"></span>${
      isTeacher ? `<button class="kebab" type="button" data-act="folder-menu">⋮</button>` : ""
    }`;
    li.querySelector(".title").textContent = f.title;
    li.addEventListener("click", (e) => {
      if (e.target.closest("[data-act]")) return;
      selectFolder(f.id);
    });
    if (isTeacher) {
      li.querySelector("[data-act=folder-menu]").addEventListener("click", (e) => {
        e.stopPropagation();
        openFolderMenu(e.currentTarget, f);
      });
      li.addEventListener("dragstart", () => li.classList.add("dragging"));
      li.addEventListener("dragend", async () => {
        li.classList.remove("dragging");
        const ids = [...ul.querySelectorAll(".week-item")].map((el) => el.dataset.id);
        folders.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
        try {
          await saveMaterialFolderOrder(folders);
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

async function selectFolder(id) {
  currentId = id;
  const f = folders.find((x) => x.id === id);
  $("folder-title").textContent = f ? f.title : "Tài liệu tham khảo";
  renderFolders();
  try {
    items = await listMaterialItems(id);
  } catch (err) {
    items = [];
    $("item-list").innerHTML = `<p class="sub">${err.message}</p>`;
    return;
  }
  renderItems();
}

function renderItems() {
  const box = $("item-list");
  if (!items.length) {
    box.innerHTML = `<p class="sub">Chưa có tài liệu trong thẻ này.</p>`;
    return;
  }
  box.innerHTML = "";
  items.forEach((it) => {
    const href = normalizeUrl(it.url || it.link || "");
    const wrap = document.createElement(href ? "a" : "div");
    wrap.className = "lesson-card";
    if (href) {
      wrap.href = href;
      wrap.target = "_blank";
      wrap.rel = "noopener noreferrer";
    }
    wrap.innerHTML = `
      <img src="${DOC_IMG}" alt="" />
      <div class="grow">
        <div class="name"></div>
        <div class="meta">${href ? "Mở tài liệu" : "Chưa có link"}</div>
      </div>
      ${isTeacher ? `<button class="kebab" type="button">⋮</button>` : ""}`;
    wrap.querySelector(".name").textContent = it.title;
    if (isTeacher) {
      wrap.querySelector(".kebab").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openItemMenu(e.currentTarget, it);
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

function openFolderMenu(anchor, folder) {
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
        openItemModal({ mode: "add", folder });
      }
      if (k === "rename") {
        const title = promptBox("Tên thẻ mới", folder.title);
        if (!title) return;
        await renameMaterialFolder(folder.id, title);
        folder.title = title.trim();
        renderFolders();
        if (currentId === folder.id) $("folder-title").textContent = folder.title;
      }
      if (k === "del") {
        if (!confirmBox(`Xóa thẻ “${folder.title}” và toàn bộ tài liệu trong thẻ?`)) return;
        await deleteMaterialFolderAndItems(folder.id);
        folders = folders.filter((f) => f.id !== folder.id);
        if (currentId === folder.id) {
          currentId = folders[0] ? folders[0].id : null;
          if (currentId) await selectFolder(currentId);
          else {
            $("folder-title").textContent = "Tài liệu tham khảo";
            $("item-list").innerHTML = `<p class="sub">Chưa có thẻ. GV bấm Thêm thẻ để tạo.</p>`;
            renderFolders();
          }
        } else renderFolders();
      }
    } catch (err) {
      alert(err.message);
    }
  });
}

function openItemMenu(anchor, item) {
  const menu = placeMenu(
    anchor,
    `<button type="button" data-k="edit">Sửa tên / link</button>
     <button type="button" data-k="del">Xóa tài liệu</button>`
  );
  menu.addEventListener("click", async (e) => {
    const k = e.target.getAttribute("data-k");
    if (!k) return;
    menu.remove();
    try {
      if (k === "edit") {
        openItemModal({ mode: "edit", item });
      }
      if (k === "del") {
        if (!confirmBox(`Xóa tài liệu “${item.title}”?`)) return;
        await deleteMaterialItem(item.id);
        await selectFolder(currentId);
      }
    } catch (err) {
      alert(err.message);
    }
  });
}

function setTeacherUI(on) {
  isTeacher = !!on;
  const btn = $("btn-add-folder");
  if (btn) btn.style.display = isTeacher ? "" : "none";
}

async function loadFolders() {
  try {
    folders = await listMaterialFolders();
    folders.sort((a, b) => (a.order || 0) - (b.order || 0));
    if (folders[0]) await selectFolder(folders[0].id);
    else {
      currentId = null;
      $("folder-title").textContent = "Tài liệu tham khảo";
      $("item-list").innerHTML = isTeacher
        ? `<p class="sub">Chưa có thẻ. Bấm <strong>Thêm thẻ</strong> để tạo danh mục tài liệu.</p>`
        : `<p class="sub">Cô chưa đăng tài liệu tham khảo.</p>`;
      renderFolders();
    }
  } catch (err) {
    $("item-list").innerHTML = `<p class="sub">${err.message}</p>`;
  }
}

async function boot() {
  ensureItemModal();
  mountChrome({ active: "tailieu", role: "teacher", who: "" });

  $("btn-add-folder")?.addEventListener("click", async () => {
    if (!isTeacher) return;
    const title = promptBox("Tên thẻ mới");
    if (!title) return;
    try {
      const f = await addMaterialFolder(title);
      folders.push(f);
      renderFolders();
      await selectFolder(f.id);
    } catch (err) {
      alert(err.message);
    }
  });

  watchAuth(async (user, profile) => {
    if (!user) return;
    const role = profile && profile.role === "student" ? "student" : "teacher";
    const name = (profile && profile.hoTen) || user.email || "";
    setTeacherUI(role === "teacher");
    mountChrome({ active: "tailieu", role, who: name });
    await loadFolders();
  });
}

boot();
