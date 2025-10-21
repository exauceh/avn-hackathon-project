/**
 * Serveur Simple pour l'Agent de Planification AVN
 * API REST minimaliste pour générer des plans JSON
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const PlanningAgent = require('../core/agents/PlanningAgent');

class PlanningServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 5000;
        this.agent = new PlanningAgent();
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname)));
        
        // Logging simple
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Page principale
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'interface.html'));
        });

        // API principale : génération de plans
        this.app.post('/api/plan', async (req, res) => {
            try {
                const { command } = req.body;
                
                if (!command) {
                    return res.status(400).json({ 
                        error: 'Commande requise' 
                    });
                }

                const plan = await this.agent.processCommand(command);
                
                res.json({
                    success: true,
                    plan: plan,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Erreur génération plan:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // API de santé
        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'healthy',
                agent_stats: this.agent.getStats(),
                timestamp: new Date().toISOString()
            });
        });

        // Test de l'agent
        this.app.post('/api/test', async (req, res) => {
            try {
                const testResults = [];
                const testCommands = [
                    'Descends sur la page',
                    'Clique sur connexion',
                    'Analyse cette page'
                ];

                for (const command of testCommands) {
                    const plan = await this.agent.processCommand(command);
                    testResults.push({
                        command,
                        plan
                    });
                }

                res.json({
                    success: true,
                    test_results: testResults,
                    stats: this.agent.getStats()
                });

            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Pour l'équipe B - Orchestration
        // Endpoint compatible avec leur architecture
        this.app.post('/agent/plan', async (req, res) => {
            try {
                const { text, context } = req.body;
                
                if (!text) {
                    return res.status(400).json({ 
                        error: 'Text field required' 
                    });
                }

                const plan = await this.agent.processCommand(text);
                
                // Format spécifique pour l'orchestrateur
                res.json({
                    intent: plan.intent,
                    action: plan.action,
                    arguments: plan.arguments,
                    metadata: {
                        processed_at: new Date().toISOString(),
                        agent_version: '1.0.0',
                        context: context || {}
                    }
                });

            } catch (error) {
                console.error('Erreur endpoint orchestrateur:', error);
                res.status(500).json({
                    error: 'Internal server error',
                    message: error.message
                });
            }
        });

        // Endpoint pour consulter l'historique
        this.app.get('/api/history', async (req, res) => {
            try {
                const filter = req.query.filter || 'all';
                const result = await this.agent.consultHistory(filter);
                res.json(result);
            } catch (error) {
                console.error('Erreur consultation historique:', error);
                res.status(500).json({
                    error: 'Error retrieving history',
                    message: error.message
                });
            }
        });

        // Endpoint pour effacer l'historique
        this.app.post('/api/clear-memory', async (req, res) => {
            try {
                const result = await this.agent.clearMemory();
                res.json(result);
            } catch (error) {
                console.error('Erreur effacement mémoire:', error);
                res.status(500).json({
                    error: 'Error clearing memory',
                    message: error.message
                });
            }
        });

        // Endpoint pour les statistiques
        this.app.get('/api/stats', (req, res) => {
            try {
                const stats = this.agent.getStats();
                res.json({
                    success: true,
                    stats: stats,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Erreur récupération stats:', error);
                res.status(500).json({
                    error: 'Error retrieving stats',
                    message: error.message
                });
            }
        });
    }

    async start() {
        try {
            console.log('Initialisation du serveur de planification...');
            
            this.app.listen(this.port, () => {
                console.log('Serveur démarré sur http://localhost:' + this.port);
                console.log('API de planification: POST /api/plan');
                console.log('API orchestrateur: POST /agent/plan');
                console.log('Santé du système: GET /api/health');
            });

        } catch (error) {
            console.error('Erreur démarrage serveur:', error);
            process.exit(1);
        }
    }
}

// Démarrage si exécuté directement
if (require.main === module) {
    const server = new PlanningServer();
    server.start();
}

module.exports = PlanningServer;