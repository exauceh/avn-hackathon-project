# AVN Hackathon Project

Projet d'automatisation web basé sur une architecture microservices avec extension Chrome et IA conversationnelle.

## 🚀 Installation

### Prérequis
- Google Chrome (version 88+)
- Microphone fonctionnel

### Installation de l'Extension Chrome

1. **Cloner le projet**
   ```bash
   git clone https://github.com/exauceh/avn-hackathon-project.git
   cd avn-hackathon-project
   ```

2. **Charger l'extension dans Chrome**
   
   - Ouvrir Chrome et aller à `chrome://extensions/`
   - Activer le **Mode développeur** (coin supérieur droit)
   - Cliquer sur **Charger l'extension non empaquetée**
   - Sélectionner le dossier `frontend/` du projet
   - L'extension devrait apparaître dans la liste avec l'icône AVN

4. **Vérifier l'installation**
   L'extension est maintenant installée mais pas encore active visuellement.

## 🎙️ Utilisation

### Activation par Raccourci Clavier

L'extension AVN s'active **exclusivement par raccourci clavier** - aucune interaction par clic n'est nécessaire. Cette approche simule une activation vocale et contourne les limitations techniques qui empêchent une écoute continue dès l'ouverture du navigateur.
Nous avions essayé de mettre en place un keyword "Hello AVN" pour déclencher la popup mais nous avons été bloqué par les limitations du navigateur.

#### Activer l'extension
- Appuyer sur le raccourci configuré ( Ctrl + Space / Command + Space)
- **"Hello ** - Active l'écoute de votre commande principale
- Un son "hum" confirme le début de l'enregistrement
- Parler votre commande vocale
- L'assistant traite et répond par audio

## 🔧 Dépannage

### Le raccourci ne fonctionne pas
- Vérifier que le raccourci est bien configuré dans `chrome://extensions/shortcuts`
- S'assurer qu'aucune autre extension n'utilise le même raccourci
- Rafraîchir la page web après avoir changé le raccourci

### Pas de son "hum" à l'activation
- Vérifier les permissions du microphone dans Chrome
- Vérifier que le volume système n'est pas coupé
- Ouvrir la console développeur (F12) et chercher les erreurs

### La reconnaissance vocale ne fonctionne pas
- Vérifier que le microphone est bien branché et activé
- Autoriser l'accès au microphone quand Chrome le demande
- Tester dans `chrome://settings/content/microphone`

## 🏗️ Architecture

Pour plus de détails sur l'architecture du projet, consulter [architecture.md](architecture.md).

## 📝 Développement

### Structure Frontend
```
frontend/
├── manifest.json           # Configuration extension
├── offscreen.html/js       # Gestion audio en arrière-plan
├── scripts/
│   ├── background.js       # Service worker principal
│   ├── popup-stt.js        # Reconnaissance vocale
│   ├── content.js          # Injection dans les pages
│   └── conf.js             # Configuration API
└── popup/
    ├── popup.html          # Interface (optionnelle)
    └── popup.js            # Logique interface
```