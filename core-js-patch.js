// =====================================================
// PARCHE PARA core.js - Mejora de Sincronización XP
// Aplica estos cambios en tu archivo core.js
// =====================================================

// ============================================
// CAMBIO 1: Actualizar la configuración de WEB_APP_URL
// ============================================
// BUSCA estas líneas al inicio de core.js (aproximadamente línea 5-11):

/*
const DEFAULT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwh3qTioH-xVnVL43V5_Y7_lc-Ng6BYCvNsj3E6IPDpanwUGa6cgqYpbR6yt724E5UF/exec";
const WEB_APP_URL = (new URLSearchParams(location.search).get("webapp")
  || localStorage.getItem("WEB_APP_URL_V5")
  || DEFAULT_WEB_APP_URL);
*/

// REEMPLÁZALAS CON:

const DEFAULT_WEB_APP_URL = window.NEUROVERBS_SHEETS?.WEB_APP_URL || "https://script.google.com/macros/s/TU_URL_AQUI/exec";
const WEB_APP_URL = DEFAULT_WEB_APP_URL;

// ============================================
// CAMBIO 2: Mejorar la función awardXP
// ============================================
// BUSCA la función awardXP (aproximadamente línea 5925)
// AL FINAL de la función, ANTES de "return gained;", AGREGA:

  // ✅ Sincronizar XP con Google Sheets
  try {
    const profile = localStorage.getItem("user_profile");
    if (profile && gained > 0) {
      const user = JSON.parse(profile);
      const idToken = localStorage.getItem("google_id_token");
      
      if (idToken) {
        // Evitar spam - solo sincronizar cada 2 segundos
        const now = Date.now();
        if (!window.__lastXpSync || (now - window.__lastXpSync) > 2000) {
          window.__lastXpSync = now;
          queueXpDelta(idToken, gained);
          
          if (window.NEUROVERBS_SHEETS?.DEBUG) {
            console.log("[XP→Sheets] Sincronizando +", gained, "XP");
          }
        }
      }
    }
  } catch (e) {
    if (window.NEUROVERBS_SHEETS?.DEBUG) {
      console.warn("[XP→Sheets] Error:", e);
    }
  }


// ============================================
// CAMBIO 3: Agregar función de sincronización offline (OPCIONAL)
// ============================================
// AGREGA estas funciones al final de core.js, antes del último }

/**
 * Sincroniza XP pendiente cuando se recupera la conexión
 */
function syncPendingXP() {
  try {
    const pending = JSON.parse(localStorage.getItem("pending_xp") || "[]");
    
    if (pending.length === 0) return;
    
    const idToken = localStorage.getItem("google_id_token");
    if (!idToken) return;
    
    // Sumar todo el XP pendiente
    const totalXP = pending.reduce((sum, item) => sum + item.xp, 0);
    
    if (totalXP > 0) {
      postToSheets({ action: "upsert", idToken, xpDelta: totalXP });
      localStorage.removeItem("pending_xp");
      
      if (window.NEUROVERBS_SHEETS?.DEBUG) {
        console.log("[Sync] XP pendiente sincronizado:", totalXP);
      }
    }
  } catch (e) {
    console.warn("[Sync] Error al sincronizar XP pendiente:", e);
  }
}

/**
 * Guardar XP para sincronizar después si no hay conexión
 */
function queueOfflineXP(xpDelta) {
  try {
    const pending = JSON.parse(localStorage.getItem("pending_xp") || "[]");
    pending.push({ xp: xpDelta, timestamp: Date.now() });
    localStorage.setItem("pending_xp", JSON.stringify(pending));
  } catch (e) {
    console.warn("[Offline] Error al guardar XP pendiente:", e);
  }
}

// Sincronizar cuando se recupera la conexión
if (typeof window !== 'undefined') {
  window.addEventListener("load", syncPendingXP);
  window.addEventListener("online", syncPendingXP);
}


// ============================================
// CAMBIO 4: Mejorar postToSheets para manejar errores offline
// ============================================
// BUSCA la función postToSheets (aproximadamente línea 93)
// MODIFICA el bloque catch para agregar queue offline:

  }).catch((err) => {
    console.warn("[Sheets] JSONP falló, intentando fallback:", err);
    
    // ✅ Si no hay conexión, guardar para sincronizar después
    if (!navigator.onLine && payload.xpDelta) {
      queueOfflineXP(payload.xpDelta);
      if (window.NEUROVERBS_SHEETS?.DEBUG) {
        console.log("[Offline] XP guardado para sincronizar después");
      }
    }
    
    // Fallback POST silencioso (original)
    const body = JSON.stringify(payload);
    try {
      fetch(WEB_APP_URL, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body
      }).catch(()=>{});
    } catch(e) {}
    
    // Fallback beacon (original)
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(WEB_APP_URL, new Blob([body], { type: "text/plain;charset=utf-8" }));
      }
    } catch(e) {}
  });


// ============================================
// RESUMEN DE CAMBIOS
// ============================================

/*
1. ✅ Configuración dinámica de WEB_APP_URL desde sheets-config.js
2. ✅ Sincronización automática de XP en awardXP()
3. ✅ Control de spam (máximo una sincronización cada 2 segundos)
4. ✅ Queue offline para sincronizar cuando se recupere la conexión
5. ✅ Logs detallados cuando DEBUG=true
6. ✅ Manejo robusto de errores

IMPORTANTE:
- Asegúrate de que sheets-config.js se cargue ANTES de core.js en tu HTML
- Orden correcto: Google Sign-In → sheets-config.js → core.js
*/
