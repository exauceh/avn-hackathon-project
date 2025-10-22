Phase 3 : Perception du Web & Interaction naturelle
(Sprint 2.2 – Perception DOM ↔ Backend Flask)
🎯 Objectif général

Permettre à l’extension AVN Navigator de voir, comprendre et décrire la structure d’une page web, puis d’envoyer ces informations au backend Flask pour traitement.
Cette étape correspond au Sprint 2.2 du plan global (Perception & Communication DOM ↔ Backend).

🧱 Composants mis en place
1️⃣ Backend Flask (sandbox local)
📂 Fichier : core/api/app.py

Objectif : créer un serveur local capable de recevoir le DOM et d’en fournir un résumé lisible.

Fonctionnalités :

Endpoint / → ping du backend (“AVN backend opérationnel !”)

Endpoint /perceive → réception du DOM et génération d’un résumé

Activation du CORS (flask-cors) pour autoriser les requêtes depuis toute page web

Commande de lancement (mode debug) :
source venv/bin/activate
python3 core/api/app.py --debug

Exemple de log :

📥 DOM reçu : ['url', 'titles', 'paragraphs', 'images', 'forms']
127.0.0.1 - - [..] "POST /perceive HTTP/1.1" 200 -


2️⃣ Extension Chrome (Frontend)

Rôle : servir d’interface utilisateur et de passerelle entre le navigateur et le backend.

📂 Structure

frontend/
├── assets/
│   └── icon.png
├── background.js
├── content.js
├── manifest.json
└── popup/
    ├── popup.html
    ├── popup.js
    └── style.css


3️⃣ content.js — Perception automatique

Objectif : scanner la page web dès son chargement et envoyer la structure DOM vers Flask.

Données extraites :

Titres (h1 → h6)

Paragraphes (p) – 5 premiers

Images (src)

Formulaires (nombre total)

Flux :

Page web → content.js → POST / perceive → Flask → Résumé


Exemple de log :

🎙 AVN content script actif : https://www.wikipedia.org/
🔍 Analyse de la page en cours...
📤 Données prêtes à être envoyées : { url, titles, paragraphs, images, forms }
✅ Résumé envoyé : { message: "Page analysée avec succès", summary: "2 titres, 5 paragraphes, 2 images, 1 formulaires détectés." }


4️⃣ popup.html / popup.js — Interface utilisateur

Objectif : offrir une interface simple pour :

tester la connexion au backend,

lancer manuellement la perception du DOM.

Boutons disponibles :


| Bouton                 | Action                               | Feedback              |
| ---------------------- | ------------------------------------ | --------------------- |
| 🔗 Tester la connexion | Vérifie le ping Flask (`/`)          | LED 🟢/🔴 + message   |
| 🧠 Analyser la page    | Déclenche l’analyse via `content.js` | Spinner ⏳ puis LED 🟢 |


Style intégré :

police Inter

couleurs modernes (bleu/vert)

LED 🟢🟡🔴 et spinner animé

layout clair pour la démo hackathon

| Élément             | Méthode de test               | Résultat                               |
| ------------------- | ----------------------------- | -------------------------------------- |
| Backend /           | `curl http://127.0.0.1:8080/` | ✅ renvoie *AVN backend opérationnel !* |
| Endpoint /perceive  | Requête JSON simulée          | ✅ renvoie un résumé correct            |
| Extension → Backend | Navigation réelle (Wikipedia) | ✅ communication sans erreur            |
| CORS                | Page externe → localhost      | ✅ autorisation confirmée               |
| Popup UI            | Interaction manuelle          | ✅ LED, spinner et messages OK          |


⚙️ Commandes principales

# 1. Activer le venv
source venv/bin/activate

# 2. Lancer le backend Flask (mode debug)
python3 core/api/app.py --debug

# 3. Charger l’extension dans Chromium
avn https://example.com



✅ Résultat final de la Phase 3

| Fonction                        | Description                                                     | Statut |
| ------------------------------- | --------------------------------------------------------------- | ------ |
| Perception DOM automatique      | Scan de page complet (titres, images, paragraphes, formulaires) | ✅      |
| Communication Extension ↔ Flask | Transmission JSON + résumé backend                              | ✅      |
| Interface utilisateur           | Popup moderne avec LED + spinner + retours dynamiques           | ✅      |
| CORS / Sécurité                 | Requêtes inter-origines autorisées                              | ✅      |

