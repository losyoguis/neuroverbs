// =====================================================
// NEUROVERBS - Configuración de Google Sheets
// =====================================================

(function() {
  // 🔧 IMPORTANTE: Reemplaza esta URL con la de tu Web App de Google Apps Script
  // Instrucciones en DOCS/INSTALACION.md
  const PRODUCTION_URL = "https://script.google.com/macros/s/AKfycby0xuOpSXNf34QHHh-7zwjXvFtSuMrXeVLa3RESk9vlsBicd-GkU3SI3zxGnpwE5mbseQ/exec";
  
  // Permitir override desde URL (útil para testing)
  const urlParams = new URLSearchParams(window.location.search);
  const urlOverride = urlParams.get("webapp");
  
  if (urlOverride) {
    localStorage.setItem("WEB_APP_URL_V5", urlOverride);
    console.log("[Sheets] URL actualizada desde parámetro:", urlOverride);
  }
  
  const storedUrl = localStorage.getItem("WEB_APP_URL_V5");
  const finalUrl = storedUrl || PRODUCTION_URL;
  
  // Configuración global
  window.NEUROVERBS_SHEETS = {
    WEB_APP_URL: finalUrl,
    ALLOWED_DOMAIN: "iemanueljbetancur.edu.co",
    DEBUG: false // Cambiar a true para ver logs detallados en consola
  };
  
  console.log("[Sheets] Configurado:", finalUrl);
})();
