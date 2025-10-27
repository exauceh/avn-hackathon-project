"""
FormAgent - Agent spécialisé pour les interactions avec les formulaires
Cas d'usage #3: Remplir et soumettre des formulaires
"""

from typing import Dict, Any, List
from langchain_core.messages import SystemMessage, HumanMessage
import re


class FormAgent:
    """Agent pour détecter et remplir des formulaires"""
    
    def __init__(self, llm):
        self.llm = llm
    
    def process(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Traite une requête liée aux formulaires
        
        Args:
            state: État actuel du graphe
        
        Returns:
            État mis à jour avec l'action de formulaire
        """
        
        last_message = state["messages"][-1].content.lower()
        
        print(f"📝 FormAgent: {last_message}")
        
        # Détecter le type d'action
        if any(word in last_message for word in ["inscris", "abonne", "newsletter", "inscription"]):
            return self._handle_newsletter_subscription(state)
        
        elif any(word in last_message for word in ["remplis", "formulaire", "complète"]):
            return self._handle_form_fill(state)
        
        elif any(word in last_message for word in ["soumets", "envoie", "valide"]):
            return self._handle_form_submit(state)
        
        else:
            state["response_text"] = "Je n'ai pas compris l'action sur le formulaire. Pouvez-vous préciser ?"
            state["action"] = {}
        
        return state
    
    def _handle_newsletter_subscription(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Gère l'inscription à une newsletter
        """
        
        # Récupérer le contexte de la page
        page_content = state.get("page_content", {})
        
        # Détecter les formulaires sur la page (simulé pour la démo)
        forms = page_content.get("forms", [])
        
        # Si pas de formulaires dans le contexte, demander au frontend
        if not forms:
            # Préparer une action pour demander au content.js de scanner
            state["action"] = {
                "type": "scan_forms",
                "form_type": "newsletter"
            }
            
            state["response_text"] = "Je cherche un formulaire d'inscription sur cette page..."
            state["needs_confirmation"] = False
            
            return state
        
        # Trouver le formulaire de newsletter
        newsletter_form = self._find_newsletter_form(forms)
        
        if not newsletter_form:
            state["response_text"] = "Je n'ai pas trouvé de formulaire d'inscription sur cette page."
            state["action"] = {}
            return state
        
        # Récupérer l'email de l'utilisateur
        user_email = state.get("user_email", "user@avn.com")
        
        # Préparer la confirmation
        state["response_text"] = (
            f"J'ai trouvé le formulaire d'abonnement. "
            f"Dois-je utiliser votre adresse par défaut : {user_email} ?"
        )
        
        state["needs_confirmation"] = True
        
        # Stocker les infos du formulaire pour la soumission
        state["action"] = {
            "type": "form_ready",
            "form_id": newsletter_form.get("id", ""),
            "fields": newsletter_form.get("fields", []),
            "user_email": user_email
        }
        
        return state
    
    def _handle_form_submit(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Gère la soumission d'un formulaire
        """
        
        last_message = state["messages"][-1].content.lower()
        
        # Vérifier si c'est une confirmation
        if any(word in last_message for word in ["oui", "ok", "vas-y", "soumets", "valide"]):
            
            # Récupérer les infos du formulaire préparé
            form_action = state.get("action", {})
            
            if form_action.get("type") == "form_ready":
                # Préparer l'action de soumission
                state["action"] = {
                    "type": "fill_and_submit",
                    "form_id": form_action.get("form_id", ""),
                    "fields": [
                        {
                            "name": "email",
                            "value": form_action.get("user_email", "")
                        }
                    ]
                }
                
                state["response_text"] = (
                    "Parfait ! Je remplis et soumets le formulaire maintenant. "
                    "Je vous tiendrai informé du résultat."
                )
                
                state["needs_confirmation"] = False
            
            else:
                state["response_text"] = "Aucun formulaire n'est prêt à être soumis. Voulez-vous que je cherche un formulaire ?"
                state["action"] = {}
        
        else:
            # Annulation
            state["response_text"] = "D'accord, je n'envoie pas le formulaire."
            state["action"] = {}
        
        return state
    
    def _handle_form_fill(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Gère le remplissage d'un formulaire générique
        """
        
        page_content = state.get("page_content", {})
        forms = page_content.get("forms", [])
        
        if not forms:
            state["response_text"] = "Je n'ai trouvé aucun formulaire sur cette page."
            state["action"] = {}
            return state
        
        # Analyser le premier formulaire
        form = forms[0]
        
        # Générer une description des champs
        fields_description = self._describe_form_fields(form.get("fields", []))
        
        state["response_text"] = (
            f"J'ai trouvé un formulaire avec les champs suivants : {fields_description}. "
            f"Quelles informations voulez-vous que je remplisse ?"
        )
        
        state["action"] = {
            "type": "form_info",
            "form": form
        }
        
        state["needs_confirmation"] = True
        
        return state
    
    def _find_newsletter_form(self, forms: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Trouve un formulaire de newsletter parmi une liste de formulaires
        
        Args:
            forms: Liste de formulaires détectés
        
        Returns:
            Le formulaire de newsletter ou None
        """
        
        newsletter_keywords = ["newsletter", "subscribe", "inscription", "email", "abonnement"]
        
        for form in forms:
            # Vérifier les attributs du formulaire
            form_text = (
                form.get("id", "") + " " +
                form.get("class", "") + " " +
                form.get("action", "")
            ).lower()
            
            # Vérifier les champs
            fields_text = " ".join([
                f.get("name", "") + " " + f.get("placeholder", "")
                for f in form.get("fields", [])
            ]).lower()
            
            combined_text = form_text + " " + fields_text
            
            # Si contient des mots-clés de newsletter
            if any(keyword in combined_text for keyword in newsletter_keywords):
                return form
        
        return None
    
    def _describe_form_fields(self, fields: List[Dict[str, Any]]) -> str:
        """
        Génère une description textuelle des champs d'un formulaire
        
        Args:
            fields: Liste des champs du formulaire
        
        Returns:
            Description textuelle
        """
        
        if not fields:
            return "aucun champ"
        
        field_names = []
        for field in fields:
            name = field.get("label") or field.get("placeholder") or field.get("name", "champ inconnu")
            field_type = field.get("type", "text")
            field_names.append(f"{name} ({field_type})")
        
        return ", ".join(field_names)
    
    def extract_forms_from_dom(self, page_content: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extrait les formulaires d'un contenu de page
        (À utiliser par le frontend pour passer le contexte)
        
        Args:
            page_content: Contenu de la page (structure DOM)
        
        Returns:
            Liste des formulaires détectés
        """
        
        # Cette fonction sera appelée par le content.js
        # Pour la démo, retourner un formulaire simulé
        return [
            {
                "id": "newsletter-form",
                "class": "newsletter-subscription",
                "action": "/subscribe",
                "method": "POST",
                "fields": [
                    {
                        "name": "email",
                        "type": "email",
                        "placeholder": "Votre email",
                        "label": "Email",
                        "required": True
                    },
                    {
                        "name": "submit",
                        "type": "submit",
                        "value": "S'abonner"
                    }
                ]
            }
        ]


# Test standalone
if __name__ == "__main__":
    from langchain_google_genai import ChatGoogleGenerativeAI
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.0-flash-exp",
        api_key=os.getenv("GOOGLE_API_KEY")
    )
    
    agent = FormAgent(llm)
    
    # Simuler un contexte avec formulaire
    test_state = {
        "messages": [HumanMessage(content="Inscris-toi à la newsletter")],
        "page_content": {
            "forms": [
                {
                    "id": "newsletter-form",
                    "fields": [
                        {
                            "name": "email",
                            "type": "email",
                            "placeholder": "Votre email"
                        }
                    ]
                }
            ]
        },
        "user_email": "testeur@avn.com",
        "response_text": "",
        "needs_confirmation": False,
        "action": {}
    }
    
    result = agent.process(test_state)
    print("\n" + "="*60)
    print("RÉSULTAT DU TEST - FORMULAIRE")
    print("="*60)
    print(f"\n🤖 Réponse:\n{result['response_text']}")
    print(f"\n🎬 Action:\n{result['action']}")
    
    # Test de confirmation
    print("\n" + "="*60)
    print("TEST CONFIRMATION")
    print("="*60)
    test_state["messages"].append(HumanMessage(content="Oui, soumets le formulaire"))
    result2 = agent.process(test_state)
    print(f"\n🤖 Réponse:\n{result2['response_text']}")
    print(f"\n🎬 Action:\n{result2['action']}")
