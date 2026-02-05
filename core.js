
/* ===============================
   NeuroVerbs core.js
   XP / YoguisCoin RESTORED VERSION
   Stable XP sync with Google Sheets
   =============================== */

/* --------- CONFIG --------- */
const DEFAULT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwr6lTi3yZhkfB64fjBY1hUhU7_vg2MHAOeI4VGZ1WocQvPxR516I1kf293GgHsuob2/exec";
const WEB_APP_URL = (new URLSearchParams(location.search).get("webapp")
  || localStorage.getItem("WEB_APP_URL_V5")
  || DEFAULT_WEB_APP_URL);

const ALLOWED_DOMAIN = "iemanueljbetancur.edu.co";
const ALLOWED_EMAIL_SUFFIX = "@"+ALLOWED_DOMAIN;
const OAUTH_CLIENT_ID = "637468265896-5olh8rhf76setm52743tashi3vq1la67.apps.googleusercontent.com";

/* --------- XP STATE --------- */
let xp = 0;
let streak = 0;
let att = 0;
let corr = 0;

/* --------- HELPERS --------- */
function postToSheets(payload){
  try{
    const params = new URLSearchParams();
    params.set("action", payload.action || "upsert");
    if(payload.idToken) params.set("idToken", payload.idToken);
    if(payload.xpDelta !== undefined) params.set("xpDelta", String(payload.xpDelta));
    params.set("_", Date.now());

    const url = WEB_APP_URL + "?" + params.toString();
    const s = document.createElement("script");
    s.src = url + "&callback=__cb_"+Math.random().toString(36).slice(2);
    document.body.appendChild(s);
  }catch(e){
    console.warn("Sheets sync error", e);
  }
}

/* --------- XP SYNC (SIMPLE & STABLE) --------- */
function syncXpToSheets(delta){
  const idToken = localStorage.getItem("google_id_token");
  if(!idToken) return;
  const d = Number(delta);
  if(!Number.isFinite(d) || d <= 0) return;

  postToSheets({
    action: "upsert",
    idToken,
    xpDelta: d
  });
}

/* --------- XP AWARD (ONLY SOURCE OF TRUTH) --------- */
function awardXP(amount, reason="xp"){
  const gain = Number(amount);
  if(!Number.isFinite(gain) || gain <= 0) return;

  xp += gain;
  syncXpToSheets(gain);
  persistState();
  actualizarStats();

  console.log("[XP]", "+"+gain, reason);
}

/* --------- UI --------- */
function actualizarStats(){
  const xpEl = document.getElementById("xp");
  const stEl = document.getElementById("streak");
  const accEl = document.getElementById("acc");

  if(xpEl) xpEl.textContent = xp;
  if(stEl) stEl.textContent = streak;
  if(accEl) accEl.textContent = (att===0?100:Math.round((corr/att)*100))+"%";

  persistState();
}

/* --------- STATE --------- */
function persistState(){
  try{
    localStorage.setItem("neuroverbs_state", JSON.stringify({
      xp, streak, att, corr
    }));
  }catch(e){}
}

function loadState(){
  try{
    const raw = localStorage.getItem("neuroverbs_state");
    if(raw){
      const s = JSON.parse(raw);
      xp = Number(s.xp||0);
      streak = Number(s.streak||0);
      att = Number(s.att||0);
      corr = Number(s.corr||0);
    }
  }catch(e){}
}

/* --------- INIT --------- */
window.addEventListener("load", ()=>{
  loadState();
  actualizarStats();
});
