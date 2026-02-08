
const EXEC_URL = "https://script.google.com/macros/s/AKfycbwFYYMybfaF7ac9yxP7shnIZZaiKxgnO6BvHNaXfcOk-oQ2jSUUGnrBWyinXuhko20/exec";
fetch(EXEC_URL + "?action=leaderboard&limit=5")
  .then(r=>r.json())
  .then(d=>{
    const box = document.getElementById("leaderboardSection");
    if(!box) return;
    box.innerHTML="";
    d.rows.forEach(u=>{
      const div=document.createElement("div");
      div.textContent=`#${u.rank} ${u.name} — ${u.xp} XP`;
      box.appendChild(div);
    });
  });
