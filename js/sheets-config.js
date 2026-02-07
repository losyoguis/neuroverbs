// NEUROVERBS — Configuración de Google Sheets (PRODUCCIÓN)
(function () {
  const PRODUCTION_URL = "https://script.google.com/macros/s/AKfycbwFYYMybfaF7ac9yxP7shnIZZaiKxgnO6BvHNaXfcOk-oQ2jSUUGnrBWyinXuhko20/exec";

  const urlParams = new URLSearchParams(window.location.search);
  const urlOverride = urlParams.get("webapp");
  if (urlOverride) {
    localStorage.setItem("WEB_APP_URL_V5", urlOverride);
  }

  const storedUrl = localStorage.getItem("WEB_APP_URL_V5");
  const finalUrl = storedUrl || PRODUCTION_URL;

  window.NEUROVERBS_SHEETS = {
    WEB_APP_URL: finalUrl,
    ALLOWED_DOMAIN: "iemanueljbetancur.edu.co",
    DEBUG: false
  };

  console.log("[Sheets] Configurado:", finalUrl);
})();