# Système d'Analyse d'Images pour AVN

## Vue d'ensemble

Le système d'analyse d'images permet aux utilisateurs malvoyants d'accéder au contenu visuel des pages web via des descriptions audio générées par IA.

---

## 🎯 Objectifs

1. **Accessibilité Totale** : Aucun contenu visuel ne doit être inaccessible
2. **Intégration Naturelle** : Les descriptions s'intègrent dans le flux de lecture
3. **Contrôle Utilisateur** : Possibilité d'approfondir sur demande
4. **Performance** : Cache et optimisations pour éviter les appels API répétés

---

## 🏗️ Architecture

### Composants

#### 1. **Frontend (`content.js`)**
- **Extraction des images** : Détecte et extrait les images significatives de la page
- **Filtrage intelligent** : Ignore les icônes, logos, et petites images
- **Métadonnées** : Capture alt text, caption, dimensions, position

```javascript
{
    url: "https://example.com/image.jpg",
    alt: "Diagram of neuron structure",
    caption: "Figure 1: Neural connections",
    width: 800,
    height: 600,
    position: 2
}
```

#### 2. **Backend (`image_analyzer.py`)**
- **Gemini Vision** : Utilise `gemini-2.0-flash-exp` pour analyser les images
- **Trois modes de description** :
  - `brief` : Une phrase courte (intégration dans le flux)
  - `detailed` : Description complète (sur demande)
  - `contextual` : Avec relation au texte environnant

#### 3. **Integration (`reading_agent.py`)**
- **Intégration automatique** : Insère les descriptions dans le contenu
- **Gestion des demandes** : Détecte les questions sur les images
- **Cache** : Stocke les images analysées dans `reading_state`

---

## 📊 Flux de Traitement

### Scénario 1 : Lecture Normale avec Images

```
1. User: "Read this article"

2. content.js extrait :
   - Texte : "The brain is complex..."
   - Images : [{url: "...", alt: "brain diagram", ...}]

3. reading_agent.py reçoit le contenu

4. image_analyzer.py analyse les images :
   - Mode: "brief"
   - Contexte: Premier paragraphe
   - Résultat: "Image: Diagram of brain structure with labeled regions"

5. Intégration dans le contenu :
   "The brain is complex. Image: Diagram of brain structure. It contains billions..."

6. TTS lit le tout de manière fluide
```

### Scénario 2 : Demande de Description Détaillée

```
1. User écoute : "...Image: Diagram of brain structure..."

2. User interrompt : "Describe the diagram in detail"

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
