# Intégration Intelligente des Images

## 🎯 Objectif

Intégrer les descriptions d'images de manière **intelligente et contextuelle** dans le contenu lu, en fonction de la demande de l'utilisateur, sans analyser systématiquement toutes les images.

## 🏗️ Architecture

### 1. Flux de Traitement

```
User Request → Reading Agent
    ↓
Extract Content + Images (content.js)
    ↓
LLM Decision: Which images are relevant? (_clean_content_with_llm)
    ↓
Insert [IMAGE:N] placeholders
    ↓
Analyze ONLY selected images (ImageAnalyzer)
    ↓
Replace placeholders with descriptions
    ↓
Read to user
```

### 2. Composants

#### a) Frontend: `content.js`
- **Fonction** : `extractImages()`
- **Rôle** : Extraire les métadonnées des images (url, alt, caption, dimensions)
- **Filtrage** : Ignore les images < 100x100 (icônes, logos)
- **Output** : Liste d'images avec métadonnées

#### b) Backend: `reading_agent.py`

##### `_clean_content_with_llm()`
- **Entrée** : Contenu brut, titre, requête utilisateur, liste d'images
- **Prompt LLM** : 
  - Liste des images disponibles avec métadonnées
  - Instructions pour insérer `[IMAGE:N]` où pertinent
  - Règles de pertinence (skip logos, ads, UI)
- **Sortie** : Contenu nettoyé avec placeholders

##### `_replace_image_placeholders()`
- **Regex** : Trouve tous les `[IMAGE:N]` dans le texte
- **Analyse** : Appelle `ImageAnalyzer.analyze_image()` UNIQUEMENT pour les images référencées
- **Mode** : "contextual" (description en fonction du contexte de l'article)
- **Remplacement** : `[IMAGE:N]` → `"Image: [description]"`

#### c) Vision: `image_analyzer.py`
- **Modes** :
  - `brief` : 1 phrase courte
  - `detailed` : Description complète
  - `contextual` : Description adaptée au contexte de l'article
- **Filtrage** : `should_describe_image()` ignore images trop petites
- **Cache** : Évite de réanalyser la même image

## 📋 Exemples

### Exemple 1 : "Read the full article"

**Images disponibles** :
- [Image 1] Hero image (800x600)
- [Image 2] Logo (50x50)
- [Image 3] Diagram (600x400)
- [Image 4] Author photo (100x100)

**LLM Decision** :
```
Introduction paragraph...

[IMAGE:1]

Main content discussing the diagram...

[IMAGE:3]

Conclusion...
```

**Après analyse** :
```
Introduction paragraph...

Image: A panoramic view of the city skyline at sunset.

Main content discussing the diagram...

Image: A flowchart showing the three-step process: data collection, analysis, and reporting.

Conclusion...
```

### Exemple 2 : "Read the introduction"

**LLM Decision** :
```
First paragraph...

[IMAGE:1]

Second paragraph...
```

→ **Seulement Image 1 est analysée**

### Exemple 3 : "Read the summary"

**LLM Decision** :
```
Key points:
- Point 1
- Point 2
- Point 3
```

→ **Aucune image analysée** (pas pertinent pour un résumé)

## ✅ Avantages de cette Approche

### 1. **Économie de Ressources**
- ❌ Avant : Analyse de toutes les images (10 images × 2s = 20s)
- ✅ Après : Analyse seulement 2-3 images pertinentes (2-3 images × 2s = 4-6s)

### 2. **Pertinence Contextuelle**
- Le LLM décide en fonction :
  - De la demande de l'utilisateur ("read intro" vs "read full article")
  - Du contexte textuel (l'image illustre-t-elle le paragraphe ?)
  - Des métadonnées (alt text significatif ou générique ?)

### 3. **Flexibilité**
- "Read the first paragraph" → 1 image max
- "Read the full article" → Toutes les images pertinentes
- "Read about [topic]" → Images liées au topic uniquement

### 4. **Qualité des Descriptions**
- Mode "contextual" : Descriptions adaptées au contenu
- Exemple : Une photo de montagne sera décrite différemment dans un article de géologie vs un article de tourisme

## 🚫 Images Ignorées (Automatiquement)

Le système ignore automatiquement :
- **Logos et icônes** (< 100×100 pixels)
- **Éléments UI** (boutons, banners)
- **Publicités** (détectées via classe CSS ou position)
- **Images décoratives** (pas d'alt text significatif)

## 🔧 Configuration

### Ajuster le Seuil de Taille
Dans `content.js` :
```javascript
const MIN_IMAGE_SIZE = 100; // pixels
```

### Ajuster le Nombre Max d'Images
Dans `reading_agent.py` :
```python
for i, img in enumerate(images[:10], 1):  # Max 10 images
```

### Ajuster le Mode d'Analyse
Dans `_replace_image_placeholders()` :
```python
mode="contextual"  # Options: "brief", "detailed", "contextual"
```

## 🧪 Tests Recommandés

1. **Article avec beaucoup d'images** :
   - Vérifier que seules les images pertinentes sont analysées
   - Temps d'analyse raisonnable (< 10s)

2. **Article technique avec diagrammes** :
   - Vérifier que les diagrammes sont décrits en détail
   - Descriptions alignées avec le texte

3. **Article avec images décoratives** :
   - Vérifier que les logos/icônes sont ignorés
   - Pas de "Image: Company logo" inutiles

4. **Demandes partielles** :
   - "Read intro" → Vérifier que seules les images d'intro sont analysées
   - "Read conclusion" → Vérifier que les images d'intro ne sont pas analysées

## 📊 Métriques de Succès

- **Temps de réponse** : < 5s pour un article standard
- **Pertinence** : > 80% des images intégrées sont pertinentes
- **Couverture** : > 90% des images importantes sont incluses
- **Précision** : < 5% de faux positifs (logos, UI)

## 🔄 Améliorations Futures

1. **Cache intelligent** : Réutiliser les descriptions d'images déjà analysées
2. **Feedback utilisateur** : "Cette image était-elle utile ?"
3. **Priorité dynamique** : Analyser d'abord les grandes images, puis les petites si nécessaire
4. **Mode "images only"** : "Describe all images on this page"
