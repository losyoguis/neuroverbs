const EXEC_URL = "https://script.google.com/macros/s/AKfycbwFYYMybfaF7ac9yxP7shnIZZaiKxgnO6BvHNaXfcOk-oQ2jSUUGnrBWyinXuhko20/exec";
let page = 1;
const limit = 5;

const statusEl = document.getElementById("status");
const listEl = document.getElementById("rankingList");
const pageEl = document.getElementById("page");

function loadRanking() {
  listEl.textContent = "Cargando ranking…";
  fetch(`${EXEC_URL}?action=leaderboard&limit=${limit}&offset=${(page-1)*limit}`)
    .then(r=>r.json())
    .then(d=>{
      if(!d.ok) throw new Error();
      listEl.innerHTML = "";
      d.rows.forEach(u=>{
        const div=document.createElement("div");
        div.className="ranking-row";
        div.innerHTML=`<span>#${u.rank} ${u.name}</span><strong>${u.xp} XP</strong>`;
        listEl.appendChild(div);
      });
      pageEl.textContent = page;
      statusEl.textContent = "✅ Conectado a Google Sheets";
    })
    .catch(()=>{
      listEl.textContent="❌ No se pudo cargar el ranking";
      statusEl.textContent="❌ Error de conexión";
    });
}

document.getElementById("prev").onclick=()=>{ if(page>1){page--;loadRanking();} };
document.getElementById("next").onclick=()=>{ page++; loadRanking(); };
document.getElementById("refresh").onclick=loadRanking;

loadRanking();
