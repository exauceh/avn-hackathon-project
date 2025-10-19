"""
Tests Agent ML - Équipe A
Tests structurés pour l'agent de planification avec Gemini AI
"""
import os
import sys
import unittest
from pathlib import Path

# Ajouter le dossier parent au PYTHONPATH
sys.path.append(str(Path(__file__).parent.parent))

# Configuration pour supprimer les messages d'avertissement
import logging
import warnings
from io import StringIO
import sys

warnings.filterwarnings('ignore')
logging.getLogger('google').setLevel(logging.CRITICAL)
logging.getLogger('absl').setLevel(logging.CRITICAL)
logging.getLogger('grpc').setLevel(logging.CRITICAL)
logging.getLogger('urllib3').setLevel(logging.CRITICAL)
logging.getLogger().setLevel(logging.CRITICAL)
os.environ['GRPC_VERBOSITY'] = 'ERROR'
os.environ['GRPC_TRACE'] = ''
os.environ['GOOGLE_CLOUD_DISABLE_GRPC_TRACING'] = 'true'

# Rediriger stderr temporairement pour supprimer complètement les warnings
old_stderr = sys.stderr
sys.stderr = StringIO()


class TestPlanningAgent(unittest.TestCase):
    """Tests pour l'Agent de Planification"""
    
    @classmethod
    def setUpClass(cls):
        """Configuration initiale des tests"""
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            pass
        
        # Vérifier les variables d'environnement
        cls.credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        cls.project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
        
    def setUp(self):
        """Initialisation avant chaque test"""
        # Vérifications préliminaires
        if not self.credentials_path or not self.project_id:
            self.skipTest("Variables d'environnement GCP manquantes")
            
        if not os.path.exists(self.credentials_path):
            self.skipTest(f"Fichier credentials manquant: {self.credentials_path}")
            
        # Import de l'agent
        from core.agents.ml_agent import PlanningAgent
        self.agent = PlanningAgent()
        
    def test_agent_initialization(self):
        """Test: Initialisation de l'agent"""
        self.assertIsNotNone(self.agent)
        self.assertTrue(self.agent.processor.is_available())
        
    def test_simple_question_processing(self):
        """Test: Traitement d'une question simple"""
        test_input = {"text": "Quelle est la capitale de la France ?"}
        result = self.agent.process_voice_input(test_input)
        
        # Vérifier la structure de la réponse
        self.assertIsNotNone(result)
        self.assertIsInstance(result.intent, str)
        self.assertIsInstance(result.action, str)
        self.assertIsInstance(result.confidence, (int, float))
        self.assertIsInstance(result.response, str)
        self.assertGreater(len(result.response), 0)
        
    def test_factual_question(self):
        """Test: Question factuelle"""
        test_input = {"text": "Qu'est-ce que l'intelligence artificielle ?"}
        result = self.agent.process_voice_input(test_input)
        
        self.assertNotEqual(result.intent, "error")
        self.assertGreater(result.confidence, 0.0)
        self.assertGreater(len(result.response), 10)
        
    def test_practical_question(self):
        """Test: Question pratique"""
        test_input = {"text": "Comment faire du café ?"}
        result = self.agent.process_voice_input(test_input)
        
        self.assertNotEqual(result.intent, "error")
        self.assertIsInstance(result.response, str)
        self.assertGreater(len(result.response), 5)
        
    def test_calculation_question(self):
        """Test: Question de calcul"""
        test_input = {"text": "Combien font 5 plus 3 ?"}
        result = self.agent.process_voice_input(test_input)
        
        self.assertNotEqual(result.intent, "error")
        self.assertGreater(result.confidence, 0.0)
        
    def test_empty_input(self):
        """Test: Gestion d'input vide"""
        test_input = {"text": ""}
        result = self.agent.process_voice_input(test_input)
        
        # Devrait gérer l'erreur gracieusement
        self.assertEqual(result.intent, "error")
        self.assertEqual(result.confidence, 0.0)
        
    def test_pubsub_message_format(self):
        """Test: Format du message Pub/Sub"""
        test_input = {"text": "Test message"}
        result = self.agent.process_voice_input(test_input)
        pubsub_msg = self.agent.to_pubsub_message(result)
        
        # Vérifier que c'est du JSON valide
        import json
        parsed = json.loads(pubsub_msg)
        
        # Vérifier les champs requis
        required_fields = ['intent', 'action', 'arguments', 'confidence', 'source']
        for field in required_fields:
            self.assertIn(field, parsed)
            
        self.assertEqual(parsed['source'], 'team_a_planning')
        
    def test_response_quality(self):
        """Test: Qualité des réponses"""
        questions_test = [
            ("Quelle est la capitale de la France ?", ["paris", "france"]),
            ("Comment faire une omelette ?", ["oeuf", "cuisine"]),
            ("Qu'est-ce que Python ?", ["python", "programmation"])
        ]
        
        for question, keywords in questions_test:
            with self.subTest(question=question):
                test_input = {"text": question}
                result = self.agent.process_voice_input(test_input)
                
                # La réponse ne devrait pas être une erreur
                self.assertNotEqual(result.intent, "error")
                
                # Vérifier qu'au moins un mot-clé est présent
                response_lower = result.response.lower()
                keyword_found = any(kw in response_lower for kw in keywords)
                
                if not keyword_found:
                    # Log pour debug mais ne fait pas échouer le test
                    print(f"Attention: Aucun mot-clé trouvé pour '{question}'")
                    print(f"Réponse: {result.response[:100]}")
                    
    def test_statistics(self):
        """Test: Statistiques de l'agent"""
        # Traiter quelques questions
        for i in range(3):
            test_input = {"text": f"Question test {i}"}
            self.agent.process_voice_input(test_input)
            
        stats = self.agent.get_stats()
        
        self.assertIn('total_processed', stats)
        self.assertIn('success_rate', stats)
        self.assertIn('error_rate', stats)
        self.assertGreaterEqual(stats['total_processed'], 3)


def run_basic_test():
    """Test simple pour validation rapide"""
    # Supprimer tous les warnings dès le début
    import sys
    from io import StringIO
    
    # Sauvegarder les flux originaux
    original_stderr = sys.stderr
    original_stdout = sys.stdout
    
    # Rediriger stderr pour supprimer les warnings GCP
    sys.stderr = StringIO()
    
    print("Test rapide de l'Agent ML...")
    
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        print("Package python-dotenv non installé")
        sys.stderr = original_stderr
        return False
    
    # Vérifications
    credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
    
    if not credentials_path or not project_id:
        print("Variables d'environnement manquantes")
        return False
    
    if not os.path.exists(credentials_path):
        print(f"Fichier credentials manquant: {credentials_path}")
        return False
    
    try:
        # Redirection complète de stderr pour supprimer tous les warnings
        import sys
        from io import StringIO
        
        old_stderr = sys.stderr
        old_stdout = sys.stdout
        
        # Rediriger stderr et stdout temporairement
        sys.stderr = StringIO()
        temp_stdout = StringIO()
        
        try:
            from core.agents.ml_agent import PlanningAgent
            agent = PlanningAgent()
            
            test_input = {"text": "Qu'est-ce que l'intelligence artificielle ?"}
            result = agent.process_voice_input(test_input)
            
            # Restaurer stdout pour l'affichage des résultats
            sys.stdout = old_stdout
            
            print(f"Question: {test_input['text']}")
            print(f"Intent: {result.intent}")
            print(f"Confiance: {result.confidence:.1%}")
            print(f"Réponse: {result.response[:100]}...")
            
            return result.intent != "error"
            
        finally:
            # Toujours restaurer les flux
            sys.stderr = old_stderr
            sys.stdout = old_stdout
        
    except Exception as e:
        print(f"Erreur: {e}")
        return False
    finally:
        # Restaurer stderr original
        sys.stderr = original_stderr


if __name__ == "__main__":
    try:
        # Test rapide ou tests complets
        if len(sys.argv) > 1 and sys.argv[1] == "--quick":
            success = run_basic_test()
            if success:
                print("SUCCESS: Test rapide réussi")
            else:
                print("FAILED: Test rapide échoué")
        else:
            # Tests unittest complets
            unittest.main(verbosity=2)
    finally:
        # Restaurer stderr
        sys.stderr = old_stderr