import { mountChrome } from "./shell.js";
import { watchAuth } from "./auth.js";

const $ = (id) => document.getElementById(id);
const defaultState = () => ({ screen: "picker", mode: null, stopwatch: { elapsed: 0, running: false, startedAt: 0 }, countdown: { initial: 0, remaining: 0, running: false, startedAt: 0 } });
let uid = null;
let state = defaultState();
let ticker = null;
let examTicker = null;

function storageKey() { return uid ? `nv-clock-${uid}` : ""; }
function save() { if (storageKey()) sessionStorage.setItem(storageKey(), JSON.stringify(state)); }
function restore() { try { const raw = sessionStorage.getItem(storageKey()); if (raw) state = { ...defaultState(), ...JSON.parse(raw) }; } catch { state = defaultState(); } }
function formatStopwatch(ms) { const centis = Math.floor((ms % 1000) / 10), secs = Math.floor(ms / 1000) % 60, mins = Math.floor(ms / 60000) % 60, hours = Math.floor(ms / 3600000); return [hours, mins, secs, centis].map((part) => String(part).padStart(2, "0")).join(":"); }
function formatCountdown(ms) { const total = Math.max(0, Math.ceil(ms / 1000)), secs = total % 60, mins = Math.floor(total / 60) % 60, hours = Math.floor(total / 3600); return [hours, mins, secs].map((part) => String(part).padStart(2, "0")).join(":"); }
function stopwatchValue() { const s = state.stopwatch; return s.running ? s.elapsed + Date.now() - s.startedAt : s.elapsed; }
function countdownValue() { const c = state.countdown; return Math.max(0, c.running ? c.remaining - (Date.now() - c.startedAt) : c.remaining); }
function stopTicker() { clearInterval(ticker); ticker = null; }
function startTicker() { stopTicker(); ticker = setInterval(tick, 50); tick(); }
function tick() {
  if (!state.mode || state.screen !== "focus") return;
  if (state.mode === "stopwatch") $("focus-time").textContent = formatStopwatch(stopwatchValue());
  if (state.mode === "countdown") {
    const remaining = countdownValue();
    if (remaining === 0 && state.countdown.running) { state.countdown.running = false; state.countdown.remaining = 0; state.countdown.startedAt = 0; save(); showFinished(); }
    $("focus-time").textContent = formatCountdown(remaining);
    const percent = state.countdown.initial ? Math.max(0, (remaining / state.countdown.initial) * 100) : 0;
    $("focus-progress").textContent = `${Math.round(percent)}% còn lại`;
    $("clock-focus").style.setProperty("--ring-progress", `${percent * 3.6}deg`);
  }
}
function showFinished() { $("focus-label").textContent = "Đã hết giờ"; $("clock-pause").textContent = "Bắt đầu lại"; }
function stopExamTicker() { clearInterval(examTicker); examTicker = null; }
function showPicker() { stopTicker(); stopExamTicker(); document.body.classList.remove("clock-running-view"); $("clock-picker").classList.remove("hidden"); $("clock-setup").classList.add("hidden"); $("clock-focus").classList.add("hidden"); }
function showSetup(mode) {
  stopTicker(); stopExamTicker(); document.body.classList.remove("clock-running-view"); state.screen = "setup"; state.mode = mode; save();
  $("clock-picker").classList.add("hidden"); $("clock-focus").classList.add("hidden"); $("clock-setup").classList.remove("hidden");
  if (mode === "stopwatch") {
    $("setup-content").innerHTML = `<div class="clock-setup-card"><p class="section-label">Bấm giờ</p><h1>00:00:00:00</h1><p class="sub">Giờ · Phút · Giây · phần trăm giây</p><button class="btn clock-start-setup" id="start-stopwatch" type="button">Bắt đầu</button></div>`;
    $("start-stopwatch").onclick = () => { state.stopwatch = { elapsed: 0, running: true, startedAt: Date.now() }; state.screen = "focus"; state.mode = "stopwatch"; save(); showFocus(); };
  } else if (mode === "countdown") {
    $("setup-content").innerHTML = `<div class="clock-setup-card countdown-setup"><p class="section-label">Đếm ngược</p><h1>Chọn thời gian</h1><p class="sub">Chọn nhanh để bắt đầu ngay hoặc tự đặt thời gian.</p><div class="quick-times">${[5,15,30,60,90,120,150].map((m) => `<button type="button" data-quick="${m}">${m} phút</button>`).join("")}</div><div class="custom-time"><label>Giờ<select id="count-hours">${options(0,23)}</select></label><label>Phút<select id="count-minutes">${options(0,59)}</select></label><label>Giây<select id="count-seconds">${options(0,59)}</select></label></div><button class="btn clock-start-setup" id="start-custom-countdown" type="button">Bắt đầu</button><p class="err" id="countdown-error"></p></div>`;
    document.querySelectorAll("[data-quick]").forEach((button) => button.onclick = () => startCountdown(Number(button.dataset.quick) * 60000));
    $("start-custom-countdown").onclick = () => { const duration = (Number($("count-hours").value) * 3600 + Number($("count-minutes").value) * 60 + Number($("count-seconds").value)) * 1000; if (!duration) { $("countdown-error").textContent = "Chọn thời gian lớn hơn 0."; return; } startCountdown(duration); };
  } else showExam();
}
function options(from, to) { return Array.from({ length: to - from + 1 }, (_, i) => `<option value="${i}">${String(i).padStart(2, "0")}</option>`).join(""); }
function startCountdown(duration) { state.countdown = { initial: duration, remaining: duration, running: true, startedAt: Date.now() }; state.mode = "countdown"; state.screen = "focus"; save(); showFocus(); }
function showFocus() {
  $("clock-picker").classList.add("hidden"); $("clock-setup").classList.add("hidden"); $("clock-focus").classList.remove("hidden"); document.body.classList.add("clock-running-view");
  const stopwatch = state.mode === "stopwatch";
  $("focus-kicker").textContent = stopwatch ? "Bấm giờ" : "Đếm ngược";
  $("focus-label").textContent = stopwatch ? "Thời gian học tập" : "Đồng hồ hẹn giờ";
  $("focus-progress").textContent = stopwatch ? "Giờ · Phút · Giây · phần trăm giây" : "";
  $("clock-reset").classList.toggle("hidden", false);
  $("clock-pause").textContent = stopwatch ? (state.stopwatch.running ? "Tạm dừng" : "Bắt đầu") : (state.countdown.running ? "Tạm dừng" : "Tiếp tục");
  $("clock-focus").style.setProperty("--ring-progress", stopwatch ? "360deg" : "0deg");
  startTicker();
}
function pauseOrResume() {
  if (state.mode === "stopwatch") { const s = state.stopwatch; if (s.running) { s.elapsed = stopwatchValue(); s.running = false; } else { s.running = true; s.startedAt = Date.now(); } }
  else { const c = state.countdown; if (c.remaining === 0) { c.remaining = c.initial; } if (c.running) { c.remaining = countdownValue(); c.running = false; } else { c.running = true; c.startedAt = Date.now(); } }
  save(); showFocus();
}
function resetClock() {
  if (state.mode === "stopwatch") state.stopwatch = { elapsed: 0, running: false, startedAt: 0 };
  else state.countdown = { ...state.countdown, remaining: state.countdown.initial, running: false, startedAt: 0 };
  save(); showFocus();
}
function stopClock() { state = defaultState(); save(); showPicker(); }
function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function examRemaining() {
  const now = new Date(), target = new Date(2027, 5, 11, 0, 0, 0, 0), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (today >= target) return null;
  let cursor = today, months = 0;
  while (true) { const nextMonth = cursor.getMonth() + 1, nextYear = cursor.getFullYear() + Math.floor(nextMonth / 12), normalizedMonth = nextMonth % 12, next = new Date(nextYear, normalizedMonth, Math.min(cursor.getDate(), daysInMonth(nextYear, normalizedMonth))); if (next > target) break; cursor = next; months++; }
  const days = Math.floor((target - cursor) / 86400000); return { months, weeks: Math.floor(days / 7), days: days % 7 };
}
function showExam() {
  const left = examRemaining();
  $("setup-content").innerHTML = `<div class="exam-countdown"><p class="exam-bar">Đếm ngược ngày thi</p>${left ? `<div class="exam-values"><div><b>${left.months}</b><span>Tháng</span></div><div><b>${left.weeks}</b><span>Tuần</span></div><div><b>${left.days}</b><span>Ngày</span></div></div><p class="sub">Đến 00:00 ngày 11/06/2027</p>` : `<h1>Kỳ thi đã bắt đầu</h1>`}</div>`;
  stopExamTicker(); examTicker = setInterval(showExam, 60000);
}
async function toggleFullscreen() { if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.(); else await document.exitFullscreen?.(); }
document.addEventListener("fullscreenchange", () => { $("fullscreen-clock").textContent = document.fullscreenElement ? "⤢" : "⛶"; });
document.querySelectorAll("[data-mode]").forEach((button) => button.onclick = () => showSetup(button.dataset.mode));
$("back-to-picker").onclick = () => { state = defaultState(); save(); showPicker(); };
$("clock-pause").onclick = pauseOrResume; $("clock-reset").onclick = resetClock; $("clock-stop").onclick = stopClock; $("fullscreen-clock").onclick = toggleFullscreen;
mountChrome({ active: "clock", role: "student", who: "Học sinh" }); showPicker();
watchAuth((user, profile) => { if (!user) return; if (profile?.role && profile.role !== "student") { window.location.href = "home.html"; return; } uid = user.uid; mountChrome({ active: "clock", role: "student", who: profile?.hoTen || user.email || "Học sinh" }); restore(); if (state.screen === "focus" && state.mode) showFocus(); else if (state.screen === "setup" && state.mode) showSetup(state.mode); });
