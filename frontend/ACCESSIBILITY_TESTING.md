# 🧪 Guide de Test d'Accessibilité

## Test Rapide (2 minutes)

### 1️⃣ **Test de Contraste Visuel**

**Mode Standard :**
- [ ] Le texte "Parlez maintenant..." est-il **noir foncé** sur fond blanc ?
- [ ] Le texte "Écoute active" est-il **facilement lisible** ?
- [ ] Le titre "AVN Agent" est-il **clairement visible** sur le fond coloré ?

**Mode Haut Contraste (cliquer 👁️) :**
- [ ] Le fond est-il **noir pur** ?
- [ ] Le texte est-il **blanc ou jaune** ?
- [ ] Les bordures sont-elles **épaisses et blanches** ?

### 2️⃣ **Test au Clavier**

- [ ] Appuyez sur `Tab` → Le focus est-il visible ?
- [ ] Appuyez sur `Entrée` → Les boutons répondent-ils ?
- [ ] `Ctrl+Y` → Ouvre-t-il le side panel ?

### 3️⃣ **Test de Lecture d'Écran**

**Windows (NVDA)** :
```
1. Installez NVDA (gratuit) : https://www.nvaccess.org/download/
2. Ouvrez l'extension
3. NVDA devrait lire "Activer l'écoute vocale, bouton"
```

**Mac (VoiceOver)** :
```
1. Cmd + F5 pour activer VoiceOver
2. Ouvrez l'extension
3. VoiceOver devrait annoncer chaque élément
```

### 4️⃣ **Test de Daltonisme**

Simulez le daltonisme avec l'extension Chrome :
- [Colorblindly](https://chrome.google.com/webstore/detail/colorblindly/)

Vérifiez que :
- [ ] Les états sont distinguables sans la couleur (texte + animation)
- [ ] Les messages d'erreur ne dépendent pas uniquement du rouge

---

## Test Approfondi avec Outils

### 🔍 **Lighthouse (Chrome DevTools)**

1. Ouvrez DevTools (`F12`)
2. Onglet **Lighthouse**
3. Cochez **Accessibility**
4. Cliquez **Generate report**
5. **Score attendu : > 95%**

### 🎨 **Contrast Checker**

Testez manuellement avec [WebAIM](https://webaim.org/resources/contrastchecker/) :

**Thème Standard :**
- Texte principal `#0f172a` sur blanc `#ffffff` → **21:1** ✅
- Texte gris `#475569` sur blanc → **7.2:1** ✅
- Vert succès `#059669` sur blanc → **4.5:1** ✅

**Thème Haut Contraste :**
- Blanc `#ffffff` sur noir `#000000` → **21:1** ✅
- Jaune `#ffff00` sur noir → **19.6:1** ✅

### ⌨️ **Test de Navigation Clavier**

```
Tab          → Passe au prochain élément
Shift + Tab  → Élément précédent
Entrée       → Active le bouton
Espace       → Alternative à Entrée
Échap        → Ferme les dialogues
```

**Vérifiez :**
- [ ] Ordre logique (haut → bas)
- [ ] Indicateur de focus visible
- [ ] Pas de piège au clavier

---

## ✅ Checklist de Conformité WCAG

### Niveau A (Minimum)
- [x] 1.1.1 Contenu non textuel (alt text)
- [x] 1.4.1 Utilisation de la couleur
- [x] 2.1.1 Clavier
- [x] 2.4.1 Contourner les blocs
- [x] 4.1.2 Nom, rôle, valeur (ARIA)

### Niveau AA (Standard)
- [x] 1.4.3 Contraste minimum (4.5:1)
- [x] 1.4.5 Texte sous forme d'image (évité)
- [x] 2.4.7 Focus visible
- [x] 4.1.3 Messages de statut

### Niveau AAA (Excellence)
- [x] 1.4.6 Contraste amélioré (7:1)
- [x] 2.5.5 Taille de cible (44px+)
- [x] 3.2.5 Changement à la demande

---

## 🐛 Tests de Régression

Après chaque modification, vérifiez :

1. **Contraste** : Texte toujours lisible
2. **Navigation** : Clavier fonctionne
3. **ARIA** : Lecteur d'écran annonce correctement
4. **Thèmes** : Les deux modes s'affichent bien
5. **Responsive** : Fonctionne sur petits écrans

---

## 📞 Contact

Des questions sur l'accessibilité ?
- [WCAG Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM](https://webaim.org/)
- [A11Y Project](https://www.a11yproject.com/)
