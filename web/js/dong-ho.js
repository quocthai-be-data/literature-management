import { mountChrome } from "./shell.js";
import { watchAuth } from "./auth.js";

const $ = (id) => document.getElementById(id);
const content = $("clock-content");
let mode = "stopwatch";
let timer = null;
let stopwatch = { elapsed: 0, startedAt: 0, running: false };
let countdown = { initial: 0, remaining: 0, startedAt: 0, running: false };

function clearTimer() { clearInterval(timer); timer = null; }
function pad(value) { return String(value).padStart(2, "0"); }
function stopwatchMs() { return stopwatch.running ? stopwatch.elapsed + Date.now() - stopwatch.startedAt : stopwatch.elapsed; }
function countdownMs() { return Math.max(0, countdown.running ? countdown.remaining - (Date.now() - countdown.startedAt) : countdown.remaining); }
function stopwatchText(ms) { const c = Math.floor((ms % 1000) / 10), s = Math.floor(ms / 1000) % 60, m = Math.floor(ms / 60000) % 60, h = Math.floor(ms / 3600000); return [h, m, s, c].map(pad).join(":"); }
function countdownText(ms) { const all = Math.max(0, Math.ceil(ms / 1000)), s = all % 60, m = Math.floor(all / 60) % 60, h = Math.floor(all / 3600); return [h, m, s].map(pad).join(":"); }
function setActiveTab() { document.querySelectorAll("[data-tab]").forEach((tab) => tab.classList.toggle("on", tab.dataset.tab === mode)); }
function render() { clearTimer(); setActiveTab(); if (mode === "stopwatch") renderStopwatch(); if (mode === "countdown") renderCountdownSetup(); if (mode === "exam") renderExam(); }
function stage(title, subtitle, body) { return `<section class="clock-stage"><p class="section-label">${title}</p>${subtitle ? `<p class="clock-subtitle">${subtitle}</p>` : ""}${body}</section>`; }
function renderStopwatch() {
  content.innerHTML = `<section class="clock-stage stopwatch-stage"><output id="clock-display" class="clock-display">${stopwatchText(stopwatchMs())}</output><div class="clock-actions"><button id="stopwatch-start" class="clock-action start" type="button">Bắt đầu</button><button id="stopwatch-stop" class="clock-action pause" type="button" ${stopwatch.running ? "" : "disabled"}>Dừng</button><button id="stopwatch-reset" class="clock-action reset" type="button" ${stopwatch.running ? "disabled" : ""}>Đặt lại</button></div></section>`;
  $("stopwatch-start").onclick = () => { if (!stopwatch.running) { stopwatch.running = true; stopwatch.startedAt = Date.now(); renderStopwatch(); } };
  $("stopwatch-stop").onclick = () => { stopwatch.elapsed = stopwatchMs(); stopwatch.running = false; renderStopwatch(); };
  $("stopwatch-reset").onclick = () => { stopwatch = { elapsed: 0, startedAt: 0, running: false }; renderStopwatch(); };
  if (stopwatch.running) { timer = setInterval(() => { const display = $("clock-display"); if (display) display.textContent = stopwatchText(stopwatchMs()); }, 40); }
}
function numberOptions(min, max, selected = min) { return Array.from({ length: max - min + 1 }, (_, index) => { const value = min + index; return `<option value="${value}" ${value === selected ? "selected" : ""}>${pad(value)}</option>`; }).join(""); }
function renderCountdownSetup() {
  countdown.running = false;
  content.innerHTML = stage("Đếm ngược", "Chọn mốc nhanh hoặc tự đặt thời gian", `<div class="quick-times">${[5,10,15,30,60,90,120].map((minutes) => `<button data-quick="${minutes}" type="button">${minutes} phút</button>`).join("")}</div><div class="custom-countdown"><label>Số giờ<select id="custom-hours">${numberOptions(1, 12, 1)}</select></label><label>Số phút<select id="custom-minutes">${numberOptions(0, 59, 0)}</select></label><button id="custom-countdown" class="btn" type="button">Chọn thời gian</button></div>`);
  document.querySelectorAll("[data-quick]").forEach((button) => button.onclick = () => openCountdown(Number(button.dataset.quick) * 60000));
  $("custom-countdown").onclick = () => openCountdown((Number($("custom-hours").value) * 3600 + Number($("custom-minutes").value) * 60) * 1000);
}
function openCountdown(duration) { clearTimer(); countdown = { initial: duration, remaining: duration, startedAt: 0, running: false }; renderCountdownRun(); }
function renderCountdownRun(message = "") {
  clearTimer();
  const remaining = countdownMs();
  content.innerHTML = stage("Đếm ngược", "Giờ : Phút : Giây", `<output id="clock-display" class="clock-display">${countdownText(remaining)}</output><p id="clock-message" class="clock-message">${message}</p><div class="clock-actions countdown-actions"><button id="countdown-start" class="clock-action start" type="button">${remaining === 0 ? "Bắt đầu lại" : "Bắt đầu"}</button><button id="countdown-stop" class="clock-action pause" type="button" ${countdown.running ? "" : "disabled"}>Dừng</button><button id="countdown-reset" class="clock-action reset" type="button" ${countdown.running ? "disabled" : ""}>Đặt lại</button><button id="countdown-cancel" class="clock-action cancel" type="button" ${countdown.running ? "disabled" : ""}>Hủy</button></div>`);
  $("countdown-start").onclick = () => { if (countdownMs() === 0) countdown.remaining = countdown.initial; countdown.running = true; countdown.startedAt = Date.now(); renderCountdownRun(); };
  $("countdown-stop").onclick = () => { countdown.remaining = countdownMs(); countdown.running = false; renderCountdownRun(); };
  $("countdown-reset").onclick = () => { countdown.remaining = countdown.initial; countdown.running = false; countdown.startedAt = 0; renderCountdownRun(); };
  $("countdown-cancel").onclick = renderCountdownSetup;
  if (countdown.running) timer = setInterval(() => { const remainingNow = countdownMs(), display = $("clock-display"); if (display) display.textContent = countdownText(remainingNow); if (!remainingNow) { countdown.running = false; countdown.remaining = 0; clearTimer(); const messageEl = $("clock-message"); if (messageEl) messageEl.textContent = "Đã hết giờ."; $("countdown-stop").disabled = true; $("countdown-reset").disabled = false; $("countdown-cancel").disabled = false; } }, 200);
}
function examParts() { const now = new Date(), target = new Date(2027, 5, 12, 0, 0, 0, 0), ms = target - now; if (ms <= 0) return null; const total = Math.floor(ms / 1000), seconds = total % 60, minutes = Math.floor(total / 60) % 60, hours = Math.floor(total / 3600) % 24, days = Math.floor(total / 86400); return [days, hours, minutes, seconds]; }
function examText(parts) { return parts.map(pad).join(":"); }
function renderExam() {
  const parts = examParts();
  content.innerHTML = stage("Đếm ngược ngày thi", "Ngày : Giờ : Phút : Giây", `<output id="exam-display" class="clock-display exam-display${parts ? "" : " exam-complete"}">${parts ? examText(parts) : "00:00:00:00"}</output><p id="exam-message" class="exam-message">${parts ? "ĐẾM NGƯỢC ĐẾN NGÀY 12/06/2027" : "Đã bắt đầu kì thi, chúc các sĩ tử làm bài thật tốt và đạt được nguyện vọng mong muốn 🍀 🍀 🍀"}</p>`);
  if (parts) timer = setInterval(() => { const next = examParts(), display = $("exam-display"), message = $("exam-message"); if (!next) { clearTimer(); display.textContent = "00:00:00:00"; display.classList.add("exam-complete"); message.textContent = "Đã bắt đầu kì thi, chúc các sĩ tử làm bài thật tốt và đạt được nguyện vọng mong muốn 🍀 🍀 🍀"; } else display.textContent = examText(next); }, 1000);
}
document.querySelectorAll("[data-tab]").forEach((tab) => tab.onclick = () => { mode = tab.dataset.tab; render(); });
mountChrome({ active: "clock", role: "student", who: "Học sinh" });
watchAuth((user, profile) => { if (!user) return; if (profile?.role && profile.role !== "student") { window.location.href = "home.html"; return; } mountChrome({ active: "clock", role: "student", who: profile?.hoTen || user.email || "Học sinh" }); });
render();
