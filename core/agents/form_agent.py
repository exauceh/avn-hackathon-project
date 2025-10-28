"""
FormAgent - Specialized agent for form interactions
Use case #3: Fill and submit forms
"""

from typing import Dict, Any, List
from langchain_core.messages import SystemMessage, HumanMessage
import re


class FormAgent:
    """Agent for detecting and filling forms"""
    
    def __init__(self, llm):
        self.llm = llm
    
    def process(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes a form-related request
        
        Args:
            state: Current graph state
        
        Returns:
            Updated state with form action
        """
        
        last_message = state["messages"][-1].content.lower()
        
        print(f"📝 FormAgent: {last_message}")
        
        # Detect action type
        if any(word in last_message for word in ["subscribe", "sign up", "newsletter", "registration"]):
            return self._handle_newsletter_subscription(state)
        
        elif any(word in last_message for word in ["fill", "form", "complete"]):
            return self._handle_form_fill(state)
        
        elif any(word in last_message for word in ["submit", "send", "validate"]):
            return self._handle_form_submit(state)
        
        else:
            state["response_text"] = "I didn't understand the form action. Can you clarify?"
            state["action"] = {}
        
        return state
    
    def _handle_newsletter_subscription(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handles newsletter subscription
        """
        
        # Get page context
        page_content = state.get("page_content", {})
        
        # Detect forms on page (simulated for demo)
        forms = page_content.get("forms", [])
        
        # If no forms in context, ask frontend
        if not forms:
            # Prepare action to ask content.js to scan
            state["action"] = {
                "type": "scan_forms",
                "form_type": "newsletter"
            }
            
            state["response_text"] = "I'm looking for a subscription form on this page..."
            state["needs_confirmation"] = False
            
            return state
        
        # Find newsletter form
        newsletter_form = self._find_newsletter_form(forms)
        
        if not newsletter_form:
            state["response_text"] = "I didn't find a subscription form on this page."
            state["action"] = {}
            return state
        
        # Get user email
        user_email = state.get("user_email", "user@avn.com")
        
        # Prepare confirmation
        state["response_text"] = (
            f"I found the subscription form. "
            f"Should I use your default email: {user_email}?"
        )
        
        state["needs_confirmation"] = True
        
        # Store form info for submission
        state["action"] = {
            "type": "form_ready",
            "form_id": newsletter_form.get("id", ""),
            "fields": newsletter_form.get("fields", []),
            "user_email": user_email
        }
        
        return state
    
    def _handle_form_submit(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handles form submission
        """
        
        last_message = state["messages"][-1].content.lower()
        
        # Check if it's a confirmation
        if any(word in last_message for word in ["yes", "ok", "go ahead", "submit", "validate"]):
            
            # Get prepared form info
            form_action = state.get("action", {})
            
            if form_action.get("type") == "form_ready":
                # Prepare submission action
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
                    "Perfect! I'm filling and submitting the form now. "
                    "I'll keep you informed of the result."
                )
                
                state["needs_confirmation"] = False
            
            else:
                state["response_text"] = "No form is ready to submit. Would you like me to find a form?"
                state["action"] = {}
        
        else:
            # Cancellation
            state["response_text"] = "Okay, I won't submit the form."
            state["action"] = {}
        
        return state
    
    def _handle_form_fill(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handles generic form filling
        """
        
        page_content = state.get("page_content", {})
        forms = page_content.get("forms", [])
        
        if not forms:
            state["response_text"] = "I didn't find any form on this page."
            state["action"] = {}
            return state
        
        # Analyze first form
        form = forms[0]
        
        # Generate field description
        fields_description = self._describe_form_fields(form.get("fields", []))
        
        state["response_text"] = (
            f"I found a form with the following fields: {fields_description}. "
            f"What information would you like me to fill in?"
        )
        
        state["action"] = {
            "type": "form_info",
            "form": form
        }
        
        state["needs_confirmation"] = True
        
        return state
    
    def _find_newsletter_form(self, forms: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Finds a newsletter form among a list of forms
        
        Args:
            forms: List of detected forms
        
        Returns:
            Newsletter form or None
        """
        
        newsletter_keywords = ["newsletter", "subscribe", "registration", "email", "subscription"]
        
        for form in forms:
            # Check form attributes
            form_text = (
                form.get("id", "") + " " +
                form.get("class", "") + " " +
                form.get("action", "")
            ).lower()
            
            # Check fields
            fields_text = " ".join([
                f.get("name", "") + " " + f.get("placeholder", "")
                for f in form.get("fields", [])
            ]).lower()
            
            combined_text = form_text + " " + fields_text
            
            # If contains newsletter keywords
            if any(keyword in combined_text for keyword in newsletter_keywords):
                return form
        
        return None
    
    def _describe_form_fields(self, fields: List[Dict[str, Any]]) -> str:
        """
        Generates a textual description of form fields
        
        Args:
            fields: List of form fields
        
        Returns:
            Textual description
        """
        
        if not fields:
            return "no fields"
        
        field_names = []
        for field in fields:
            name = field.get("label") or field.get("placeholder") or field.get("name", "unknown field")
            field_type = field.get("type", "text")
            field_names.append(f"{name} ({field_type})")
        
        return ", ".join(field_names)
    
    def extract_forms_from_dom(self, page_content: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extracts forms from page content
        (To be used by frontend to pass context)
        
        Args:
            page_content: Page content (DOM structure)
        
        Returns:
            List of detected forms
        """
        
        # This function will be called by content.js
        # For demo, return a simulated form
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
                        "placeholder": "Your email",
                        "label": "Email",
                        "required": True
                    },
                    {
                        "name": "submit",
                        "type": "submit",
                        "value": "Subscribe"
                    }
                ]
            }
        ]


# Standalone test
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
    
    # Simulate context with form
    test_state = {
        "messages": [HumanMessage(content="Subscribe to the newsletter")],
        "page_content": {
            "forms": [
                {
                    "id": "newsletter-form",
                    "fields": [
                        {
                            "name": "email",
                            "type": "email",
                            "placeholder": "Your email"
                        }
                    ]
                }
            ]
        },
        "user_email": "tester@avn.com",
        "response_text": "",
        "needs_confirmation": False,
        "action": {}
    }
    
    result = agent.process(test_state)
    print("\n" + "="*60)
    print("FORM TEST RESULT")
    print("="*60)
    print(f"\n🤖 Response:\n{result['response_text']}")
    print(f"\n🎬 Action:\n{result['action']}")
    
    # Confirmation test
    print("\n" + "="*60)
    print("CONFIRMATION TEST")
    print("="*60)
    test_state["messages"].append(HumanMessage(content="Yes, submit the form"))
    result2 = agent.process(test_state)
    print(f"\n🤖 Response:\n{result2['response_text']}")
    print(f"\n🎬 Action:\n{result2['action']}")

