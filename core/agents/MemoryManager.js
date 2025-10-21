/**
 * Gestionnaire de Mémoire pour l'Agent de Planification
 * Sauvegarde et récupère l'historique des conversations
 */

const fs = require('fs').promises;
const path = require('path');

class MemoryManager {
    constructor() {
        this.memoryFile = path.join(__dirname, 'data/conversation_memory.txt');
        this.maxTokens = 3000; // Limite approximative pour éviter les prompts trop longs
        this.initialized = false;
    }

    /**
     * S'assurer que le fichier de mémoire existe
     */
    async ensureMemoryFile() {
        if (this.initialized) return;

        try {
            // Créer le dossier data s'il n'existe pas
            const dataDir = path.dirname(this.memoryFile);
            await fs.mkdir(dataDir, { recursive: true });
            
            // Créer le fichier s'il n'existe pas
            try {
                await fs.access(this.memoryFile);
            } catch {
                await fs.writeFile(this.memoryFile, '=== Historique des Conversations AVN ===\n\n');
            }
            this.initialized = true;
        } catch (error) {
            console.error('Erreur lors de l\'initialisation du fichier mémoire:', error);
            this.initialized = false;
        }
    }

    /**
     * Ajouter une nouvelle interaction à la mémoire
     * @param {string} userMessage - Message de l'utilisateur
     * @param {object} agentPlan - Plan JSON généré par l'agent
     */
    async addInteraction(userMessage, agentPlan) {
        try {
            await this.ensureMemoryFile();
            
            const timestamp = new Date().toISOString();
            const interaction = `[${timestamp}]
Utilisateur: ${userMessage}
Agent Plan: ${JSON.stringify(agentPlan, null, 2)}

---

`;

            await fs.appendFile(this.memoryFile, interaction);
            
            // Nettoyer la mémoire si elle devient trop grande
            await this.cleanMemoryIfNeeded();
        } catch (error) {
            console.error('Erreur lors de l\'ajout à la mémoire:', error);
        }
    }

    /**
     * Récupérer l'historique récent pour le contexte
     * @returns {string} Contexte d'historique formaté
     */
    async getRecentContext() {
        try {
            await this.ensureMemoryFile();
            const content = await fs.readFile(this.memoryFile, 'utf-8');
            
            // Compter approximativement les tokens et tronquer si nécessaire
            const lines = content.split('\n');
            let contextLines = [];
            let tokenCount = 0;

            // Commencer par la fin pour garder les interactions récentes
            for (let i = lines.length - 1; i >= 0 && tokenCount < this.maxTokens; i--) {
                const line = lines[i];
                const lineTokens = Math.ceil(line.length / 4); // Approximation: 4 chars = 1 token
                
                if (tokenCount + lineTokens < this.maxTokens) {
                    contextLines.unshift(line);
                    tokenCount += lineTokens;
                } else {
                    break;
                }
            }

            const context = contextLines.join('\n');
            return context.trim() ? `\n--- Contexte des conversations récentes ---\n${context}\n--- Fin du contexte ---\n` : '';
        } catch (error) {
            console.error('Erreur lors de la récupération du contexte:', error);
            return '';
        }
    }

    /**
     * Nettoyer la mémoire si elle devient trop volumineuse
     */
    async cleanMemoryIfNeeded() {
        try {
            const stats = await fs.stat(this.memoryFile);
            const fileSizeKB = stats.size / 1024;

            // Si le fichier fait plus de 50KB, garder seulement les 20 dernières interactions
            if (fileSizeKB > 50) {
                const content = await fs.readFile(this.memoryFile, 'utf-8');
                const interactions = content.split('---\n').filter(section => section.trim());
                
                if (interactions.length > 20) {
                    const header = '=== Historique des Conversations AVN ===\n\n';
                    const recentInteractions = interactions.slice(-20);
                    const newContent = header + recentInteractions.join('---\n') + '---\n';
                    
                    await fs.writeFile(this.memoryFile, newContent);
                    console.log('Mémoire nettoyée: gardé les 20 dernières interactions');
                }
            }
        } catch (error) {
            console.error('Erreur lors du nettoyage de la mémoire:', error);
        }
    }

    /**
     * Obtenir toute l'historique pour consultation
     * @returns {Array} Liste des interactions
     */
    async getAllHistory() {
        try {
            await this.ensureMemoryFile();
            const content = await fs.readFile(this.memoryFile, 'utf-8');
            const sections = content.split('---').filter(section => section.trim() && !section.includes('=== Historique'));
            
            return sections.map((section, index) => {
                try {
                    const lines = section.trim().split('\n');
                    const timestamp = lines[0]?.match(/\[(.*?)\]/)?.[1] || 'Inconnu';
                    
                    // Trouver la ligne utilisateur
                    const userLine = lines.find(line => line.startsWith('Utilisateur:'));
                    const userMessage = userLine ? userLine.replace('Utilisateur: ', '') : '';
                    
                    // Trouver le plan JSON (qui peut être sur plusieurs lignes)
                    const planStartIndex = lines.findIndex(line => line.startsWith('Agent Plan:'));
                    let agentPlan = null;
                    
                    if (planStartIndex !== -1) {
                        // Prendre tout depuis "Agent Plan:" jusqu'à la fin de la section
                        const planLines = lines.slice(planStartIndex);
                        // Enlever "Agent Plan: " seulement de la première ligne
                        planLines[0] = planLines[0].replace('Agent Plan: ', '');
                        const planText = planLines.join('\n').trim();
                        
                        try {
                            agentPlan = JSON.parse(planText);
                        } catch (parseError) {
                            console.warn('Erreur parsing plan JSON:', parseError.message);
                            console.warn('Texte problématique:', planText.substring(0, 100));
                            agentPlan = { error: 'Plan JSON invalide' };
                        }
                    }
                    
                    return {
                        id: index + 1,
                        timestamp,
                        userMessage,
                        agentPlan
                    };
                } catch (sectionError) {
                    console.warn('Erreur parsing section:', sectionError.message);
                    return {
                        id: index + 1,
                        timestamp: 'Erreur',
                        userMessage: 'Section corrompue',
                        agentPlan: { error: 'Erreur de parsing de section' }
                    };
                }
            });
        } catch (error) {
            console.error('Erreur lors de la récupération de l\'historique:', error);
            return [];
        }
    }

    /**
     * Effacer complètement l'historique
     */
    async clearHistory() {
        try {
            await fs.writeFile(this.memoryFile, '=== Historique des Conversations AVN ===\n\n');
            console.log('Historique effacé');
        } catch (error) {
            console.error('Erreur lors de l\'effacement de l\'historique:', error);
        }
    }
}

module.exports = MemoryManager;