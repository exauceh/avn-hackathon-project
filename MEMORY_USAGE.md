# Guide d'Utilisation - Mémoire du Graphe

## Utilisation Frontend (Extension Chrome)

### Consultation de l'état
```javascript
// Dans la console DevTools du background script
chrome.runtime.sendMessage({ action: 'get_graph_state' }, (response) => {
    console.log(response.state);
});
```

### Réinitialisation de session
```javascript
// Méthode 1: Via popup
// Cliquer sur le bouton 🔄 dans la popup

// Méthode 2: Programmatique
chrome.runtime.sendMessage({ action: 'reset_graph_state' }, (response) => {
    console.log("Nouvelle session:", response.session_id);
});
```

### Modification de l'email
```javascript
chrome.runtime.sendMessage({ 
    action: 'set_user_email',
    email: 'nouvel.email@example.com'
}, (response) => {
    console.log("Email mis à jour");
});
```

## Utilisation Backend (API)

### Récupérer l'état d'une session
```bash
curl http://127.0.0.1:8080/graph_state/<session_id>
```

### Supprimer une session
```bash
curl -X DELETE http://127.0.0.1:8080/graph_state/<session_id>
```

### Envoyer une requête avec historique
```bash
curl -X POST http://127.0.0.1:8080/process \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Ma question",
    "context": {
      "url": "https://example.com",
      "graph_state": {
        "session_id": "session_123",
        "messages": [
          {"role": "user", "content": "Question précédente", "timestamp": "2025-01-01T10:00:00"},
          {"role": "assistant", "content": "Réponse précédente", "timestamp": "2025-01-01T10:00:05"}
        ],
        "conversation_history": [],
        "search_results": [],
        "last_action": null
      }
    }
  }'
```

## Tests

### Test Frontend
```bash
# Charger test_frontend_memory.js dans DevTools
# Copier/coller le contenu dans la console du background script
```

### Test Backend
```bash
# Test Python (agents)
cd /home/houegla/code/avn-hackathon-project
python3 test_graph_memory.py

# Test intégration complète
./test_memory_integration.sh
```

## Scénarios d'utilisation

### Scénario 1: Recherche puis navigation
1. User: "Search for AI news"
   - Graphe: Stocke résultats de recherche
2. User: "Open the first article"
   - Graphe: Utilise résultats précédents
3. User: "Go back"
   - Graphe: Se souvient du contexte

### Scénario 2: Formulaire multi-étapes
1. User: "Register on this site"
   - Graphe: Identifie le formulaire
2. User: "My email is user@example.com"
   - Graphe: Stocke l'email
3. User: "Submit the form"
   - Graphe: Utilise l'email stocké

### Scénario 3: Conversation contextuelle
1. User: "What's the weather in Paris?"
   - Graphe: Stocke la ville
2. User: "And tomorrow?"
   - Graphe: Se souvient de Paris
3. User: "What was my first question?"
   - Graphe: Retrouve l'historique

## Dépannage

### L'état n'est pas sauvegardé
- Vérifier que `chrome.storage.local` est accessible
- Consulter les logs dans DevTools (background script)
- Vérifier que `saveGraphState()` est appelé

### L'historique n'est pas transmis au backend
- Vérifier que `graph_state` est dans le contexte
- Consulter les logs de `main.py` pour voir l'état reçu
- Vérifier la structure JSON

### Sessions mélangées
- Chaque session a un `session_id` unique
- Réinitialiser avec le bouton 🔄 ou `reset_graph_state`
- Vérifier que le bon `session_id` est utilisé

### Timeout côté serveur
- État expire après 1 heure d'inactivité
- Frontend conserve l'état indéfiniment
- Backend renvoie 410 (Gone) si expiré

## Limites

- **Historique agent** : 10 derniers messages utilisés
- **Timeout serveur** : 1 heure
- **Stockage local** : Illimité (chrome.storage.local)
- **Taille max message** : Aucune limite imposée

## Bonnes pratiques

1. ✅ Réinitialiser la session pour un nouveau sujet
2. ✅ Conserver l'email utilisateur entre sessions
3. ✅ Ne pas stocker de données sensibles
4. ✅ Nettoyer régulièrement l'historique (bouton 🔄)
5. ✅ Consulter les logs pour déboguer
