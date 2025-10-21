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
                plan = this.generateBasicPlan(command);
            }

            // Sauvegarder l'interaction dans la mémoire
            await this.memory.addInteraction(command, plan);

            this.stats.successful_plans++;
            return plan;

        } catch (error) {
            this.stats.failed_plans++;
            console.error('Erreur traitement commande:', error.message);
            return this.createErrorPlan(error.message);
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
            return this.generateBasicPlan(command);
        }
    }

    /**
     * Construit le prompt pour Gemini avec contexte de mémoire
     */
    async buildPrompt(command) {
        const memoryContext = await this.memory.getRecentContext();

        return `Tu es un agent de planification. Tu dois générer UN OBJET JSON strict qui décrit un plan ordonné pour l'orchestrateur web.

CONTEXTE MEMOIRE (analyses récentes):
${memoryContext}

COMMANDE ACTUELLE: "${command}"

ANALYSE DU CONTEXTE: 
- Vérifier dans le contexte mémoire s'il y a des extractions DOM récentes (extract_dom, extract_page_info)
- Si une extraction similaire a été faite récemment, utiliser ces informations pour planifier directement
- Si aucune extraction pertinente dans l'historique, alors planifier une nouvelle extraction DOM
- IMPORTANT: Le planificateur extrait le DOM, ne l'analyse pas. L'analyse est faite par d'autres agents.

FORMAT REQUIS (EXACT):
{
    "intent": "mot_cle_court",
    "actions": {
        "1": "action_1",
        "2": "action_2"
    },
    "arguments": {
        "1": {"param1": "valeur1"},
        "2": {"param2": "valeur2"}
    }
}

REGLES STRICTES: 
- intent doit être un mot-clé court (1-3 mots)
- actions: dictionnaire numéroté des actions dans l'ordre d'exécution (1, 2, 3...)
- arguments: dictionnaire numéroté correspondant aux actions (même numéros)
- JAMAIS d'à priori sur les paramètres (pas de pixels, sélecteurs, éléments supposés)
- VERIFIER L'HISTORIQUE/MEMOIRE : si extract_dom ou extract_page_info déjà fait récemment, utiliser ces infos
- Si DOM déjà extrait récemment → planifier directement les actions avec les infos disponibles
- Si paramètres manquants ET pas d'extraction récente → extraire DOM puis utiliser "plan_next_steps"
- Plans peuvent être complets (multi-actions) ou partiels (extraction puis rebouclage)
- Le planificateur PLANIFIE seulement, ne répond pas aux questions (utiliser speak_to_user pour ça)

ACTIONS DISPONIBLES:
- scroll_page: { direction: "up|down", amount: "small|medium|large" }
- click_element: { text: "texte visible exact", selector: "CSS selector si connu" }
- type_text: { text: "texte à saisir", selector: "CSS selector si connu" }
- navigate_to: { url: "https://..." }
- extract_dom: { target: "buttons|forms|links|sections", search_text: "texte recherché" } (extraire structure DOM)
- extract_page_info: { focus: "all|scroll_info|forms|navigation" } (extraire infos de page)
- analyze_data: { data_source: "dom_extract|page_info", question: "question à analyser" } (pour agent d'analyse)
- wait_element: { text: "texte de l'élément attendu", timeout_seconds: 10 }
- clarify_question: { question: "Quelle information manque-t-il ?" }
- speak_to_user: { message: "Message à dire à l'utilisateur via text-to-speech" }
- plan_next_steps: { initial_command: "commande initiale utilisateur", completed_actions: ["liste actions"], next_goal: "objectif suivant" }

EXEMPLES:
1. Action simple directe:
Commande: "Descends sur la page" ->
{
    "intent": "scroll_down",
    "actions": {"1": "scroll_page", "2": "speak_to_user"},
    "arguments": {
        "1": {"direction": "down", "amount": "medium"}, 
        "2": {"message": "J'ai fait défiler la page vers le bas"}
    }
}

2. Navigation directe:
Commande: "Va sur google.com" ->
{
    "intent": "navigate",
    "actions": {"1": "navigate_to", "2": "speak_to_user"},
    "arguments": {
        "1": {"url": "https://google.com"},
        "2": {"message": "J'ai navigué vers Google"}
    }
}

3. Besoin d'extraction DOM (pas dans mémoire):
Commande: "Clique sur connexion" ->
{
    "intent": "click_login",
    "actions": {"1": "extract_dom", "2": "plan_next_steps"},
    "arguments": {
        "1": {"target": "buttons", "search_text": "connexion"},
        "2": {"initial_command": "Clique sur connexion", "completed_actions": ["extract_dom"], "next_goal": "cliquer sur le bouton connexion trouvé"}
    }
}

4. Utilisation d'extraction DOM existante (dans mémoire):
Commande: "Clique sur connexion" (avec DOM récent) ->
{
    "intent": "click_login",
    "actions": {"1": "click_element", "2": "speak_to_user"},
    "arguments": {
        "1": {"selector": "#login-btn", "text": "connexion"},
        "2": {"message": "J'ai cliqué sur le bouton connexion"}
    }
}

5. Multi-actions complexes:
Commande: "Descends et clique sur s'inscrire" (avec DOM connu) ->
{
    "intent": "scroll_click",
    "actions": {"1": "scroll_page", "2": "click_element", "3": "speak_to_user"},
    "arguments": {
        "1": {"direction": "down", "amount": "medium"},
        "2": {"selector": "#signup", "text": "s'inscrire"},
        "3": {"message": "J'ai fait défiler et cliqué sur s'inscrire"}
    }
}

6. Information manquante:
Commande: "Va sur le site" ->
{
    "intent": "navigate",
    "actions": {"1": "clarify_question"},
    "arguments": {"1": {"question": "Sur quel site web voulez-vous naviguer ?"}}
}

7. Formulaire (besoin d'extraction DOM):
Commande: "Remplis le champ nom avec Jean" ->
{
    "intent": "fill_form",
    "actions": {"1": "extract_dom", "2": "plan_next_steps"},
    "arguments": {
        "1": {"target": "forms", "search_text": "nom"},
        "2": {"initial_command": "Remplis le champ nom avec Jean", "completed_actions": ["extract_dom"], "next_goal": "remplir le champ nom avec Jean"}
    }
}

8. Recherche simple:
Commande: "Tape 'pizza' dans la recherche" (avec champ connu) ->
{
    "intent": "search",
    "actions": {"1": "type_text", "2": "speak_to_user"},
    "arguments": {
        "1": {"selector": "#search-input", "text": "pizza"},
        "2": {"message": "J'ai tapé 'pizza' dans la barre de recherche"}
    }
}

9. Question nécessitant analyse de données:
Commande: "Combien y a-t-il de produits sur cette page ?" ->
{
    "intent": "count_products",
    "actions": {"1": "extract_dom", "2": "analyze_data", "3": "speak_to_user"},
    "arguments": {
        "1": {"target": "sections", "search_text": "produit"},
        "2": {"data_source": "dom_extract", "question": "Combien y a-t-il de produits ?"},
        "3": {"message": "Réponse de l'agent d'analyse"}
    }
}

10. Plan complexe multi-actions (DOM en mémoire):
Commande: "Descends, clique sur produits, cherche 'laptop', filtre par prix et achète le premier" ->
{
    "intent": "search_buy",
    "actions": {
        "1": "scroll_page",
        "2": "click_element", 
        "3": "type_text",
        "4": "click_element",
        "5": "click_element",
        "6": "speak_to_user"
    },
    "arguments": {
        "1": {"direction": "down", "amount": "medium"},
        "2": {"selector": "#products-link", "text": "produits"},
        "3": {"selector": "#search-box", "text": "laptop"},
        "4": {"selector": "#filter-price", "text": "prix"},
        "5": {"selector": ".product-item:first-child .buy-btn", "text": "acheter"},
        "6": {"message": "J'ai navigué vers les produits, cherché 'laptop', filtré par prix et ajouté le premier article au panier"}
    }
}

DONNEES: retourne UNIQUEMENT le JSON demandé, sans texte supplémentaire.`;
    }

    /**
     * Parse la réponse de Gemini en plan JSON
     */
    parsePlanFromResponse(responseText, command) {
        try {
            // Nettoyage de la réponse
            let cleanResponse = responseText.trim();
            
            // Extraction du JSON
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/) || [cleanResponse];
            cleanResponse = jsonMatch[0];

            const parsed = JSON.parse(cleanResponse);

            // Nouveau format avec actions et arguments numérotés
            if (parsed.actions && parsed.arguments && typeof parsed.actions === 'object') {
                // Conversion des actions numérotées en plan_steps pour compatibilité
                const plan_steps = [];
                const actionKeys = Object.keys(parsed.actions).sort((a, b) => parseInt(a) - parseInt(b));
                
                for (const key of actionKeys) {
                    const action = parsed.actions[key];
                    const args = parsed.arguments[key] || {};
                    
                    plan_steps.push({
                        intent: action.replace('_', ''),
                        action: action,
                        arguments: args,
                        execution: `Execute ${action} with args: ${JSON.stringify(args)}`
                    });
                }

                const firstAction = actionKeys.length > 0 ? parsed.actions[actionKeys[0]] : null;
                const firstArgs = actionKeys.length > 0 ? parsed.arguments[actionKeys[0]] || {} : {};

                return {
                    intent: parsed.intent || 'unknown',
                    actions: parsed.actions,
                    arguments: parsed.arguments,
                    // Backward compatibility
                    plan_steps: plan_steps,
                    action: firstAction,
                    firstArguments: firstArgs
                };
            }

            // Si ancienne structure avec plan_steps
            if (parsed.plan_steps && Array.isArray(parsed.plan_steps)) {
                const mainIntent = parsed.intent || parsed.plan_steps[0]?.intent || 'unknown';
                const firstStep = parsed.plan_steps[0] || {};

                return {
                    intent: mainIntent,
                    plan_steps: parsed.plan_steps,
                    clarifying_questions: parsed.clarifying_questions || [] ,
                    // For backward compatibility expose 'action' and 'arguments' from first step
                    action: firstStep.action || null,
                    arguments: firstStep.arguments || {}
                };
            }

            // Backward compatibility: single action object
            if (!parsed.intent || !parsed.action) {
                throw new Error('Structure JSON incomplète');
            }

            return {
                intent: parsed.intent,
                plan_steps: [ {
                    intent: parsed.intent,
                    action: parsed.action,
                    arguments: parsed.arguments || {},
                    execution: parsed.execution || ''
                } ],
                clarifying_questions: [],
                action: parsed.action,
                arguments: parsed.arguments || {}
            };

        } catch (error) {
            console.error('Erreur parsing réponse Gemini:', error.message);
            return this.generateBasicPlan(command);
        }
    }

    /**
     * Génère un plan basique sans IA (fallback)
     */
    generateBasicPlan(command) {
        const lowerCommand = command.toLowerCase();

        // Analyse par mots-clés
        if (lowerCommand.includes('descend') || lowerCommand.includes('scroll') || lowerCommand.includes('bas')) {
            return {
                intent: 'scroll_down',
                actions: { '1': 'scroll_page', '2': 'speak_to_user' },
                arguments: { 
                    '1': { direction: 'down', amount: 'medium' },
                    '2': { message: 'J\'ai fait défiler la page vers le bas' }
                },
                // Backward compatibility
                action: 'scroll_page',
                firstArguments: { direction: 'down', amount: 'medium' }
            };
        }

        if (lowerCommand.includes('monte') || lowerCommand.includes('haut')) {
            return {
                intent: 'scroll_up',
                actions: { '1': 'scroll_page', '2': 'speak_to_user' },
                arguments: { 
                    '1': { direction: 'up', amount: 'medium' },
                    '2': { message: 'J\'ai fait défiler la page vers le haut' }
                },
                // Backward compatibility
                action: 'scroll_page',
                firstArguments: { direction: 'up', amount: 'medium' }
            };
        }

        if (lowerCommand.includes('clique') || lowerCommand.includes('click')) {
            // Extraction du texte cible
            const textMatch = command.match(/(?:clique.*?)(?:sur|le|la)\s+(.+?)(?:\s|$)/i);
            const targetText = textMatch ? textMatch[1].trim() : null;

            // Si pas de cible explicite, demander clarification
            if (!targetText) {
                return {
                    intent: 'click',
                    actions: { '1': 'clarify_question' },
                    arguments: { '1': { question: 'Quel élément dois-je cliquer ? (texte ou selector)' } },
                    // Backward compatibility
                    action: 'clarify_question',
                    firstArguments: { question: 'Quel élément dois-je cliquer ? (texte ou selector)' }
                };
            }

            // Vérifier si une extraction DOM récente existe dans la mémoire pour les boutons
            // Note: Dans un vrai système, on vérifierait this.memory.getRecentContext() pour les extractions récentes
            // Pour le fallback, on assume qu'il faut extraire car on n'a pas accès à la mémoire contextuelle ici
            return {
                intent: 'click',
                actions: { 
                    '1': 'extract_dom', 
                    '2': 'plan_next_steps'
                },
                arguments: { 
                    '1': { target: 'buttons', search_text: targetText },
                    '2': { initial_command: command, completed_actions: ['extract_dom'], next_goal: `cliquer sur ${targetText}` }
                },
                // Backward compatibility
                action: 'extract_dom',
                firstArguments: { target: 'buttons', search_text: targetText }
            };
        }

        if (lowerCommand.includes('analyse') || lowerCommand.includes('regarde')) {
            return {
                intent: 'analyze',
                actions: { 
                    '1': 'analyze_page',
                    '2': 'speak_to_user'
                },
                arguments: { 
                    '1': { focus: 'all' },
                    '2': { message: 'J\'ai analysé la page et je peux maintenant vous aider avec son contenu' }
                },
                // Backward compatibility
                action: 'analyze_page',
                firstArguments: { focus: 'all' }
            };
        }

        if (lowerCommand.includes('navigue') || lowerCommand.includes('va vers')) {
            // essayer d'extraire une url
            const urlMatch = command.match(/https?:\/\/[\w.\-/?=&%#]+/i);
            const url = urlMatch ? urlMatch[0] : null;

            if (!url) {
                return {
                    intent: 'navigate',
                    actions: { '1': 'clarify_question' },
                    arguments: { '1': { question: 'Sur quel site web voulez-vous naviguer ?' } },
                    // Backward compatibility
                    action: 'clarify_question',
                    firstArguments: { question: 'Sur quel site web voulez-vous naviguer ?' }
                };
            }

            return {
                intent: 'navigate',
                actions: { 
                    '1': 'navigate_to',
                    '2': 'speak_to_user'
                },
                arguments: { 
                    '1': { url },
                    '2': { message: `J'ai navigué vers ${url}` }
                },
                // Backward compatibility
                action: 'navigate_to',
                firstArguments: { url }
            };
        }

        // Actions de memoire
        if (lowerCommand.includes('historique') || lowerCommand.includes('consulte')) {
            return {
                intent: 'view_history',
                actions: { '1': 'consult_history' },
                arguments: { '1': { filter: 'all' } },
                action: 'consult_history',
                firstArguments: { filter: 'all' }
            };
        }

        if (lowerCommand.includes('efface') || lowerCommand.includes('vide') || lowerCommand.includes('clear')) {
            return {
                intent: 'clear_memory',
                actions: { '1': 'clear_memory' },
                arguments: { '1': { confirm: true } },
                action: 'clear_memory',
                firstArguments: { confirm: true }
            };
        }

        if (lowerCommand.includes('stats') || lowerCommand.includes('statistiques')) {
            return {
                intent: 'view_stats',
                actions: { '1': 'get_stats' },
                arguments: { '1': { type: 'full' } },
                action: 'get_stats',
                firstArguments: { type: 'full' }
            };
        }

        // Plan par défaut
        return {
            intent: 'unknown',
            actions: { '1': 'analyze_page' },
            arguments: { '1': { focus: 'text' } },
            // Backward compatibility
            action: 'analyze_page',
            firstArguments: { focus: 'text' }
        };
    }

    /**
     * Crée un plan d'erreur
     */
    createErrorPlan(errorMessage) {
        return {
            intent: 'error',
            actions: { '1': 'show_error' },
            arguments: { '1': { message: errorMessage } },
            // Backward compatibility
            action: 'show_error',
            firstArguments: { message: errorMessage }
        };
    }

    /**
     * Consulter l'historique des conversations
     */
    async consultHistory(filter = 'all') {
        try {
            const history = await this.memory.getAllHistory();
            return {
                intent: 'view_history',
                action: 'display_history',
                arguments: {
                    history: history,
                    count: history.length,
                    filter: filter
                }
            };
        } catch (error) {
            return this.createErrorPlan(`Erreur lors de la consultation de l'historique: ${error.message}`);
        }
    }

    /**
     * Effacer l'historique des conversations
     */
    async clearMemory() {
        try {
            await this.memory.clearHistory();
            return {
                intent: 'clear_memory',
                action: 'show_message',
                arguments: {
                    message: 'Historique effacé avec succès',
                    type: 'success'
                }
            };
        } catch (error) {
            return this.createErrorPlan(`Erreur lors de l'effacement: ${error.message}`);
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