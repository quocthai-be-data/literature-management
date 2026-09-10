const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { baseUsername, allocateUsername } = require("./username");
const { generateDefaultPassword } = require("./password");

setGlobalOptions({ region: "asia-southeast1", maxInstances: 5 });
initializeApp();

const SCHOOL_DOMAIN = "school.local";

function toStudentEmail(username) {
  return `${username}@${SCHOOL_DOMAIN}`;
}

async function requireTeacher(uid) {
  if (!uid) {
    throw new HttpsError("unauthenticated", "Cần đăng nhập giáo viên.");
  }
  const db = getFirestore();
  const snap = await db.collection("users").doc(uid).get();
  const data = snap.exists ? snap.data() : null;
  if (!data || data.role !== "teacher") {
    throw new HttpsError("permission-denied", "Chỉ giáo viên được gọi hàm này.");
  }
  if (data.mustChangePassword === true) {
    throw new HttpsError("failed-precondition", "Đổi mật khẩu trước khi cấp tài khoản.");
  }
  return data;
}

/**
 * Tạo đúng 1 tài khoản giáo viên để test.
 * Gọi 1 lần sau khi deploy. Nếu đã có GV với email này thì không tạo trùng.
 *
 * Mật khẩu lấy từ biến môi trường Function:
 *   firebase functions:secrets:set TEACHER_BOOTSTRAP_PASSWORD
 * Email / tên có thể đổi bằng params lúc gọi, mặc định cô Duyên.
 */
exports.seedTeacher = onCall(
  { secrets: ["TEACHER_BOOTSTRAP_PASSWORD", "TEACHER_BOOTSTRAP_TOKEN"] },
  async (req) => {
  const token = req.data && req.data.token;
  if (!process.env.TEACHER_BOOTSTRAP_TOKEN || token !== process.env.TEACHER_BOOTSTRAP_TOKEN) {
    throw new HttpsError("permission-denied", "Sai token khởi tạo giáo viên.");
  }
  const email = String((req.data && req.data.email) || "duyen.nguyen@thpthuynhvannge.edu.vn")
    .trim()
    .toLowerCase();
  const displayName =
    (req.data && req.data.displayName) || "Nguyễn Lưu Hoàng Hữu Duyên";
  const password = process.env.TEACHER_BOOTSTRAP_PASSWORD;
  if (!password || password.length < 8) {
    throw new HttpsError(
      "failed-precondition",
      "Chưa set secret TEACHER_BOOTSTRAP_PASSWORD (tối thiểu 8 ký tự)."
    );
  }

  const auth = getAuth();
  const db = getFirestore();
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    user = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: false,
    });
  }

  await db.collection("users").doc(user.uid).set(
    {
      role: "teacher",
      email,
      hoTen: displayName,
      username: email,
      mustChangePassword: false,
      classIds: ["12A1", "12A3"],
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    uid: user.uid,
    email,
    note: "Đăng nhập bằng email này và mật khẩu đã set trong secret. Không trả password qua response.",
  };
});

/**
 * Cấp TK học sinh hàng loạt.
 * Client CHỈ gửi hàng Excel đã đọc: { hoTen, sdt, lop, namNhapHoc }.
 * Username + password + createUser + profile chỉ chạy ở đây.
 */
exports.provisionStudents = onCall(async (req) => {
  const teacher = await requireTeacher(req.auth && req.auth.uid);
  const rows = (req.data && req.data.rows) || [];
  if (!Array.isArray(rows) || !rows.length) {
    throw new HttpsError("invalid-argument", "Thiếu danh sách hàng Excel.");
  }
  if (rows.length > 200) {
    throw new HttpsError("invalid-argument", "Tối đa 200 hàng mỗi lần.");
  }

  const auth = getAuth();
  const db = getFirestore();
  const issued = [];
  const errors = [];

  for (const raw of rows) {
    const row = {
      hoTen: String(raw.hoTen || "").trim(),
      sdt: String(raw.sdt || "").trim(),
      lop: String(raw.lop || "").trim(),
      namNhapHoc: String(raw.namNhapHoc || "").trim(),
    };
    if (!row.hoTen || !row.sdt || !row.namNhapHoc) {
      errors.push({ row, reason: "Thiếu họ tên / SĐT / năm nhập học" });
      continue;
    }
    try {
      const base = baseUsername(row);
      const username = await allocateUsername(base);
      const password = generateDefaultPassword();
      const email = toStudentEmail(username);
      const user = await auth.createUser({
        email,
        password,
        displayName: row.hoTen,
        disabled: false,
      });
      const profile = {
        role: "student",
        username,
        hoTen: row.hoTen,
        sdt: row.sdt,
        lop: row.lop,
        namNhapHoc: row.namNhapHoc,
        mustChangePassword: true,
        classIds: row.lop ? [row.lop] : [],
        createdBy: req.auth.uid,
        createdAt: FieldValue.serverTimestamp(),
      };
      const batch = db.batch();
      batch.set(db.collection("users").doc(user.uid), profile);
      batch.set(db.collection("usernames").doc(username), {
        uid: user.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
      issued.push({
        hoTen: row.hoTen,
        lop: row.lop,
        username,
        password,
      });
    } catch (e) {
      errors.push({ row, reason: e.message || String(e) });
    }
  }

  return {
    teacher: teacher.email || teacher.hoTen,
    issued,
    errors,
    warning: "Mật khẩu mặc định chỉ hiện một lần. Tải file phát rồi xóa khỏi máy khi đã giao.",
  };
});
