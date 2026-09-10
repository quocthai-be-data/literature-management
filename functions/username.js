const { getFirestore } = require("firebase-admin/firestore");

function stripVietnamese(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function initialsFromName(hoTen) {
  const parts = stripVietnamese(hoTen).split(" ").filter(Boolean);
  if (!parts.length) return "hs";
  return parts.map((w) => w[0]).join("");
}

function last4Phone(sdt) {
  const digits = String(sdt || "").replace(/\D/g, "");
  return digits.slice(-4).padStart(4, "0");
}

function last2Year(namNhapHoc) {
  const y = String(namNhapHoc || "").replace(/\D/g, "");
  return y.slice(-2).padStart(2, "0");
}

function baseUsername(row) {
  return `${initialsFromName(row.hoTen)}${last4Phone(row.sdt)}${last2Year(row.namNhapHoc)}`;
}

/**
 * Check trùng bằng query có index trên collection `usernames/{username}`.
 * Không quét toàn bộ users.
 */
async function allocateUsername(base) {
  const db = getFirestore();
  let candidate = base;
  let suffix = 0;
  for (;;) {
    const snap = await db.collection("usernames").doc(candidate).get();
    if (!snap.exists) return candidate;
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
}

module.exports = { stripVietnamese, initialsFromName, baseUsername, allocateUsername };
