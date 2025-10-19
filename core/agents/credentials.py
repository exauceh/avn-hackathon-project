"""
Gestionnaire des credentials GCP pour Vertex AI
Utilise uniquement un fichier d'environnement (.env)
"""

import os
import logging
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv

logger = logging.getLogger(__name__)


class GCPCredentialsManager:
    """
    Gestionnaire simplifié des credentials GCP via fichier .env
    """
    
    def __init__(self):
        self.project_id = None
        self._authenticated = False
    
    def load_from_env_file(self, env_file_path: str = ".env") -> bool:
        """
        Charge les credentials depuis un fichier .env
        
        Args:
            env_file_path: Chemin vers le fichier .env (par défaut ".env")
            
        Returns:
            bool: True si authentification réussie
        """
        try:
            env_path = Path(env_file_path)
            if not env_path.exists():
                logger.error(f"Fichier .env non trouvé: {env_file_path}")
                logger.info("Créez un fichier .env avec:")
                logger.info("GOOGLE_APPLICATION_CREDENTIALS=./avn-hackathon-project-8df77caa78b2.json")
                logger.info("GOOGLE_CLOUD_PROJECT=avn-hackathon-project")
                return False
            
            # Charge le fichier .env avec python-dotenv (force reload)
            load_dotenv(env_path, override=True)
            
            # Vérifie les variables requises
            credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
            project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
            
            if not credentials_path:
                logger.error("GOOGLE_APPLICATION_CREDENTIALS manquant dans .env")
                return False
            
            if not project_id:
                logger.error("GOOGLE_CLOUD_PROJECT manquant dans .env")
                return False
            
            # Vérifie que le fichier de credentials existe
            cred_path = Path(credentials_path)
            if not cred_path.exists():
                logger.error(f"Fichier de credentials non trouvé: {credentials_path}")
                return False
            
            # Configure les variables d'environnement
            os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = str(cred_path.absolute())
            os.environ['GOOGLE_CLOUD_PROJECT'] = project_id
            
            self.project_id = project_id
            self._authenticated = True
            
            # Credentials chargés silencieusement
            
            return True
            
        except Exception as e:
            logger.error(f"Erreur chargement .env: {e}")
            return False
    
    def is_authenticated(self) -> bool:
        """Vérifie si l'authentification est active"""
        return self._authenticated
    
    def get_project_id(self) -> Optional[str]:
        """Retourne l'ID du projet configuré"""
        return self.project_id


# Instance globale
gcp_credentials = GCPCredentialsManager()


def initialize_gcp_credentials(env_file: str = ".env") -> bool:
    """
    Initialise les credentials GCP depuis un fichier .env
    
    Args:
        env_file: Chemin vers le fichier .env
        
    Returns:
        bool: True si l'authentification réussit
    """
    return gcp_credentials.load_from_env_file(env_file)


def get_project_id() -> Optional[str]:
    """Retourne l'ID du projet GCP"""
    return gcp_credentials.get_project_id()


def get_region() -> str:
    """Récupère la région GCP depuis les variables d'environnement"""
    return os.getenv('GOOGLE_CLOUD_REGION', 'europe-west9')


def is_gcp_authenticated() -> bool:
    """Vérifie si GCP est authentifié"""
    return gcp_credentials.is_authenticated()


# Test des credentials
if __name__ == "__main__":
    print("=== Test des credentials GCP ===")
    
    if initialize_gcp_credentials():
        print(f"✅ Credentials configurés pour le projet: {get_project_id()}")
        
        # Test connexion Vertex AI
        try:
            import vertexai
            vertexai.init(project=get_project_id())
            print(f"✅ Vertex AI initialisé avec succès")
        except Exception as e:
            print(f"❌ Erreur Vertex AI: {e}")
    else:
        print("❌ Échec de la configuration des credentials")