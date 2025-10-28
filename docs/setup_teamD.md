# 🚀 Setup Team D – AVN Navigator Frontend (Extension Chrome)

## 🎯 Objectif
Ce module correspond au travail de la **Team D (Front / Extension)** dans le projet **Navigateur Vocal Agentique (AVN)**.  
Il fournit l’interface utilisateur et la passerelle entre le navigateur et les agents intelligents (voix, perception, exécution).

---

## 🧱 Phase 1 — Environnement de base (Backend Flask + Docker)

### 📦 Objectif
Mettre en place un backend local sandboxé qui simule l’orchestrateur GCP pour les tests front.

### 🔧 Étapes principales

```bash
# 1. Créer un environnement virtuel Python
python3 -m venv venv
source venv/bin/activate

# 2. Installer Flask
pip install -r requirements.txt

# 3. Créer le serveur
mkdir -p core/api
nano core/api/app.py

core/api/app.py

from flask import Flask, jsonify
import os

app = Flask(__name__)

@app.route("/")
def home():
    return jsonify({"message": "AVN backend opérationnel !"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))

🐳 Docker

Dockerfile

FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -r requirements.txt
ENV PORT=8080
EXPOSE 8080
CMD ["python", "core/api/app.py"]

Build & Run

docker build -t avn-backend .
docker run -p 8080:8080 avn-backend

➡️ Accessible sur http://127.0.0.1:8080
🧩 Phase 2 — Création de l’extension Chrome (Frontend)
📂 Structure du dossier frontend

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

🪶 manifest.json

{
  "manifest_version": 3,
  "name": "AVN Navigator",
  "version": "1.0.0",
  "description": "Extension Chrome du Navigateur Vocal Agentique (Team D) — permet l’interaction vocale et la perception DOM.",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": ["http://127.0.0.1:8080/*"],
  "background": { "service_worker": "background.js" },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "assets/icon.png",
      "48": "assets/icon.png",
      "128": "assets/icon.png"
    }
  },
  "content_scripts": [
    { "matches": ["<all_urls>"], "js": ["content.js"] }
  ]
}

🧠 Phase 2.1 — Test de communication Extension ↔ Backend
🧩 popup/popup.js

document.getElementById('pingBtn').addEventListener('click', async () => {
  const status = document.getElementById('status');
  status.textContent = 'Connexion en cours...';

  try {
    const response = await fetch('http://127.0.0.1:8080/');
    const data = await response.json();
    status.textContent = `✅ ${data.message}`;
  } catch (error) {
    console.error('Erreur de connexion :', error);
    status.textContent = '❌ Erreur de connexion au backend';
  }
});

💬 Résultat attendu

Lorsqu’on clique sur “Tester la connexion” :

✅ AVN backend opérationnel !

🌐 Phase 2.2 — Préparation à la perception DOM (à venir)

    Ajout du module content.js pour l’analyse du DOM : titres, sections, images, formulaires.

    Envoi des données vers Flask via POST /perceive.

    Intégration future avec Agent de Perception (Sprint 2).

📘 Résumé d’intégration
Élément	Rôle	Statut
Backend Flask (Docker)	Sandbox local simulant l’orchestrateur GCP	✅ OK
Extension Chrome	Interface et passerelle utilisateur	✅ OK
Communication HTTP	Testée via / (ping)	✅ OK
Perception DOM	En cours (Sprint 2.2)	🔜 À venir
👥 Destiné à

    Team D (Frontend / Extension) — développement du module navigateur.

    Team A (Agentique / ML) — consommera les données du DOM.

    Team B (GCP / Orchestration) — gérera la communication entre les agents.

    Team C (Voix & I/O) — intégration future STT/TTS avec l’interface popup.

🧾 Auteur

Florentin — Team D (Frontend / Extension)

    Responsable de la conception, du setup et de la documentation du module AVN Navigator.


---

### 📎 Étape finale
Sauvegarde (`Ctrl + O`, `Entrée`, `Ctrl + X`)

Puis exécute :
```bash
git add docs/setup_teamD.md
git commit -m "docs(teamD): documentation complète du setup et environnement AVN Navigator"

