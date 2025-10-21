/**
 * Agent de Planification AVN Hackathon
 * Génère uniquement des plans JSON pour l'orchestrateur
 * Ne gère PAS l'exécution des outils
 */

const { initializeGCPCredentials, getVertexAIConfig } = require('./credentials');
const MemoryManager = require('./MemoryManager');

class PlanningAgent {
    constructor() {
        // Initialisation de la mémoire
        this.memory = new MemoryManager();

        // Initialisation des credentials
        if (!initializeGCPCredentials()) {
            console.warn('Credentials GCP non configurés - mode dégradé');
            this.geminiAvailable = false;
        } else {
            this.geminiAvailable = true;
            this.initializeGemini();
        }

        this.stats = {
            total_requests: 0,
            successful_plans: 0,
            failed_plans: 0
        };
    }

    async initializeGemini() {
        try {
            const { VertexAI } = require('@google-cloud/vertexai');
            const config = getVertexAIConfig();
            
            this.vertexAI = new VertexAI({
                project: config.project,
                location: config.location
            });
            
            this.model = this.vertexAI.getGenerativeModel({
                model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-001',
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 2048,
                    topP: 0.8
                }
            });
            
            console.log('Gemini initialisé pour génération de plans');
            
        } catch (error) {
            console.error('Erreur initialisation Gemini:', error.message);
            this.geminiAvailable = false;
        }
    }

    /**
     * Point d'entrée principal : traite une commande vocale
     * @param {string} command - Commande utilisateur
     * @returns {Object} Plan JSON pour l'orchestrateur
     */
    async processCommand(command) {
        this.stats.total_requests++;

        try {
            if (!command || command.trim().length === 0) {
                return this.createErrorPlan('Commande vide');
            }

            let plan;
            if (this.geminiAvailable) {
                plan = await this.generatePlanWithGemini(command);
            } else {
                plan = this.createErrorPlan('IA non disponible - configuration GCP requise');
            }

            // Sauvegarder l'interaction dans la mémoire
            await this.memory.addInteraction(command, plan);

            this.stats.successful_plans++;
            return plan;

        } catch (error) {
            this.stats.failed_plans++;
            console.error('Erreur traitement commande:', error.message);
            const errorPlan = this.createErrorPlan(error.message);
            
            // Sauvegarder aussi les erreurs dans la mémoire
            try {
                await this.memory.addInteraction(command, errorPlan);
            } catch (memoryError) {
                console.error('Erreur sauvegarde mémoire:', memoryError.message);
            }
            
            return errorPlan;
        }
    }

    /**
     * Génère un plan avec Gemini AI
     */
    async generatePlanWithGemini(command) {
        try {
            const prompt = await this.buildPrompt(command);
            const result = await this.model.generateContent(prompt);
            
            // Extraction du texte de réponse
            let responseText;
            if (result.response && typeof result.response.text === 'function') {
                responseText = result.response.text();
            } else if (result.response && result.response.candidates) {
                responseText = result.response.candidates[0]?.content?.parts[0]?.text || '';
            } else {
                throw new Error('Format de réponse Gemini invalide');
            }

            return this.parsePlanFromResponse(responseText, command);

        } catch (error) {
            console.error('Erreur Gemini:', error.message);
            return this.createErrorPlan(error.message);
        }
    }

    /**
     * Construit le prompt pour Gemini avec contexte de mémoire
     */
    async buildPrompt(userInput) {
        const memoryContext = await this.memory.getRecentContext();

        // Construction du prompt pour Sprint 1.2 - Planification sans DOM
        const prompt = `Tu es un agent planificateur intelligent pour assistant vocal (Sprint 1.2).

MISSION: Analyser les commandes utilisateur et générer des plans d'action structurés SANS INTERACTION DOM.

CONTEXTE DE CONVERSATION:
${memoryContext}

ACTIONS DISPONIBLES (Sprint 1.2 - Simplifiées):
- get_weather: Obtenir météo (location: string, unit?: "celsius"|"fahrenheit")
- get_time: Obtenir heure (timezone?: string, format?: "12h"|"24h")
- search_web: Rechercher sur web (query: string, max_results?: number)
- open_website: Ouvrir site web (url: string, description?: string)
- calculate: Calculer expression (expression: string, precision?: number)
- translate_text: Traduire texte (text: string, from_lang: string, to_lang: string)
- analyze_text: Analyser contenu textuel (text: string, analysis_type?: "sentiment"|"summary"|"keywords")
- manage_bookmarks: Gérer favoris (action: "add"|"remove"|"list", url?: string, title?: string)
- download_page: Télécharger page (url?: string, format: "html"|"pdf"|"text", filename: string)
- ask_clarification: Demander précision (question: string, context?: string)
- limit_acknowledgment: Reconnaître limitation (limitation: string, suggestion?: string)
- chain_actions: Enchaîner plusieurs actions (sequence_type: "parallel"|"sequential")

FORMAT REQUIS:
{
  "intent": "keyword_describing_user_goal",
  "action": "action_name",
  "arguments": {
    "param1": "value1",
    "param2": "value2"
  }
}

FORMAT POUR PLANS MULTI-ACTIONS:
{
    "1": {
        "intent": "keyword_describing_user_goal",
        "action": "action1",
        "arguments": { /* args for action1 */ }
    },
    "2": {
        "intent": "keyword_describing_user_goal",
        "action": "action2", 
        "arguments": { /* args for action2 */ }
    }
}

EXEMPLES DE PLANIFICATION (Simplifiés):

1. Commande: "Quelle est la météo à Paris ?"
→ {
  "intent": "get_weather",
  "action": "get_weather",
  "arguments": {
    "location": "Paris",
    "unit": "celsius"
  }
}

2. Commande: "Quelle heure est-il ?"
→ {
  "intent": "get_current_time",
  "action": "get_time",
  "arguments": {
    "format": "24h"
  }
}

3. Commande: "Recherche des recettes de cookies"
→ {
  "intent": "web_search",
  "action": "search_web",
  "arguments": {
    "query": "recettes cookies",
    "max_results": 5
  }
}

4. Commande: "Ouvre YouTube"
→ {
  "intent": "open_website",
  "action": "open_website",
  "arguments": {
    "url": "https://www.youtube.com",
    "description": "Plateforme de vidéos YouTube"
  }
}

5. Commande: "Calcule 15 multiplié par 23"
→ {
  "intent": "calculate",
  "action": "calculate",
  "arguments": {
    "expression": "15 * 23",
    "precision": 2
  }
}

6. Commande: "Traduis 'bonjour' en anglais"
→ {
  "intent": "translate_text",
  "action": "translate_text",
  "arguments": {
    "text": "bonjour",
    "from_lang": "fr",
    "to_lang": "en"
  }
}

7. Commande: "Analyse ce texte: 'Le projet va très bien, nous sommes satisfaits'"
→ {
  "intent": "analyze_text",
  "action": "analyze_text",
  "arguments": {
    "text": "Le projet va très bien, nous sommes satisfaits",
    "analysis_type": "sentiment"
  }
}

8. Commande: "Recherche des informations sur Python et traduis en anglais"
→ {
  "1": {
    "intent": "research_translate",
    "action": "search_web",
    "arguments": {
      "query": "Python programming",
      "max_results": 3
    }
  },
  "2": {
    "intent": "research_translate", 
    "action": "translate_text",
    "arguments": {
      "text": "[SEARCH_RESULTS]",
      "from_lang": "auto",
      "to_lang": "en"
    }
  }
}

9. Commande: "Mets cette page dans mes favoris"
→ {
  "intent": "add_bookmark",
  "action": "manage_bookmarks",
  "arguments": {
    "action": "add",
    "url": "[CURRENT_PAGE_URL]",
    "title": "[CURRENT_PAGE_TITLE]"
  }
}

10. Commande: "Ajoute ce site dans mes favoris" (sans contexte de page courante)
→ {
  "intent": "clarification_needed",
  "action": "ask_clarification",
  "arguments": {
    "question": "Quelle page ou site web voulez-vous ajouter à vos favoris ? Pouvez-vous me donner l'URL ou le nom du site ?",
    "context": "bookmark_missing_url"
  }
}

11. Commande: "Supprime ce favori"
11. Commande: "Supprime ce favori"
→ {
  "intent": "remove_bookmark",
  "action": "manage_bookmarks",
  "arguments": {
    "action": "remove",
    "url": "[CURRENT_PAGE_URL]"
  }
}

12. Commande: "Montre-moi mes favoris"
→ {
  "intent": "list_bookmarks",
  "action": "manage_bookmarks",
  "arguments": {
    "action": "list"
  }
}

13. Commande: "Télécharge cette page"
→ {
  "intent": "clarification_needed",
  "action": "ask_clarification",
  "arguments": {
    "question": "Sous quel nom voulez-vous sauvegarder cette page ? Et dans quel format : HTML, PDF ou texte ?",
    "context": "download_page_missing_params"
  }
}

13. Commande: "Sauvegarde cette page en PDF sous le nom 'rapport.pdf'"
→ {
  "intent": "download_page_pdf",
  "action": "download_page",
  "arguments": {
    "url": "[CURRENT_PAGE_URL]",
    "format": "pdf",
    "filename": "rapport.pdf"
  }
}

14. Commande: "Télécharge le contenu de cette page en texte sous le nom 'contenu.txt'"
→ {
  "intent": "download_page_text",
  "action": "download_page",
  "arguments": {
    "url": "[CURRENT_PAGE_URL]",
    "format": "text",
    "filename": "contenu.txt"
  }
}

16. Commande ambiguë: "Fais quelque chose"
→ {
  "intent": "clarification_needed",
  "action": "ask_clarification",
  "arguments": {
    "question": "Que voulez-vous que je fasse exactement ? Je peux vous aider avec la météo, des recherches web, des calculs, des traductions, des analyses de texte, la gestion de vos favoris, ou télécharger des pages.",
    "context": "commande_trop_vague"
  }
}

17. Commande nécessitant DOM: "Clique sur le bouton connexion"
→ {
  "intent": "limitation_acknowledged",
  "action": "limit_acknowledgment",
  "arguments": {
    "limitation": "Je ne peux pas encore interagir avec les éléments des pages web",
    "suggestion": "Pour l'instant, je peux ouvrir des sites web, faire des recherches, ou vous aider avec des analyses de données."
  }
}

RÈGLES DE PLANIFICATION (Sprint 1.2 - Simplifiées):
1. Si la commande nécessite une interaction DOM → utiliser "limit_acknowledgment"
2. Si la commande est ambiguë → utiliser "ask_clarification"
3. Si des paramètres importants manquent (nom de fichier, format spécifique, etc.) → utiliser "ask_clarification"
4. Pour plusieurs actions → utiliser le format numéroté {"1": {intent, action, arguments}, "2": {...}}
5. Pour les favoris (ajouter/supprimer/lister) → utiliser "manage_bookmarks"
6. Pour télécharger une page (HTML/PDF/texte) → utiliser "download_page" SEULEMENT si filename et format sont spécifiés
7. Toujours utiliser des paramètres cohérents pour chaque action
8. Adapter les paramètres au contexte de la demande
9. Privilégier les actions orientées web et analyse de données
10. Actions hors contexte web (emails, rappels, notes personnelles) → utiliser "limit_acknowledgment"

COMMANDE UTILISATEUR: "${userInput}"

Génère le plan d'action en format JSON pur (pas de markdown).`;

        return prompt;
    }

    /**
     * Parse la réponse de Gemini en plan JSON (Sprint 1.2)
     */
    parsePlanFromResponse(responseText, _command) {
        try {
            // Nettoyage de la réponse
            let cleanResponse = responseText.trim();
            
            // Extraction du JSON
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/) || [cleanResponse];
            cleanResponse = jsonMatch[0];

            const parsed = JSON.parse(cleanResponse);

            // Support du nouveau format numéroté: {"1": {intent, action, arguments}, "2": {...}}
            if (parsed['1'] && parsed['1'].intent && parsed['1'].action) {
                return parsed;
            }

            // Support de l'ancien format simple: {intent, action, arguments}
            if (parsed.intent && parsed.action && parsed.arguments) {
                return parsed;
            }

            throw new Error('Format JSON non reconnu pour Sprint 1.2');

        } catch (error) {
            console.error('Erreur parsing réponse Gemini:', error.message);
            return this.createErrorPlan(error.message);
        }
    }

    /**
     * Crée un plan d'erreur
     */
    createErrorPlan(errorMessage) {
        return {
            intent: 'error',
            action: 'show_error',
            arguments: {
                message: errorMessage
            }
        };
    }

    /**
     * Consulter l'historique des conversations
     */
    async consultHistory(filter = 'all') {
        try {
            const history = await this.memory.getAllHistory();
            const plan = {
                intent: 'view_history',
                action: 'display_history',
                arguments: {
                    history: history,
                    count: history.length,
                    filter: filter
                }
            };
            
            // Sauvegarder cette consultation dans la mémoire
            await this.memory.addInteraction(`consulter historique (filtre: ${filter})`, plan);
            return plan;
        } catch (error) {
            const errorPlan = this.createErrorPlan(`Erreur lors de la consultation de l'historique: ${error.message}`);
            try {
                await this.memory.addInteraction(`consulter historique (filtre: ${filter})`, errorPlan);
            } catch (memoryError) {
                console.error('Erreur sauvegarde mémoire:', memoryError.message);
            }
            return errorPlan;
        }
    }

    /**
     * Effacer l'historique des conversations
     */
    async clearMemory() {
        try {
            await this.memory.clearHistory();
            const plan = {
                intent: 'clear_memory',
                action: 'show_message',
                arguments: {
                    message: 'Historique effacé avec succès',
                    type: 'success'
                }
            };
            
            // Sauvegarder cette action dans la mémoire (après l'effacement)
            await this.memory.addInteraction('effacer historique', plan);
            return plan;
        } catch (error) {
            const errorPlan = this.createErrorPlan(`Erreur lors de l'effacement: ${error.message}`);
            try {
                await this.memory.addInteraction('effacer historique', errorPlan);
            } catch (memoryError) {
                console.error('Erreur sauvegarde mémoire:', memoryError.message);
            }
            return errorPlan;
        }
    }

    /**
     * Retourne les statistiques
     */
    getStats() {
        return {
            ...this.stats,
            gemini_available: this.geminiAvailable,
            success_rate: this.stats.total_requests > 0 
                ? this.stats.successful_plans / this.stats.total_requests 
                : 0
        };
    }

    /**
     * Test de l'agent
     */
    async test() {
        const testCommands = [
            'Descends sur la page',
            'Clique sur le bouton connexion',
            'Analyse cette page',
            'Va vers la section contact'
        ];

        console.log('Test de l\'agent de planification:');
        
        for (const command of testCommands) {
            const plan = await this.processCommand(command);
            console.log(`\nCommande: "${command}"`);
            console.log('Plan généré:', JSON.stringify(plan, null, 2));
        }

        console.log('\nStatistiques:', this.getStats());
    }
}

module.exports = PlanningAgent;