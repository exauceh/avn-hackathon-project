/*
 * commands.js — module d’interprétation locale des commandes vocales
 * Phase 4 — Sprint 2.3 (Team D)
 */

import { speak } from "./tts.js";

// -------- OUTILS GÉNÉRIQUES -------- //
function includesAny(text, patterns) {
  return patterns.some((p) => text.includes(p));
}

// -------- ACTIONS DOM SIMULÉES -------- //
function scrollDown() {
  window.scrollBy({ top: window.innerHeight / 2, behavior: "smooth" });
  speak("Je descends la page");
}

function scrollUp() {
  window.scrollBy({ top: -window.innerHeight / 2, behavior: "smooth" });
  speak("Je remonte la page");
}

function readPage() {
  const paragraphs = Array.from(document.querySelectorAll("p"));
  if (paragraphs.length === 0) return speak("Aucun texte détecté sur cette page");
  speak(`Je commence la lecture. ${paragraphs.slice(0, 3).map(p => p.innerText).join(". ")}`);
}

function focusNextSection() {
  const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"));
  const current = document.activeElement;
  const next = headings.find(h => h.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING);
  if (next) {
    next.scrollIntoView({ behavior: "smooth", block: "center" });
    next.focus();
    speak(`Section suivante : ${next.innerText}`);
  } else {
    speak("Aucune autre section trouvée");
  }
}

function simulateClickByText(targetText) {
  const links = Array.from(document.querySelectorAll("a, button, input[type=submit]"));
  const found = links.find((el) => el.innerText.toLowerCase().includes(targetText));
  if (found) {
    found.click();
    speak(`Je clique sur ${found.innerText}`);
  } else {
    speak(`Je n’ai pas trouvé le lien ${targetText}`);
  }
}

// -------- INTERPRÉTATION PRINCIPALE -------- //
export function interpretCommand(rawText) {
  const text = rawText.toLowerCase().trim();

  // --- 1️⃣ Navigation / Scroll ---
  if (includesAny(text, ["descends", "vers le bas", "défile", "scroll bas"])) return scrollDown();
  if (includesAny(text, ["monte", "vers le haut", "scroll haut"])) return scrollUp();

  // --- 2️⃣ Lecture / Focus ---
  if (includesAny(text, ["lis", "lecture", "lis-moi", "lire", "parle de"])) return readPage();
  if (includesAny(text, ["section suivante", "continue", "passe à la suivante"])) return focusNextSection();

  // --- 3️⃣ Clics / Liens ---
  if (includesAny(text, ["clique", "ouvre", "sélectionne", "choisis"])) {
    const mots = text.split(" ");
    const index = mots.findIndex((m) => ["clique", "ouvre", "sélectionne", "choisis"].includes(m));
    const cible = mots.slice(index + 1).join(" ").trim();
    return simulateClickByText(cible);
  }

  // --- 4️⃣ Recherche / Exploration ---
  if (includesAny(text, ["cherche", "recherche", "trouve"])) {
    const query = text.replace(/(cherche|recherche|trouve)/, "").trim();
    speak(`Je lance une recherche Google pour ${query}`);
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
    return;
  }

  // --- 5️⃣ Lecture d’images / graphiques ---
  if (includesAny(text, ["analyse", "regarde l'image", "décris", "montre", "graphiques"])) {
    speak("Je détecte les images de la page…");
    const imgs = document.querySelectorAll("img");
    if (imgs.length === 0) return speak("Aucune image trouvée sur cette page");
    speak(`Je vois ${imgs.length} images. La première semble illustrer ${imgs[0].alt || "aucune description disponible"}`);
    return;
  }

  // --- 6️⃣ Formulaires ---
  if (includesAny(text, ["remplis", "saisis", "entre", "écris"])) {
    speak("Je détecte un formulaire. Cette fonctionnalité sera activée dans la prochaine phase.");
    return;
  }

  // --- 7️⃣ Contexte / Routine ---
  if (includesAny(text, ["lis les actualités", "montre les news"])) {
    speak("Routine non activée dans cette version locale. Je peux lancer une recherche à la place ?");
    return;
  }

  // --- 8️⃣ Cas inconnus / fallback ---
  speak("Je ne suis pas sûr de comprendre. Tu veux que je lise la page ?");
}

