const EXEC_URL = "https://script.google.com/macros/s/AKfycbwFYYMybfaF7ac9yxP7shnIZZaiKxgnO6BvHNaXfcOk-oQ2jSUUGnrBWyinXuhko20/exec";

fetch(EXEC_URL + "?action=leaderboard&limit=5")
  .then(r=>r.json())
  .then(d=>{
    const list = document.getElementById("leaderboardList");
    list.innerHTML = "";
    d.rows.forEach(u=>{
      const div = document.createElement("div");
      div.className="rank-row";
      div.innerHTML = `<span>#${u.rank} ${u.name}</span><span>${u.xp} XP</span>`;
      list.appendChild(div);
    });
  });
