# Migration vers Side Panel

## Changements effectués

L'extension a été convertie d'une **popup classique** vers un **Side Panel Chrome** pour permettre à l'interface de rester visible lors du changement d'onglet.

### Modifications dans `manifest.json`

1. **Ajout de la permission `sidePanel`**
   ```json
   "permissions": [
     "activeTab",
     "tabs",
     "storage",
     "offscreen",
     "scripting",
     "sidePanel"  // ← Nouvelle permission
   ]
   ```

2. **Remplacement de `action.default_popup` par `side_panel`**
   ```json
   // Avant
   "action": {
     "default_popup": "popup/popup.html",
     "default_title": "AVN Agent"
   }
   
   // Après
   "action": {
     "default_title": "AVN Agent"
   },
   "side_panel": {
     "default_path": "popup/popup.html"
   }
   ```

### Modifications dans `background.js`

1. **Ajout du gestionnaire de clic sur l'icône**
   ```javascript
   chrome.action.onClicked.addListener(async (tab) => {
     try {
       await chrome.sidePanel.open({ tabId: tab.id });
     } catch (e) {
       console.error('Erreur ouverture side panel:', e);
     }
   });
   ```

2. **Mise à jour du raccourci clavier (Ctrl+Y)**
   - Ouvre maintenant le side panel au lieu de la popup
   - Envoie le message `start_hotword_from_shortcut` après l'ouverture

## Avantages du Side Panel

✅ **Persiste lors du changement d'onglet** - Le panel reste ouvert  
✅ **Meilleure expérience utilisateur** - Interface toujours accessible  
✅ **Plus d'espace** - Panel redimensionnable  
✅ **Moderne** - Suit les standards Chrome récents (Chrome 114+)  

## Comment tester

1. Rechargez l'extension dans `chrome://extensions`
2. Cliquez sur l'icône de l'extension OU utilisez `Ctrl+Y`
3. Le side panel s'ouvre sur le côté droit de la fenêtre
4. Changez d'onglet → **le panel reste ouvert** 🎉

## Compatibilité

- **Chrome/Edge** : Version 114+ (Mai 2023)
- **Firefox** : Non supporté (utiliser une alternative)

## Retour en arrière (si nécessaire)

Pour revenir à une popup classique, restaurez dans `manifest.json` :
```json
"action": {
  "default_popup": "popup/popup.html",
  "default_title": "AVN Agent"
}
```
Et supprimez la section `side_panel`.
