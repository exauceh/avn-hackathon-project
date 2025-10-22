// background.js — AVN Navigator
// Liaison STT → Commandes DOM (Manifest V3 compatible)

chrome.runtime.onMessage.addListener((msg, sender) => {
  // === 1️⃣ Commande vocale reçue ===
  if (msg.type === "voice_command") {
    console.log("🎙️ Commande reçue :", msg.text);

    // Envoi de la commande vers la page active
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length) {
        console.warn("❌ Aucun onglet actif trouvé.");
        return;
      }

      const tabId = tabs[0].id;
      console.log("📨 Envoi de la commande au content script :", msg.text);

      // Envoi direct vers content.js (au lieu d'utiliser runtime.sendMessage)
      chrome.tabs.sendMessage(tabId, msg, (response) => {
        if (chrome.runtime.lastError) {
          console.warn(
            "⚠️ Aucun récepteur de message :",
            chrome.runtime.lastError.message
          );
        } else {
          console.log("✅ Réponse du content script :", response);
        }
      });
    });
  }

  // === 2️⃣ Commande “stop” / changement d’état vocal ===
  if (msg.type === "voice_stop") {
    console.log("🛑 Arrêt de la reconnaissance demandé.");
    chrome.runtime.sendMessage({ type: "voice_state", state: "idle" });
  }

  // === 3️⃣ Messages textuels (debug voix) ===
  if (msg.type === "voice_text") {
    console.log("💬 [Voix]:", msg.text);
  }
});

