// 🔗 Test de connexion backend
document.getElementById("pingBtn").addEventListener("click", async () => {
  const status = document.getElementById("status");
  const indicator = document.getElementById("backendIndicator");

  status.textContent = "Connexion en cours...";
  indicator.className = "spinner"; // ⏳

  try {
    const response = await fetch("http://127.0.0.1:8080/");
    const data = await response.json();
    status.textContent = ` ${data.message}`;
    indicator.className = "indicator"; // LED verte
    indicator.style.backgroundColor = "#10b981";
  } catch (error) {
    console.error("Erreur de connexion :", error);
    status.textContent = " Erreur de connexion au backend";
    indicator.className = "indicator"; // LED rouge
    indicator.style.backgroundColor = "#ef4444";
  }
});

// 🧠 Déclencheur manuel d'analyse DOM
document.getElementById("analyzeBtn").addEventListener("click", () => {
  const analyzeStatus = document.getElementById("analyzeStatus");
  const analyzeIndicator = document.getElementById("analyzeIndicator");

  analyzeStatus.textContent = "Analyse en cours...";
  analyzeIndicator.className = "spinner"; // ⏳

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabs[0].id },
        func: () => {
          window.dispatchEvent(new Event("load"));
        },
      },
      () => {
        analyzeStatus.textContent = " Analyse envoyée à la page active.";
        analyzeIndicator.className = "indicator"; // LED verte
        analyzeIndicator.style.backgroundColor = "#10b981";
      }
    );
  });
});

import { startListening } from "../voice/stt.js";

document.getElementById("speakBtn").addEventListener("click", () => {
  const status = document.getElementById("voiceStatus");
  status.textContent = "🎙 Écoute en cours...";
  startListening();
});

