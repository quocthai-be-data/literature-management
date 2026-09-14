# Bàn giao dự án — Website Ngữ văn 12 (THPT Huỳnh Văn Nghệ)

**Ngày bàn giao:** 14/09/2026  
**Repo:** [quocthai-be-data/literature-management](https://github.com/quocthai-be-data/literature-management)  
**Deploy:** Vercel — `https://literature-management.vercel.app`  
**Stack:** HTML/CSS/JS thuần (ES modules) + Firebase (Auth, Firestore, Functions, Storage)

Tài liệu này mô tả **user flow**, **tính năng từng trang**, **cấu trúc code**, **dữ liệu Firestore**, **điểm cần lưu ý khi sửa** và **việc chưa làm / nên ưu tiên**.

---

## 1. Mục tiêu sản phẩm

Web hỗ trợ **ôn thi THPTQG Ngữ văn 12**, phân quyền:

| Vai trò | Mục đích chính |
|--------|----------------|
| **Giáo viên (GV)** | Đăng bài giảng, đề/bài tập, tài liệu tham khảo; cấp tài khoản HS; quản lý nội dung |
| **Học sinh (HS)** | Xem / mở link bài giảng, đề, bài tập (có deadline), tài liệu |

Không có tự đăng ký công khai. Tài khoản HS do GV cấp (Excel → Cloud Function).

---

## 2. User flow tổng quan

```
[index.html] → redirect login.html
        │
        ▼
   Đăng nhập (chọn vai trò GV/HS + identifier + mật khẩu)
        │
        ├─ Lần đầu / bắt buộc đổi MK → doi-mat-khau.html
        │
        ├─ role = teacher → home.html
        │       ├─ Bài giảng (bai-giang.html)
        │       ├─ Luyện tập (luyen-tap.html)
        │       ├─ Tài liệu tham khảo (tai-lieu.html)
        │       ├─ Hồ sơ (hoso.html)
        │       └─ Cấp TK HS (cap-tai-khoan.html) — truy cập trực tiếp URL
        │
        └─ role = student → home-hs.html
                ├─ Bài giảng (bai-giang-hs.html)
                ├─ Luyện tập (luyen-tap-hs.html)
                ├─ Tài liệu (tai-lieu.html — UI theo role sau auth)
                └─ Hồ sơ (hoso-hs.html)
```

**Quên mật khẩu:** `quen-mat-khau.html` (gửi hướng dẫn qua Firebase Auth).  
**Khởi tạo GV test:** `khoi-tao-gv.html` (gọi Cloud Function `seedTeacher` + token secret).

### 2.1. Luồng đăng nhập (chi tiết)

1. User chọn **Vai trò** (HS / GV), nhập **Tên đăng nhập** hoặc email, **Mật khẩu**.
2. `auth.js` → `toAuthEmail(identifier)`:
   - Có `@` → dùng nguyên;
   - Không `@` → `identifier@` + domain trong `firebase-config.js` (`SCHOOL_EMAIL_DOMAIN`).
3. `signInWithEmailAndPassword` → đọc profile `users/{uid}` trên Firestore.
4. Điều hướng theo `profile.role` (`teacher` | `student`) và cờ đổi mật khẩu (nếu có).
5. Header/footer chỉ hiện **sau khi đã vào trang app** (trang login / đổi MK / quên MK **không** footer).

### 2.2. Navbar (sau đăng nhập)

Gắn qua `shell.js` → `mountChrome({ active, role, who })`:

| Phần tử | Hành vi |
|--------|---------|
| Logo + tên trường | Brand |
| 🏠 Home | `home.html` / `home-hs.html` |
| Bài giảng | `bai-giang.html` / `bai-giang-hs.html` |
| Luyện tập | `luyen-tap.html` / `luyen-tap-hs.html` |
| Tài liệu tham khảo | `tai-lieu.html` |
| Tên + avatar | Vào hồ sơ |

Trang HTML GV/HS tách file; JS dùng chung, phân quyền bằng `window.NV_ROLE` (`"teacher"` | `"student"`).

---

## 3. Tính năng theo từng trang

### 3.1. Trang chủ

#### GV — `home.html` + script inline (`shell.js` + `auth.js`)

- **Việc hôm nay:** 4 ô thống kê (placeholder UI: số lớp, nháp, chưa chấm, đề sắp hết hạn) — **chưa nối logic thật**.
- **Hai trụ:** link nhanh Bài giảng / Luyện tập.
- Footer: thông tin trường, liên hệ, dev.

#### HS — `home-hs.html`

- **Không thẻ nội dung:** chỉ ảnh full `assets/home_image.png` (class `.home-hero`).
- Header + footer vẫn hiện.

---

### 3.2. Bài giảng

| File | Vai trò |
|------|---------|
| `bai-giang.html` + `js/bai-giang.js` | GV |
| `bai-giang-hs.html` + cùng JS | HS (`NV_ROLE=student`) |
| Data layer | `js/weeks.js` |

**Layout:** 2 cột (`.course-layout`):

- **Trái — Danh sách thẻ (tuần):** collection Firestore `weeks` (seed 20 tuần nếu rỗng, chỉ khi GV).
- **Phải — Bài giảng trong thẻ:** collection `lessons` (field: `weekId`, `title`, `url`, `createdAt`).

**User flow GV:**

1. Chọn thẻ tuần bên trái (hoặc **Thêm thẻ** → modal chỉ **Tên thẻ**).
2. Kéo-thả sắp xếp thẻ → `saveWeekOrder`.
3. Menu ⋮ trên thẻ: **Thêm bài giảng** | **Đổi tên** | **Xóa thẻ** (xóa cascade lessons).
4. **Thêm / Sửa bài giảng:** modal 2 field **Tên bài giảng** + **Link bài giảng**.
5. Thẻ bài trên panel phải: click → mở link tab mới; ⋮ → Sửa / Xóa.

**User flow HS:**

- Chỉ xem + click mở link; **không** nút Thêm thẻ, không ⋮, không kéo-thả.

**Ảnh thẻ bài:** `assets/lesson_image.jpg`.

---

### 3.3. Luyện tập

| File | Vai trò |
|------|---------|
| `luyen-tap.html` + `js/luyen-tap.js` | GV |
| `luyen-tap-hs.html` + cùng JS | HS |
| Data layer | `js/practice.js` |

**Cấu trúc thư mục (1 cấp con):**

Collection `practiceFolders`:

- 5 thẻ gốc **seed** (nếu rỗng, chỉ GV):
  1. Đọc - hiểu (`kind: de`)
  2. Nghị luận văn học (`de`)
  3. Nghị luận xã hội (`de`)
  4. Đề thi các năm (`de`)
  5. Bài tập (`kind: baitap`, `seedKey: bai-tap`)
- Thẻ gốc có thể có **thẻ con** (1 cấp; thẻ con **không** thêm thẻ con nữa).

Collection `practiceItems`: `folderId`, `title`, `url`, `deadline` (ISO string hoặc null), `createdAt`.

**User flow GV:**

1. **Thêm thẻ** → modal **Tên thẻ** (nếu tên khớp “Bài tập” → `kind: baitap`).
2. ⋮ thẻ gốc: **Thêm thẻ con** | **Thêm tài liệu / Thêm bài tập** | **Đổi tên** | **Xóa** (cascade).
3. ⋮ thẻ con: không “Thêm thẻ con”; còn Thêm nội dung / Đổi tên / Xóa.
4. Modal thêm/sửa nội dung:
   - **Tên**, **Link**, **Thời hạn (datetime-local)** — field Thời hạn hiện **mọi loại thẻ**.
   - **Bài tập:** deadline **bắt buộc**.
   - Các mục đề: deadline **tuỳ chọn**.
5. Panel phải: thẻ nội dung hiện **Deadline …** (hoặc **Deadline hết hạn …**) bên phải, trái ⋮.
6. Click thẻ → mở link; HS quá hạn → alert *"Đã hết hạn nộp"* (không mở link).

**Ảnh:**

- Thẻ thuộc nhánh Bài tập: `assets/image_baitap.jpg`
- Còn lại: `assets/image_de.jpg`

**`folderKind(folder, allFolders)`:** walk lên root; `kind === "baitap"` | `seedKey === "bai-tap"` | title ~ “Bài tập”.

---

### 3.4. Tài liệu tham khảo

| File | Logic |
|------|--------|
| `tai-lieu.html` + `js/tai-lieu.js` | Cả GV/HS (role từ `watchAuth`) |
| Data | `js/materials.js` → `materialFolders`, `materialItems` |

**Giống Bài giảng** về layout 2 cột, nhưng:

- Danh sách thẻ **để trống** ban đầu (không seed).
- Nút **Thêm thẻ** (chỉ tên).
- Trong thẻ: **Thêm tài liệu** → Tên + Link.
- Ảnh thẻ: `assets/image_tltk.jpg`.
- Empty state: *"Chưa có tài liệu"*.

---

### 3.5. Hồ sơ

| File | Role |
|------|------|
| `hoso.html` | GV |
| `hoso-hs.html` | HS |
| Logic | `js/profile-page.js` |

- Layout 4.5 : 5.5 (form | ảnh nền `background_info.png`).
- Field: họ tên, SĐT, (HS có Lớp), Gmail; Lưu lên `users/{uid}`.
- Đăng xuất → login.

---

### 3.6. Cấp tài khoản HS — `cap-tai-khoan.html`

- Chỉ GV (check `profile.role`).
- Upload Excel/CSV (cột: `hoTen`, `sdt`, `lop`, `namNhapHoc`) → Cloud Function `provisionStudents`.
- Hiện bảng username + mật khẩu mặc định; tải CSV phát một lần.

---

### 3.7. Auth phụ

| Trang | Việc |
|-------|------|
| `login.html` | Form đăng nhập; khung form nền xanh nhạt `#eef8fa`, không át input |
| `doi-mat-khau.html` | Đổi MK lần đầu / bắt buộc |
| `quen-mat-khau.html` | Reset qua email |
| `khoi-tao-gv.html` | Seed GV qua Function + bootstrap token |

---

## 4. Cấu trúc thư mục quan trọng

```
literature-management/
├── web/
│   ├── index.html              # redirect → login
│   ├── login.html, doi-mat-khau.html, quen-mat-khau.html
│   ├── home.html, home-hs.html
│   ├── bai-giang.html, bai-giang-hs.html
│   ├── luyen-tap.html, luyen-tap-hs.html
│   ├── tai-lieu.html
│   ├── hoso.html, hoso-hs.html
│   ├── cap-tai-khoan.html, khoi-tao-gv.html
│   ├── css/app.css             # design system + mobile @media ≤900px
│   ├── css/profile-visual.css
│   ├── js/
│   │   ├── firebase-config.js  # ⚠️ secrets / project keys
│   │   ├── firebase-init.js
│   │   ├── auth.js, shell.js
│   │   ├── weeks.js, bai-giang.js
│   │   ├── practice.js, luyen-tap.js
│   │   ├── materials.js, tai-lieu.js
│   │   ├── profile-page.js, callables.js
│   │   └── ...
│   └── assets/                 # logo, home_image, image_de, image_baitap, image_tltk, web_icon, ...
├── functions/                  # Cloud Functions (nếu có trong repo)
└── firestore.rules
```

**Favicon:** mọi HTML có  
`<link rel="icon" href="assets/web_icon.jpg" type="image/jpeg" />`

---

## 5. Design system (tóm tắt)

File: `web/css/app.css`

| Token | Giá trị |
|-------|---------|
| Lime pale | `#e9ffb3` |
| Lime | `#cfff4d` |
| Teal | `#04b4c4` |
| Teal dark | `#038a96` |
| Gradient header/accent | lime → teal |
| Ink | `#163038` |
| Page min-width desktop | `1240px` (`.page-shell`) |
| Mobile | `@media (max-width: 900px)` **chỉ override**, không xoá rule desktop |

**Deadline trên thẻ:** `.lesson-card .deadline` — 14px, font-weight 600; `.over` màu danger.

---

## 6. Firestore — collections chính

| Collection | Mục đích | Field chính |
|------------|----------|-------------|
| `users` | Profile | `role`, `hoTen`, `sdt`, `lop`, `gmail`, … |
| `weeks` | Thẻ bài giảng | `title`, `order`, `createdAt` |
| `lessons` | Bài trong tuần | `weekId`, `title`, `url`, `createdAt` |
| `practiceFolders` | Thẻ luyện tập | `title`, `parentId`, `order`, `kind`, `seedKey` |
| `practiceItems` | Đề / bài tập | `folderId`, `title`, `url`, `deadline`, `createdAt` |
| `materialFolders` | Thẻ tài liệu | `title`, `order`, `createdAt` |
| `materialItems` | File/link TL | `folderId`, `title`, `url`, `createdAt` |

Rules: file `firestore.rules` — cần deploy khi đổi quyền đọc/ghi.

---

## 7. Phân quyền UI (tóm tắt)

| Hành động | GV | HS |
|-----------|----|----|
| Thêm / đổi tên / xóa thẻ | Có | Không |
| Thêm / sửa / xóa nội dung | Có | Không |
| Kéo-thả sắp xếp | Có | Không |
| Xem + mở link | Có | Có |
| Mở bài tập quá hạn | Có | Không (alert) |
| Cấp tài khoản | Có | Không |

Cơ chế: `window.NV_ROLE` trên từng HTML + `profile.role` từ Firestore qua `watchAuth`.

---

## 8. Quy ước khi sửa code (quan trọng)

1. **Chỉ sửa file / đoạn liên quan** — không refactor lan sang module khác nếu không cần.
2. **Không xoá** rule CSS desktop khi chỉnh mobile — chỉ thêm/override trong `@media`.
3. **Thêm thẻ** = modal **chỉ tên**; **Thêm bài/đề/TL** = modal **tên + link** (+ deadline ở Luyện tập).
4. Phân trang GV/HS: giữ `NV_ROLE` và cặp file `*-hs.html`.
5. Link luôn `normalizeUrl` (thêm `https://` nếu thiếu).
6. Sau deploy Vercel: hard refresh (Ctrl+F5); favicon hay bị cache.

---

## 9. Việc đã làm gần đây (context bàn giao)

- Mobile responsive (`@media max-width: 900px`).
- Favicon `web_icon.jpg`.
- Luyện tập: hiện **Deadline** trên thẻ; field thời hạn cho **mọi** mục (bắt buộc ở Bài tập).
- Click thẻ mở link ổn định (thẻ `<a>`); HS quá hạn bị chặn.
- Tài liệu tham khảo: CRUD giống bài giảng, list rỗng mặc định.
- Home HS: chỉ ảnh hero; login không footer.

---

## 10. Việc chưa làm / gợi ý ưu tiên tiếp

1. **Trang chủ GV:** số liệu thống kê thật (Firestore queries / aggregation).
2. **Quản lý lớp / phân lớp nhận bài** — từng hoãn sang “Chi tiết trang chủ”.
3. **Chấm điểm / nộp bài:** hiện chỉ link (Google Form); chưa có chấm trong web.
4. **Khoá nội dung mẫu / phân quyền lớp** chi tiết hơn rules.
5. **Trang `hoc.html` / `hoc-hs.html`:** còn UI demo cũ, có thể trùng vai trò với Bài giảng — cân nhắc gỡ hoặc nối.
6. **Bảo mật:** rà `firebase-config.js`, rules, token bootstrap; không commit secret mới lên public.
7. **Kiểm thử:** matrix GV/HS × Bài giảng / Luyện tập (deadline) / Tài liệu / mobile.

---

## 11. Cách chạy / deploy nhanh

1. Clone repo, cấu hình `web/js/firebase-config.js` (project Firebase đúng).
2. Mở local: static server trỏ thư mục `web/` (hoặc dùng Vercel preview).
3. Deploy: push `main` → Vercel auto (nếu đã nối repo).
4. Functions: deploy riêng (`firebase deploy --only functions`) khi sửa cấp TK / seedTeacher.
5. Rules: `firebase deploy --only firestore:rules`.

---

## 12. Liên hệ kỹ thuật trong footer (shell.js)

- Trường: Facebook page trong `SCHOOL_FB`
- Dev: Facebook / email trong `DEV_FB`, `DEV_MAIL`

---

## 13. Checklist bàn giao cho người nhận

- [ ] Clone được repo, chạy được login với tài khoản GV/HS test  
- [ ] Hiểu flow 5 mục nav + auth  
- [ ] Biết collections Firestore tương ứng từng trang  
- [ ] Sửa thử 1 field copy trên Luyện tập / Bài giảng mà không phá CRUD  
- [ ] Biết chỗ mobile CSS và chỗ **không** được đụng  
- [ ] Có quyền Firebase Console (Auth, Firestore, Functions)  
- [ ] Đọc `firestore.rules` và `callables.js` trước khi đổi provision HS  

---

*Tài liệu bàn giao — dự án Ngữ văn 12 / literature-management. Cập nhật khi kiến trúc hoặc collection thay đổi.*
