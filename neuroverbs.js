/*************************************************
 * NEUROVERBS FRONTEND ↔ BACKEND
 *************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbzaq00fpgIqoCWpT8RXd7EypDlRPUtBRtkku_FisgyV-iQZHIHcwUoLyrNTiFJHIml6/exec";

window.idToken = window.idToken || null;

/* ================= SEND XP ================= */

async function sendXP(xp, precision){
  if (!window.idToken){
    console.warn("Usuario no autenticado");
    return;
  }

  try{
    const res = await fetch(API_URL,{
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({
        action:'updateStats',
        idToken:window.idToken,
        xpDelta:xp,
        precision:precision
      })
    });

    const data = await res.json();
    console.log("Backend:", data);

    if(data.ok){
      updateStatsUI(data.stats, data.coin);
    }else{
      console.error(data.error);
    }

  }catch(err){
    console.error("Error backend", err);
  }
}

/* ================= UI UPDATE ================= */

function updateStatsUI(stats, coin){
  if(!stats) return;

  const $ = id => document.getElementById(id);

  if($('xp')) $('xp').textContent = stats.xp;
  if($('level')) $('level').textContent = stats.level;
  if($('freeze')) $('freeze').textContent = stats.freeze;
  if($('streak')) $('streak').textContent = stats.streak;
  if($('acc')) $('acc').textContent = Math.round(stats.avgPrecision*100) + "%";

  console.log("🪙 YoguisCoin:", coin);
}

/* ================= RANKING ================= */

async function loadRanking(limit=10){
  const res = await fetch(API_URL,{
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({
      action:'ranking',
      limit:limit
    })
  });

  const data = await res.json();
  return data.ranking || [];
}
