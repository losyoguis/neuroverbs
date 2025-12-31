// ================================
// 🎮 GAMIFICACIÓN
// ================================

import { AppState } from "./core.state.js";

export function addXP(value) {
  AppState.xp += value;
}

export function updateRanking() {
  // Google Sheets
}

export function saveProgress() {
  // persistencia
}
