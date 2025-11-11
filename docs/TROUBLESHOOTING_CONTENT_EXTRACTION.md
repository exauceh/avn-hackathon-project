# Dépannage - Extraction du Contenu des Pages

## 🔍 Problème : "Aucun contenu trouvé" sur les nouvelles pages

### Symptômes
- L'extension ne trouve aucun contenu après l'ouverture d'une page
- Les commandes de lecture ne fonctionnent pas
- Le backend reçoit `main_sections: []`

### Causes Possibles
1. **Timing** : La page n'est pas encore chargée quand on essaie d'extraire le contenu
2. **Sélecteurs** : Les sélecteurs CSS ne correspondent pas à la structure de la page
3. **JavaScript dynamique** : Le contenu est chargé après le DOM initial
4. **Protections** : Certains sites bloquent l'injection de scripts

---

## ✅ Solutions Implémentées

### 1. Système de Retry
Le content script essaie maintenant **3 fois** avec un délai de **500ms** entre chaque tentative.

```javascript
// Dans content.js
waitForContent(3, 500)  // 3 tentatives, 500ms de délai
```

### 2. Attente du Chargement Complet
Le background script attend que `tab.status === 'complete'` avant de demander le contenu.

```javascript
// Dans background.js
await waitForTabLoaded(tab.id, 3000);  // Timeout de 3 secondes
```

### 3. Fallback sur Extraction Basique
Si aucun sélecteur ne trouve de contenu, on extrait le texte brut du `body`.

```javascript
// Extraction de base via innerText
const bodyText = document.body.innerText.trim();
```

### 4. Cache du Contenu
Pour éviter les extractions multiples, le contenu est mis en cache pendant **5 secondes**.

```javascript
const CACHE_DURATION = 5000; // 5 secondes
```

### 5. Logs Détaillés
Tous les logs sont préfixés avec des émojis pour faciliter le debug :
- 📄 État de la page
- 🔍 Nombre d'éléments trouvés
- 📊 Statistiques d'extraction
- ⚠️ Warnings
- ✅ Succès

---

## 🛠️ Comment Débugger

### Dans la Console de la Page Web (DevTools)

1. **Ouvrir DevTools** : `F12` ou `Ctrl+Shift+I`
2. **Aller dans Console**
3. **Exécuter** :
   ```javascript
   window.debugExtractContent()
   ```

Cela affiche :
- Le contenu complet extrait
- Le nombre de sections trouvées
- La première section (pour vérifier la qualité)

### Dans la Console du Background Script

1. **Aller dans** : `chrome://extensions/`
2. **Cliquer sur** : "Service worker" sous votre extension
3. **Vérifier les logs** :
   ```
   📄 Contenu récupéré: 15 sections
   ```

### Vérifier l'État de Chargement

Dans la console de la page :
```javascript
document.readyState  // "loading", "interactive", ou "complete"
```

---

## 🔧 Ajustements Possibles

### Augmenter le Nombre de Tentatives

Dans `content.js` :
```javascript
waitForContent(5, 1000)  // 5 tentatives, 1 seconde entre chaque
```

### Augmenter le Timeout de Chargement

Dans `background.js` :
```javascript
await waitForTabLoaded(tab.id, 5000);  // 5 secondes au lieu de 3
```

### Ajouter des Sélecteurs Personnalisés

Dans `content.js` :
```javascript
const mainContentSelectors = [
    'article', 'main', '[role="main"]',
    '.post-content', '.article-content', 
    '.your-custom-selector'  // ✅ Ajouter ici
];
```

### Désactiver le Cache

Dans `content.js` :
```javascript
const CACHE_DURATION = 0; // Désactive le cache
```

---

## 🧪 Tests Recommandés

### Test 1 : Page Simple
1. Ouvrir une page Wikipedia
2. Dire "read this page"
3. ✅ Vérifier que le contenu est lu

### Test 2 : Page avec JavaScript
1. Ouvrir une page React/Vue (ex: Medium)
2. Attendre 2-3 secondes
3. Dire "read this article"
4. ✅ Vérifier que le contenu est trouvé

### Test 3 : Page Dynamique
1. Ouvrir une page qui charge le contenu progressivement
2. Dire "read this page" immédiatement
3. ✅ Le système doit attendre et réessayer

### Test 4 : Navigation Rapide
1. Ouvrir une page
2. Dire "read this" IMMÉDIATEMENT après le chargement
3. ✅ Le retry system doit fonctionner

---

## 📋 Checklist de Vérification

Si le problème persiste :

- [ ] Le content script est bien injecté ? (Vérifier dans DevTools > Sources)
- [ ] Les logs apparaissent dans la console de la page ?
- [ ] L'URL est autorisée ? (pas de `chrome://` ou `about:`)
- [ ] Le site n'a pas de Content Security Policy stricte ?
- [ ] Le DOM est bien chargé ? (`document.readyState === 'complete'`)
- [ ] Les sélecteurs correspondent à la page ? (vérifier avec `document.querySelector('article')`)

---

## 🐛 Problèmes Connus

### 1. Sites avec CSP Stricte
**Symptôme** : "Refused to execute inline script"
**Solution** : Utiliser `chrome.scripting.executeScript()` (déjà implémenté)

### 2. Single Page Applications (SPA)
**Symptôme** : Le contenu change mais l'extension ne le détecte pas
**Solution** : Le système d'invalidation du cache détecte les changements d'URL

### 3. Lazy Loading
**Symptôme** : Seule une partie du contenu est extraite
**Solution** : Augmenter le délai de retry ou scroller avant l'extraction

---

## 📞 Debug Avancé

### Logger Tous les Éléments de la Page

```javascript
// Dans la console de la page
document.querySelectorAll('p, h1, h2, h3').forEach((el, i) => {
    console.log(`${i}: ${el.tagName} - "${el.textContent.substring(0, 50)}..."`);
});
```

### Tester l'Extraction Manuellement

```javascript
// Dans la console de la page
const content = window.debugExtractContent();
console.log('Sections trouvées:', content.main_sections.length);
console.log('Première section:', content.main_sections[0]?.text);
```

### Vérifier le Timing

```javascript
// Dans background.js (ajouter des logs)
console.time('getPageContext');
const context = await getPageContext();
console.timeEnd('getPageContext');
console.log('Sections:', context.main_sections.length);
```

---

## 💡 Conseils

1. **Toujours attendre** que la page soit complètement chargée avant de tester
2. **Vérifier les logs** dans la console de la page ET du background
3. **Tester sur différents sites** pour identifier les patterns
4. **Utiliser `window.debugExtractContent()`** pour les tests rapides
5. **Augmenter les délais** si nécessaire sur des connexions lentes

---

## 📚 Références

- **Content Scripts** : https://developer.chrome.com/docs/extensions/mv3/content_scripts/
- **Document Ready State** : https://developer.mozilla.org/en-US/docs/Web/API/Document/readyState
- **DOM Events** : https://developer.mozilla.org/en-US/docs/Web/Events
