# Système d'Analyse d'Images pour AVN

## Vue d'ensemble

Le système d'analyse d'images permet aux utilisateurs malvoyants d'accéder au contenu visuel des pages web via des descriptions audio générées par IA **de manière intelligente et contextuelle**.

⚠️ **Changement Important** : Le système n'analyse plus TOUTES les images automatiquement. Le LLM décide intelligemment quelles images sont pertinentes en fonction de la demande de l'utilisateur.

---

## 🎯 Objectifs

1. **Accessibilité Intelligente** : Les images pertinentes sont décrites, pas les logos/icônes
2. **Intégration Naturelle** : Les descriptions s'intègrent exactement où elles sont visuellement
3. **Efficacité** : Analyse seulement les images nécessaires (économie de temps et ressources)
4. **Contextualité** : Les descriptions s'adaptent au contenu et à la demande de l'utilisateur

---

## 🏗️ Architecture (Nouvelle Approche)

### Composants

#### 1. **Frontend (`content.js`)**
- **Extraction des images** : Détecte et extrait TOUTES les images avec leurs métadonnées
- **Filtrage basique** : Ignore seulement les images < 100x100 pixels
- **Pas d'analyse** : Envoie uniquement les métadonnées au backend

```javascript
{
    url: "https://example.com/image.jpg",
    alt: "Diagram of neuron structure",
    caption: "Figure 1: Neural connections",
    width: 800,
    height: 600
}
```

#### 2. **Backend (`reading_agent.py`)**

##### `_clean_content_with_llm()` - **Décision Intelligente**
- **Input** : Contenu + Liste d'images avec métadonnées + Requête utilisateur
- **Rôle du LLM** :
  - Analyser la pertinence de chaque image
  - Décider où insérer les images dans le texte
  - Insérer des placeholders `[IMAGE:N]` aux bons endroits
- **Output** : Contenu nettoyé avec placeholders

```python
# Exemple de prompt LLM
"""
AVAILABLE IMAGES:
[Image 1] Alt: Company logo, URL: logo.png
[Image 2] Alt: Brain diagram, URL: brain.jpg
[Image 3] Alt: Author photo, URL: author.jpg

Article: "The human brain is..."

User Request: "Read the full article"

→ LLM Output: "The human brain is... [IMAGE:2] It contains..."
   (Skip logo and author photo, insert brain diagram)
"""
```

##### `_replace_image_placeholders()` - **Analyse On-Demand**
- **Regex** : Détecte tous les `[IMAGE:N]`
- **Analyse** : Appelle `ImageAnalyzer.analyze_image()` UNIQUEMENT pour les images référencées
- **Remplacement** : `[IMAGE:N]` → `"Image: [description]"`

#### 3. **Vision (`image_analyzer.py`)**
- **Gemini Vision** : `gemini-2.0-flash-exp`
- **Trois modes** :
  - `brief` : 1 phrase courte
  - `detailed` : Description complète
  - `contextual` : Description adaptée au contexte de l'article ✨ **Utilisé par défaut**
- **Cache** : Évite de réanalyser la même image
- **Filtrage** : `should_describe_image()` ignore les images trop petites

---

## 📊 Flux de Traitement (Nouvelle Version)

### Scénario 1 : Lecture Normale avec Images

```
1. User: "Read this article"

2. content.js extrait :
   - Texte : "The brain is complex..."
   - Images : [
       {url: "logo.png", alt: "Company logo", width: 50, height: 50},
       {url: "brain.jpg", alt: "Brain diagram", width: 800, height: 600},
       {url: "author.jpg", alt: "Author photo", width: 100, height: 100}
     ]

3. reading_agent._clean_content_with_llm() :
   - LLM reçoit : Texte + Liste des 3 images + "Read this article"
   - LLM décide : Image 1 (logo) → ignore, Image 2 (brain) → pertinent, Image 3 (author) → ignore
   - LLM output : "The brain is complex. [IMAGE:2] It contains billions..."

4. reading_agent._replace_image_placeholders() :
   - Détecte : [IMAGE:2]
   - Appelle : ImageAnalyzer.analyze_image(brain.jpg, mode="contextual", context="The brain is complex...")
   - Remplace : [IMAGE:2] → "Image: Diagram showing the major regions of the brain including the cerebrum, cerebellum, and brainstem."

5. Résultat final :
   "The brain is complex. Image: Diagram showing the major regions of the brain. It contains billions..."

6. TTS lit le contenu avec la description intégrée
```

### Scénario 2 : Lecture Partielle

```
1. User: "Read the first paragraph"

2. LLM output : "First paragraph text... [IMAGE:1]"
   (Seulement l'image du premier paragraphe)

3. ImageAnalyzer analyse UNIQUEMENT Image 1

4. Temps total : ~2-3 secondes (vs 10+ si toutes les images étaient analysées)
```

### Scénario 3 : Résumé (Pas d'Images)

```
1. User: "Give me a summary"

2. LLM output : "Key points: 1) ... 2) ... 3) ..."
   (Aucun [IMAGE:N] car pas pertinent pour un résumé)

3. ImageAnalyzer n'est PAS appelé

4. Temps total : <1 seconde
```

3. reading_agent détecte :
   - _is_image_description_request() → True
   - _handle_image_description_request()

4. image_analyzer génère description détaillée :
   - Mode: "detailed"
   - Contexte: Paragraphes environnants
   - Résultat: "This is a detailed anatomical diagram showing the human brain
     in cross-section. The main regions are labeled: cerebral cortex in gray,
     hippocampus highlighted in yellow, and the brain stem at the base..."

5. TTS lit la description détaillée

6. Après 4 secondes de silence → Reprise automatique de la lecture
```

### Scénario 3 : Images Multiples

```
Article avec 5 images :

Paragraphe 1
Paragraphe 2
→ Image 1: Brief description
Paragraphe 3
Paragraphe 4
→ Image 2: Brief description
Paragraphe 5
→ Image 3: Brief description
etc.
```

---

## 🔧 Configuration

### Extraction des Images (content.js)

```javascript
// Critères de filtrage
const MIN_WIDTH = 100;
const MIN_HEIGHT = 100;

// Sélecteurs
const imageSelectors = 'img, picture > img, figure > img, [role="img"]';
```

### Modes de Description

| Mode | Usage | Longueur | Détails |
|------|-------|----------|---------|
| `brief` | Intégration automatique | ~20 mots | Type + sujet principal |
| `detailed` | Sur demande utilisateur | ~100 mots | Tout ce qui est visible |
| `contextual` | Avec contexte textuel | ~50 mots | Description + pertinence |

### Paramètres du Modèle

```python
model="gemini-2.0-flash-exp"  # Vision + multimodal
temperature=0.3                # Plus factuel
```

---

## 🎤 Commandes Vocales

### Activation Automatique
- "Read this article" → Inclut automatiquement les images
- "Read the full page" → Toutes les images décrites

### Demandes Spécifiques
- "Describe the image"
- "Tell me more about the diagram"
- "What does the chart show?"
- "Explain the picture"
- "What's in the illustration?"

### Contrôle
- User peut interrompre pendant une description
- Reprise automatique après clarification

---

## 🧠 Logique Intelligente

### Quelles Images Décrire ?

```python
def should_describe_image(image):
    # Toujours décrire si :
    if image.caption:              # A une légende
        return True
    
    if width > 400 and height > 300:  # Grande image
        return True
    
    if len(alt_text) > 20:         # Alt text informatif
        return True
    
    # Par défaut : oui
    return True
```

### Positionnement des Descriptions

**Stratégie** : Répartition équitable dans le texte

```python
total_paragraphs = 10
total_images = 3

# Insérer une image tous les ~3 paragraphes
interval = 10 // (3 + 1) = 2-3 paragraphes
```

---

## 💾 Cache et Performance

### Cache des Descriptions

```python
# Clé de cache
cache_key = f"{image_url}_{mode}"

# Durée : Permanente dans la session
# Bénéfice : Évite les appels API répétés
```

### Optimisations

1. **Contexte Limité** : Maximum 1000 caractères envoyés au LLM
2. **Batch Processing** : Analyser toutes les images d'un coup
3. **Fallback sur Alt Text** : Si disponible et de qualité
4. **Lazy Loading** : Analyser seulement les images affichées

---

## 🧪 Tests

### Test 1 : Extraction Basique

```bash
# Ouvrir une page avec images (ex: Wikipedia)
# Ouvrir DevTools → Console
window.debugExtractContent()

# Vérifier
content.images.length > 0
content.images[0].url
content.images[0].alt
```

### Test 2 : Lecture avec Images

```
User: "Read this article about neurons"

Expected:
"The brain contains neurons. Image: Diagram of a neuron showing dendrites
and axon. These neurons communicate via..."
```

### Test 3 : Description Détaillée

```
User: (pendant la lecture) "Describe the diagram"

Expected:
"This is a detailed scientific diagram of a neuron. The cell body is shown
in the center in blue, with branching dendrites extending outward. The long
axon extends to the right, covered by a myelin sheath shown in white segments..."

→ 4 secondes → Reprise automatique
```

### Test 4 : Article Sans Images

```
User: "Read this text article"

Expected: Lecture normale sans mention d'images
```

---

## 🐛 Dépannage

### Les images ne sont pas extraites

**Vérifier** :
```javascript
// Dans DevTools Console
const imgs = document.querySelectorAll('img');
console.log(`${imgs.length} images trouvées`);

imgs.forEach(img => {
    console.log(`${img.width}x${img.height} - ${img.src.substring(0,50)}`);
});
```

### Les descriptions ne sont pas générées

**Causes possibles** :
1. **API Key manquante** : Vérifier `GOOGLE_API_KEY` dans `.env`
2. **Quota dépassé** : Vérifier les logs Gemini
3. **Image inaccessible** : URL CORS ou erreur 404

**Debug** :
```python
# Dans reading_agent.py, ajouter :
print(f"🖼️ Image URL: {image['url']}")
print(f"🖼️ Analyzing: {len(images)} images")
```

### Les descriptions sont trop longues/courtes

**Ajuster** :
```python
# Dans image_analyzer.py
max_lengths = {
    "brief": 150,      # ← Ajuster ici
    "detailed": 500,   # ← Ou ici
    "contextual": 300
}
```

---

## 📈 Améliorations Futures

### Court Terme
1. **Détection des graphiques** : Extraire les données des charts
2. **OCR pour texte dans images** : Lire le texte visible
3. **Navigation d'images** : "Next image", "Previous image"

### Moyen Terme
4. **Résumé visuel** : "What images are on this page?"
5. **Comparaison** : "Compare the two diagrams"
6. **Filtrage par type** : "Show me only the charts"

### Long Terme
7. **Génération de descriptions personnalisées** : Selon les préférences utilisateur
8. **Extraction de données** : Depuis graphiques et tableaux
9. **Annotations audio** : Descriptions avec tonalité et emphase

---

## 📚 Références

### Gemini Vision API
- **Documentation** : https://ai.google.dev/gemini-api/docs/vision
- **Modèle utilisé** : `gemini-2.0-flash-exp`
- **Formats supportés** : JPG, PNG, GIF, WebP

### Meilleures Pratiques Accessibilité
- **WCAG 2.1** : Guidelines pour images
- **WebAIM** : Alt text best practices
- **A11Y Project** : Image accessibility

### LangChain Multimodal
- **HumanMessage avec images** : https://python.langchain.com/docs/how_to/multimodal_inputs/
- **Vision models** : https://python.langchain.com/docs/integrations/chat/google_generative_ai

---

## 💡 Conseils d'Utilisation

### Pour les Développeurs

1. **Toujours tester avec alt text** : Même sans API, l'alt text doit fonctionner
2. **Limiter les appels API** : Utiliser le cache
3. **Gérer les erreurs** : Fallback gracieux sur alt text
4. **Monitorer les coûts** : Gemini Vision a un coût par image

### Pour les Utilisateurs

1. **Interrompre librement** : Vous pouvez demander plus de détails à tout moment
2. **Être spécifique** : "Describe the chart" vs "Describe the image"
3. **Utiliser les captions** : Si disponibles, elles sont automatiquement lues
4. **Demander des résumés** : "What images are in this article?"

---

## 🔒 Sécurité et Vie Privée

### Images Sensibles
- Les images ne sont **jamais stockées** côté serveur
- Seules les URLs sont transmises
- Les descriptions sont en cache local seulement

### CORS et Permissions
- Les images doivent être accessibles publiquement
- Pas de support pour images authentifiées (pour l'instant)

### Rate Limiting
- Cache pour éviter les appels répétés
- Batch processing pour optimiser
- Timeout de 10s par image

---

## ✅ Checklist d'Implémentation

- [x] Extraction des images dans content.js
- [x] Module d'analyse avec Gemini Vision
- [x] Intégration dans reading_agent.py
- [x] Descriptions brèves automatiques
- [x] Descriptions détaillées sur demande
- [x] Cache des descriptions
- [x] Gestion des erreurs et fallbacks
- [x] Documentation complète

**Prochaines étapes** :
- [ ] Tests end-to-end
- [ ] Optimisation des prompts
- [ ] Support des graphiques/charts
- [ ] Interface pour préférences utilisateur
