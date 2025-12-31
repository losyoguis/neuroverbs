// ================================
// 🧠 CORE ORQUESTADOR
// ================================

import "./core.state.js";
import "./core.data.js";
import "./core.passive.js";
import "./core.audio.js";
import "./core.ui.js";
import "./core.gamification.js";

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
  loadVerbs();
  updateHUD();
});
