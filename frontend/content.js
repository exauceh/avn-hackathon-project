// content.js — AVN Navigator (Team D)
// Perception DOM + Réception des commandes vocales + liaison persistante

console.log("🎙 AVN content script actif :", window.location.href);

// === 🔌 Canal persistant avec le background (Manifest V3 safe) ===
try {
  const port = chrome.runtime.connect({ name: "avn_channel" });
  port.onDisconnect.addListener(() => console.warn("⚠️ Connexion AVN interrompue."));
} catch (e) {
  console.warn("⚠️ Impossible d’ouvrir le canal persistant :", e);
}

// === 🧩 Test de communication avec la page (debug) ===
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (!event.data || typeof event.data.type !== "string") return;

  console.log("📩 Message reçu via window.postMessage :", event.data);
  if (event.data.type === "avn_test") {
    console.log("✅ Le listener content.js fonctionne !");
  }
});

// === 🧠 1) Perception automatique du DOM ===
function analyzePage() {
  console.log("🔍 Analyse de la page en cours...");

  const titles = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
    .map(el => el.innerText.trim())
    .filter(Boolean);

  const paragraphs = [...document.querySelectorAll("p")]
    .map(el => el.innerText.trim())
    .filter(Boolean)
    .slice(0, 5);

  const images = [...document.querySelectorAll("img")].map(img => img.src);
  const forms = document.querySelectorAll("form").length;

  const payload = {
    url: window.location.href,
    titles,
    paragraphs,
    images,
    forms,
  };

  console.log("📤 Données prêtes à être envoyées :", payload);

  fetch("http://127.0.0.1:8080/perceive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(res => res.json())
    .then(data => {
      console.log("✅ Résumé envoyé :", data);
    })
    .catch(err => console.error("❌ Erreur perception :", err));
}

// Lancer l’analyse automatiquement au chargement
window.addEventListener("load", analyzePage);

// === 🎙️ 2) Réception et exécution des commandes vocales ===
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("📨 Message reçu dans content.js :", msg);

  if (msg.type === "voice_command") {
    const command = msg.text.toLowerCase();
    console.log("🎙 Commande à exécuter :", command);

    // ==== Défilement ====
    if (command.includes("descends")) {
      window.scrollBy({ top: 800, behavior: "smooth" });
      speak("Je descends la page.");
    }

    if (command.includes("monte")) {
      window.scrollBy({ top: -800, behavior: "smooth" });
      speak("Je remonte la page.");
    }

    // ==== Lecture ====
    if (command.includes("lis") || command.includes("lecture")) {
      const textToRead = document.body.innerText.slice(0, 400);
      speak(textToRead);
    }

    // ==== Clic sur lien ====
    if (command.includes("clique sur le premier lien")) {
      const link = document.querySelector("a[href]");
      if (link) {
        speak("J’ouvre le premier lien.");
        window.location.href = link.href;
      } else {
        speak("Aucun lien trouvé sur cette page.");
      }
    }

    // ==== Recherche Google ====
    if (command.startsWith("cherche")) {
      const query = command.replace("cherche", "").trim();
      if (query) {
        speak("Je lance une recherche sur " + query);
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
      } else {
        speak("Je n’ai pas compris la recherche.");
      }
    }

    // Accusé de réception
    sendResponse({ ok: true });
  }
});

// === 🔊 Fonction de synthèse vocale locale ===
function speak(text) {
  try {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "fr-FR";
    utter.rate = 1;
    utter.pitch = 1;
    window.speechSynthesis.speak(utter);
    console.log("🔊 [TTS] :", text);
  } catch (e) {
    console.warn("⚠️ Erreur TTS :", e);
  }
}

console.log("📡 content.js chargé et prêt à recevoir les messages.");

