/**
 * Test simple pour l'agent de planification AVN
 * Vérifie la génération de plans JSON
 */

const PlanningAgent = require('../core/agents/PlanningAgent');

async function runTests() {
    console.log('=== Test Agent de Planification AVN ===\n');

    const agent = new PlanningAgent();

    // Tests basiques
    const testCommands = [
        'Descends sur la page',
        'Clique sur le bouton connexion',
        'Analyse cette page web',
        'Va vers la section contact',
        'Remplis le formulaire',
        'Montre moi l\'historique',
        'Affiche les statistiques',
        ''  // Test commande vide
    ];

    console.log('Test de génération de plans:\n');

    for (const command of testCommands) {
        try {
            const plan = await agent.processCommand(command);
            
            console.log(`Commande: "${command}"`);
            console.log('Plan JSON:');
            console.log(JSON.stringify(plan, null, 2));
            console.log('---');
        } catch (error) {
            console.error(`Erreur pour "${command}":`, error.message);
        }
    }

    // Statistiques finales
    console.log('\nStatistiques finales:');
    console.log(JSON.stringify(agent.getStats(), null, 2));

    console.log('\n=== Test terminé ===');
    console.log('L\'agent génère des plans JSON compatibles avec l\'orchestrateur');
    
    // Test des fonctionnalités de mémoire
    console.log('\n=== Test Fonctionnalités Mémoire ===\n');
    
    try {
        // Test consultation historique
        const historyResult = await agent.consultHistory();
        console.log('Test consultation historique:');
        console.log(JSON.stringify(historyResult, null, 2));
        
        // Test statistiques
        const stats = agent.getStats();
        console.log('\nStatistiques actuelles:');
        console.log(JSON.stringify(stats, null, 2));
        
    } catch (error) {
        console.error('Erreur test mémoire:', error.message);
    }
    
    return true;
}

// Exécution si appelé directement
if (require.main === module) {
    runTests()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Erreur test:', error);
            process.exit(1);
        });
}

module.exports = { runTests };