/**
 * Gestionnaire des credentials GCP pour Vertex AI en JavaScript
 * Utilise uniquement un fichier d'environnement (.env)
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

class GCPCredentialsManager {
    constructor() {
        this.projectId = null;
        this._authenticated = false;
        this.credentialsPath = null;
        this.location = null;
    }

    /**
     * Charge les credentials depuis un fichier .env
     * @param {string} envFilePath - Chemin vers le fichier .env (par défaut ".env")
     * @returns {boolean} True si authentification réussie
     */
    loadFromEnvFile(envFilePath = '.env') {
        try {
            const envPath = path.resolve(envFilePath);
            
            if (!fs.existsSync(envPath)) {
                console.error('Fichier .env non trouvé: ' + envFilePath);
                console.info('Créez un fichier .env avec:');
                console.info('GOOGLE_APPLICATION_CREDENTIALS=./avn-hackathon-project-8df77caa78b2.json');
                console.info('GOOGLE_CLOUD_PROJECT=avn-hackathon-project');
                console.info('GOOGLE_CLOUD_LOCATION=us-central1');
                return false;
            }

            // Recharge le fichier .env
            delete require.cache[require.resolve('dotenv')];
            require('dotenv').config({ path: envPath, override: true });

            // Vérifie les variables requises
            const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
            const projectId = process.env.GOOGLE_CLOUD_PROJECT;
            const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

            if (!credentialsPath) {
                console.error('GOOGLE_APPLICATION_CREDENTIALS manquant dans .env');
                return false;
            }

            if (!projectId) {
                console.error('GOOGLE_CLOUD_PROJECT manquant dans .env');
                return false;
            }

            // Vérifie que le fichier de credentials existe
            const credPath = path.resolve(credentialsPath);
            if (!fs.existsSync(credPath)) {
                console.error('Fichier de credentials non trouvé: ' + credentialsPath);
                return false;
            }

            // Configure les variables d'environnement
            process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
            process.env.GOOGLE_CLOUD_PROJECT = projectId;
            process.env.GOOGLE_CLOUD_LOCATION = location;

            this.projectId = projectId;
            this.credentialsPath = credPath;
            this.location = location;
            this._authenticated = true;

            console.log('Credentials GCP configurés avec succès');

            return true;

        } catch (error) {
            console.error('Erreur chargement .env: ' + error.message);
            return false;
        }
    }

    /**
     * Vérifie si l'authentification est active
     * @returns {boolean}
     */
    isAuthenticated() {
        return this._authenticated;
    }

    /**
     * Retourne l'ID du projet configuré
     * @returns {string|null}
     */
    getProjectId() {
        return this.projectId;
    }

    /**
     * Retourne la région/location GCP
     * @returns {string}
     */
    getLocation() {
        return this.location || process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    }

    /**
     * Retourne le chemin vers le fichier de credentials
     * @returns {string|null}
     */
    getCredentialsPath() {
        return this.credentialsPath;
    }

    /**
     * Teste la connexion à Vertex AI
     * @returns {Promise<boolean>}
     */
    async testVertexAIConnection() {
        if (!this.isAuthenticated()) {
            console.error('Credentials non configurés');
            return false;
        }

        try {
            // Test simple de la disponibilité de Vertex AI
            const { VertexAI } = require('@google-cloud/vertexai');
            
            new VertexAI({
                project: this.projectId,
                location: this.location
            });

            // Test basique - si ça ne lance pas d'exception, c'est bon
            console.log('Connexion Vertex AI testée avec succès');
            return true;

        } catch (error) {
            console.error('Erreur test Vertex AI: ' + error.message);
            return false;
        }
    }

    /**
     * Retourne la configuration complète pour Vertex AI
     * @returns {object}
     */
    getVertexAIConfig() {
        return {
            project: this.projectId,
            location: this.location,
            credentials: this.credentialsPath
        };
    }

    /**
     * Affiche le statut de la configuration
     */
    displayStatus() {
        console.log('\nStatut des Credentials GCP:');
        console.log('   Authentifié: ' + (this.isAuthenticated() ? 'Oui' : 'Non'));
        console.log('   Projet: ' + (this.projectId || 'Non configuré'));
        console.log('   Région: ' + (this.location || 'Non configurée'));
        console.log('   Credentials: ' + (this.credentialsPath ? 'Configuré' : 'Non configuré'));
    }
}

// Instance globale
const gcpCredentials = new GCPCredentialsManager();

/**
 * Initialise les credentials GCP depuis un fichier .env
 * @param {string} envFile - Chemin vers le fichier .env
 * @returns {boolean} True si l'authentification réussit
 */
function initializeGCPCredentials(envFile = '.env') {
    return gcpCredentials.loadFromEnvFile(envFile);
}

/**
 * Retourne l'ID du projet GCP
 * @returns {string|null}
 */
function getProjectId() {
    return gcpCredentials.getProjectId();
}

/**
 * Récupère la région GCP
 * @returns {string}
 */
function getLocation() {
    return gcpCredentials.getLocation();
}

/**
 * Vérifie si GCP est authentifié
 * @returns {boolean}
 */
function isGCPAuthenticated() {
    return gcpCredentials.isAuthenticated();
}

/**
 * Teste la connexion Vertex AI
 * @returns {Promise<boolean>}
 */
async function testVertexAI() {
    return await gcpCredentials.testVertexAIConnection();
}

/**
 * Retourne la configuration Vertex AI
 * @returns {object}
 */
function getVertexAIConfig() {
    return gcpCredentials.getVertexAIConfig();
}

// Export du module
module.exports = {
    GCPCredentialsManager,
    initializeGCPCredentials,
    getProjectId,
    getLocation,
    isGCPAuthenticated,
    testVertexAI,
    getVertexAIConfig,
    gcpCredentials
};

// Test des credentials si exécuté directement
if (require.main === module) {
    console.log('=== Test des credentials GCP ===');
    
    if (initializeGCPCredentials()) {
        console.log('Credentials configurés pour le projet: ' + getProjectId());
        console.log('Région: ' + getLocation());
        
        // Test connexion Vertex AI
        testVertexAI().then(success => {
            if (success) {
                console.log('Vertex AI initialisé avec succès');
            } else {
                console.log('Échec initialisation Vertex AI');
            }
        });
    } else {
        console.log('Échec de la configuration des credentials');
    }
}