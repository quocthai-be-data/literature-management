import { mountChrome } from "./shell.js";
import { watchAuth, logout } from "./auth.js";
import { saveUserProfile } from "./firestore.js";

function snapshot(form) {
  return JSON.stringify(
    [...form.elements]
      .filter((el) => el.name)
      .map((el) => [el.name, el.value.trim()])
  );
}

export function bootProfile({ role, titleWho }) {
  const form = document.getElementById("pf");
  const saveBtn = form.querySelector("button[type=submit]");
  const msg = document.getElementById("msg");
  let editing = true;
  let savedSnap = "";
  let loaded = false;

  function setEditing(on) {
    editing = on;
    [...form.querySelectorAll("input")].forEach((el) => {
      el.disabled = !on;
    });
    saveBtn.textContent = on ? "Lưu" : "Chỉnh sửa";
  }

  function dirty() {
    return loaded && editing && snapshot(form) !== savedSnap;
  }

  async function saveNow() {
    const { auth } = await import("./firebase-init.js");
    const u = auth && auth.currentUser;
    if (!u) throw new Error("Chưa đăng nhập.");
    const payload = {
      hoTen: form.hoTen.value.trim(),
      sdt: form.sdt.value.trim(),
      gmail: form.gmail.value.trim(),
    };
    if (form.lop) payload.lop = form.lop.value.trim();
    await saveUserProfile(u.uid, payload);
    savedSnap = snapshot(form);
    setEditing(false);
    mountChrome({ active: "", role, who: payload.hoTen });
    bindNavGuard();
    return payload;
  }

  async function confirmLeave() {
    if (!dirty()) return true;
    const saveFirst = window.confirm(
      "Bạn chưa lưu thông tin. Bấm OK để lưu rồi thoát, Cancel để thoát không lưu."
    );
    if (saveFirst) {
      try {
        await saveNow();
      } catch (err) {
        msg.textContent = err.message;
        return false;
      }
    }
    return true;
  }

  mountChrome({ active: "", role, who: titleWho });

  watchAuth((user, profile) => {
    if (!user) return;
    const name = (profile && profile.hoTen) || "";
    mountChrome({ active: "", role, who: name });
    form.hoTen.value = name;
    form.sdt.value = (profile && profile.sdt) || "";
    if (form.lop) form.lop.value = (profile && profile.lop) || "";
    form.gmail.value = (profile && profile.gmail) || user.email || "";
    savedSnap = snapshot(form);
    loaded = true;
    setEditing(false);
    bindNavGuard();
  });

  const headerSlot = document.getElementById("header-slot");
  function bindNavGuard() {
    if (headerSlot.dataset.guard === "1") return;
    headerSlot.dataset.guard = "1";
    headerSlot.addEventListener("click", async (e) => {
      const a = e.target.closest("a");
      if (!a || !dirty()) return;
      e.preventDefault();
      if (await confirmLeave()) location.href = a.getAttribute("href");
    });
  }

  window.addEventListener("beforeunload", (e) => {
    if (!dirty()) return;
    e.preventDefault();
    e.returnValue = "";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!editing) {
      setEditing(true);
      msg.textContent = "";
      form.hoTen.focus();
      return;
    }
    msg.textContent = "";
    try {
      await saveNow();
      msg.textContent = "Đã lưu.";
    } catch (err) {
      msg.textContent = err.message;
    }
  });

  document.getElementById("out").addEventListener("click", async (e) => {
    e.preventDefault();
    if (!(await confirmLeave())) return;
    await logout();
    location.href = "login.html";
  });
}
