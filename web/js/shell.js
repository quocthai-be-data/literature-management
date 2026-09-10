const SCHOOL_FB = "https://www.facebook.com/profile.php?id=61584605757923";
const DEV_FB = "https://www.facebook.com/quocthai1796";
const DEV_MAIL = "quocthai17096@gmail.com";

const iconMail = `
<svg class="icon-btn" viewBox="0 0 24 24" aria-hidden="true">
  <rect x="3" y="6" width="18" height="12" rx="2" fill="#e9ffb3"/>
  <path d="M4 7l8 6 8-6" fill="none" stroke="#0b3a5b" stroke-width="1.6"/>
</svg>`;

const iconFace = `
<svg class="icon-btn" viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="10" fill="#04b4c4"/>
  <path d="M13.2 17v-5h1.6l.3-2h-1.9V8.7c0-.5.2-.9.9-.9H15V6.1S14.4 6 13.6 6c-1.7 0-2.8 1-2.8 2.9V10H9.2v2h1.6v5h2.4z" fill="#fff"/>
</svg>`;

export function footerHtml() {
  return `
<footer class="site-footer">
  <div class="foot-grid">
    <div class="foot-brand">
      <a href="${SCHOOL_FB}" target="_blank" rel="noopener">
        <img src="assets/logo_hvn.jpg" alt="Logo THPT Huỳnh Văn Nghệ" />
      </a>
      <div>
        <h3>Trường THPT Huỳnh Văn Nghệ</h3>
        <p>3Q6X+W39, 747, Tân Uyên, Hồ Chí Minh, Việt Nam</p>
        <p style="margin-top:8px">Môn: Ngữ văn 12</p>
      </div>
    </div>
    <div>
      <h3>Phụ trách</h3>
      <p>Giáo viên quản lý web<br>Nguyễn Lưu Hoàng Hữu Duyên</p>
      <p style="margin-top:10px">Người làm web<br>Trương Minh Quốc Thái</p>
    </div>
    <div>
      <h3>Góp ý</h3>
      <a class="contact-row" href="mailto:${DEV_MAIL}">
        ${iconMail}
        <span>${DEV_MAIL}</span>
      </a>
      <a class="contact-row" href="${DEV_FB}" target="_blank" rel="noopener">
        ${iconFace}
        <span>Quốc Thái</span>
      </a>
    </div>
  </div>
  <div class="foot-bar">Ngữ văn 12 · THPT Huỳnh Văn Nghệ</div>
</footer>`;
}

export function headerHtml({ active = "home", who = "", role = "teacher" } = {}) {
  const home = role === "student" ? "home-hs.html" : "home.html";
  const hoc = role === "student" ? "hoc-hs.html" : "hoc.html";
  const luyen = role === "student" ? "luyen-tap-hs.html" : "luyen-tap.html";
  return `
<header class="site-header">
  <a class="brand" href="${home}">
    <img src="assets/logo_hvn.jpg" alt="" />
    <span>
      <strong>Ngữ văn 12</strong>
      <small>THPT Huỳnh Văn Nghệ</small>
    </span>
  </a>
  <nav class="nav-main">
    <a class="${active === "home" ? "on" : ""}" href="${home}">Trang chủ</a>
    <a class="${active === "hoc" ? "on" : ""}" href="${hoc}">Học</a>
    <a class="${active === "luyen" ? "on" : ""}" href="${luyen}">Luyện tập</a>
  </nav>
  <div class="who">${who}</div>
</header>`;
}

export function mountChrome({ header = true, active, who, role = "teacher" } = {}) {
  if (header) {
    const slot = document.getElementById("header-slot");
    if (slot) slot.innerHTML = headerHtml({ active, who, role });
  }
  const foot = document.getElementById("footer-slot");
  if (foot) foot.innerHTML = footerHtml();
}
