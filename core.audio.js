// ================================
// 🔊 AUDIO Y TEXT TO SPEECH
// ================================

import { AppState } from "./core.state.js";

let utterance = null;

export function speak(text, lang = "en-US") {
  // código actual speak()
}

export function stopSpeak() {
  // código actual stopSpeak()
}

export function updateRate(rate) {
  AppState.audioRate = rate;
}
