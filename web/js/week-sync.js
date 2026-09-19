import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db, configReady } from "./firebase-init.js";
import { watchAuth } from "./auth.js";
const $ = (id) => document.getElementById(id);
const settingsRef = () => doc(db, "schoolSettings", "currentWeek");
function applyStudentWeek(week) { const card=document.querySelector(".calendar-card"); if(!card||$("student-school-week"))return; const heading=card.querySelector(".calendar-heading"), row=document.createElement("div"); row.className="week-stepper student-week-readonly"; row.innerHTML=`<span class="icon-control" aria-hidden="true">&lsaquo;</span><label>Tuần ở trường<input id="student-school-week" type="number" min="1" value="${week}" readonly aria-label="Tuần ở trường"></label><span class="icon-control" aria-hidden="true">&rsaquo;</span>`; card.insertBefore(row,heading); }
async function readWeek(){if(!configReady||!db)return 1;const snap=await getDoc(settingsRef());return Math.max(1,Number(snap.exists()?snap.data().week:1)||1);}
watchAuth(async()=>{const week=await readWeek();if($("school-week")){ $("school-week").value=week; const save=()=>setDoc(settingsRef(),{week:Math.max(1,Number($("school-week").value)||1)},{merge:true}); $("week-prev").addEventListener("click",save);$("week-next").addEventListener("click",save);$("school-week").addEventListener("change",save); } else applyStudentWeek(week);});
