// tts.js — Module Text-to-Speech (TTS) intelligent — AVN Navigator
// Team D — Phase 4.3 avec gestion optionnelle des voix

let availableVoices = [];
let selectedVoice = null;

// 🔄 Charger les voix disponibles (asynchrone)
function loadVoices() {
  availableVoices = window.speechSynthesis.getVoices();

  if (availableVoices.length > 0 && !selectedVoice) {
    // Choisir automatiquement une voix FR si dispo
    selectedVoice =
      availableVoices.find((v) => v.lang.startsWith("fr")) ||
      availableVoices[0];
    console.log("🗣️ Voix sélectionnée :", selectedVoice.name, selectedVoice.lang);
  }
}

// Certains navigateurs chargent les voix avec un léger délai
window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

// 💬 Fonction principale de parole
export function speak(text, options = {}) {
  if (!text) return;

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = options.lang || selectedVoice?.lang || "fr-FR";
  utter.rate = options.rate || 1;
  utter.pitch = options.pitch || 1;
  utter.volume = options.volume || 1;

  if (selectedVoice) utter.voice = selectedVoice;

  // Feedback visuel : afficher le texte parlé
  chrome.runtime?.sendMessage?.({ type: "voice_text", text });

  try {
    window.speechSynthesis.cancel(); // stoppe tout TTS en cours
    window.speechSynthesis.speak(utter);
    console.log(`🔊 [TTS] ${utter.voice?.name || "default"} :`, text);
  } catch (e) {
    console.warn("⚠️ Erreur TTS :", e);
  }
}

// 🧠 Lister toutes les voix disponibles (optionnel)
export function listVoices() {
  if (!availableVoices.length) loadVoices();
  return availableVoices.map((v) => ({
    name: v.name,
    lang: v.lang,
    default: v.default,
  }));
}

// 🎯 Choisir une voix spécifique (optionnel)
export function setVoiceByName(name) {
  const match = availableVoices.find((v) => v.name === name);
  if (match) {
    selectedVoice = match;
    console.log("✅ Voix changée :", selectedVoice.name);
  } else {
    console.warn("❌ Voix non trouvée :", name);
  }
}

