/*
 * neuroverbs.js
 * Comunicación Frontend ↔ Backend (Apps Script)
 */

const API_URL = "https://script.google.com/macros/s/AKfycbzaq00fpgIqoCWpT8RXd7EypDlRPUtBRtkku_FisgyV-iQZHIHcwUoLyrNTiFJHIml6/exec";

window.idToken = window.idToken || null;

/* Espera a que exista el idToken */
function waitForIdToken(timeout = 10000){
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      if (window.idToken){
        clearInterval(t);
        resolve(window.idToken);
      }
      if (Date.now() - start > timeout){
        clearInterval(t);
        reject("Timeout esperando idToken");
      }
    }, 100);
  });
}

/* Enviar XP al backend */
async function sendXP(xpDelta, precision){
  try{
    const token = await waitForIdToken();

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateStats",
        idToken: token,
        xpDelta: xpDelta,
        precision: precision
      })
    });

    const data = await res.json();
    console.log("Respuesta backend:", data);

    if(data.ok){
      appState.xp = data.stats.xp;
      appState.level = data.stats.level;
      appState.precision = data.stats.avgPrecision;
    }

  }catch(err){
    console.error("Error sendXP:", err);
  }
}

/* Exponer función */
window.sendXP = sendXP;

console.log("neuroverbs.js cargado correctamente");
