const EXEC_URL = "https://script.google.com/macros/s/AKfycbwFYYMybfaF7ac9yxP7shnIZZaiKxgnO6BvHNaXfcOk-oQ2jSUUGnrBWyinXuhko20/exec";

fetch(EXEC_URL + "?action=ping")
  .then(r=>r.json())
  .then(d=>{
    document.getElementById("status").textContent =
      d.ok ? "✅ Conectado a Google Sheets" : "❌ Error de conexión";
  });
