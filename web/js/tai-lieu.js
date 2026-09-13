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

function normalizeUrl(raw) {
  let u = String(raw || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return "https://" + u;
}

let isTeacher = true;
let folders = [];
let currentId = null;
let items = [];
let itemModalMode = "add";
let itemModalFolder = null;
let itemModalItem = null;
let cardModalMode = "add"; // add folder(+optional item) | rename
let cardModalFolder = null;

function ensureItemModal() {
  if ($("mat-modal")) return;
  const wrap = document.createElement("div");
  wrap.id = "mat-modal";
  wrap.className = "modal-back hidden";
  wrap.innerHTML = `
    <div class="modal">
      <h2 id="mat-modal-heading">Thêm tài liệu</h2>
      <label>Tên tài liệu tham khảo</label>
      <input id="mat-title" placeholder="Ví dụ: Ngữ liệu nghị luận ngoài SGK" />
      <label>Link tài liệu tham khảo</label>
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

function ensureCardModal() {
  if ($("card-modal")) return;
  const wrap = document.createElement("div");
  wrap.id = "card-modal";
  wrap.className = "modal-back hidden";
  wrap.innerHTML = `
    <div class="modal">
      <h2 id="card-modal-heading">Thêm thẻ</h2>
      <label id="card-title-label">Tên tài liệu tham khảo</label>
      <input id="card-title" placeholder="Ví dụ: Ngữ liệu ngoài SGK" />
      <label id="card-url-label">Link tài liệu tham khảo</label>
      <input id="card-url" placeholder="https://docs.google.com/... (có thể để trống)" />
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
    $("card-title-label").textContent = "Tên thẻ";
    $("card-title").value = folder ? folder.title : "";
    $("card-url-label").style.display = "none";
    $("card-url").style.display = "none";
    $("card-url").value = "";
  } else {
    $("card-modal-heading").textContent = "Thêm thẻ";
    $("card-title-label").textContent = "Tên tài liệu tham khảo";
    $("card-url-label").style.display = "";
    $("card-url").style.display = "";
    $("card-title").value = "";
    $("card-url").value = "";
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
  const url = normalizeUrl($("card-url").value);
  const err = $("card-err");
  err.textContent = "";
  if (!title) {
    err.textContent = "Nhập tên tài liệu tham khảo.";
    return;
  }
  try {
    if (cardModalMode === "rename" && cardModalFolder) {
      await renameMaterialFolder(cardModalFolder.id, title);
      cardModalFolder.title = title;
      renderFolders();
      if (currentId === cardModalFolder.id) $("folder-title").textContent = title;
      closeCardModal();
      return;
    }
    const f = await addMaterialFolder(title);
    folders.push(f);
    if (url) {
      await addMaterialItem(f.id, title, url);
    }
    closeCardModal();
    renderFolders();
    await selectFolder(f.id);
  } catch (e) {
    err.textContent = e.message;
  }
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
    box.innerHTML = `<p class="sub">Chưa có tài liệu</p>`;
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
        openCardModal({ mode: "rename", folder });
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
            $("item-list").innerHTML = `<p class="sub">Chưa có tài liệu</p>`;
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
      $("item-list").innerHTML = `<p class="sub">Chưa có tài liệu</p>`;
      renderFolders();
    }
  } catch (err) {
    $("item-list").innerHTML = `<p class="sub">${err.message}</p>`;
  }
}

async function boot() {
  ensureItemModal();
  ensureCardModal();
  setTeacherUI(true);
  mountChrome({ active: "tailieu", role: "teacher", who: "" });

  $("btn-add-folder")?.addEventListener("click", () => {
    if (!isTeacher) return;
    openCardModal({ mode: "add" });
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
