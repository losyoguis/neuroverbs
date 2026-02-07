// =====================================================
// NEUROVERBS - Configuración de Google Sheets
// =====================================================

(function() {
  // 🔧 PEGA AQUÍ LA URL DE TU WEB APP
  const PRODUCTION_URL = "https://script.google.com/macros/s/AKfycbyAVCS78Gqg6RXyn7IkF_lLomtJR6NowoJ5xVCiribhV9X4LDA1S8SkmLmzSAflH6g5KA/exec";
  
  // Permitir override desde URL o localStorage
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
    DEBUG: true // Cambia a true para ver logs detallados
  };
  
  console.log("[Sheets] Configurado:", finalUrl);
})();