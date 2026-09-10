const crypto = require("crypto");

const LIST_A = [
  "song","trang","nang","mua","gio","may","nangnhe","binh","yen","sang",
  "chieu","dem","rung","songnui","la","hoa","sen","truc","thong","tre",
  "suong","suoi","nui","doi","dong","que","nha","lop","sach","but",
  "muc","tranggiay","den","mo","toi","sangtrong","mat","lanh","am","matme",
  "trong","xanh","vang","tham","nhe","cham","nhanh","tot","kheo","can"
];

const LIST_B = [
  "vui","yen","lanh","trong","sang","moi","dep","hien","ngan","dai",
  "gan","xa","cao","thap","rong","hep","sachse","thanh","thuc","mo",
  "tinh","man","ngot","thom","mat","am","lanhleo","nangnho","muahe","muadong",
  "mualanh","giobac","giolao","troi","dat","nuoc","lua","com","gao","che",
  "tra","sua","banh","keo","hoc","viet","doc","nghe","noi","nghi"
];

function pick(list) {
  const i = crypto.randomInt(0, list.length);
  return list[i];
}

function twoDigits() {
  return String(crypto.randomInt(0, 100)).padStart(2, "0");
}

/** word1 + word2 + 2 số. CSPRNG. Không lấy SĐT/tên/ngày sinh. */
function generateDefaultPassword() {
  return `${pick(LIST_A)}${pick(LIST_B)}${twoDigits()}`;
}

module.exports = { generateDefaultPassword, LIST_A, LIST_B };
