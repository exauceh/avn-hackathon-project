// --- Rôle du content script: Lire la page et la transmettre à l'agent ---

// Fonction pour extraire une structure simplifiée du DOM
function extractPageContent() {
    const structure = {
        url: window.location.href,
        title: document.title,
        main_sections: [],
        forms: extractForms(), // Extraction des formulaires (Cas d'usage #3)
    };

    // Extraction basique des titres et paragraphes visibles
    document.querySelectorAll('h1, h2, h3, p, button, a').forEach(element => {
        if (element.textContent.trim().length > 0) {
            structure.main_sections.push({
                tag: element.tagName,
                text: element.textContent.trim().substring(0, 150), // Limiter la taille
                xpath: getXPath(element) // Pour les actions ciblées (Sprint 2/3)
            });
        }
    });

    // Pour l'Équipe A : un JSON léger, facile à analyser par le LLM.
    return structure;
}

// Extraire les formulaires de la page (Cas d'usage #3)
function extractForms() {
    const forms = [];

    document.querySelectorAll('form').forEach((form, index) => {
        const formData = {
            id: form.id || `form-${index}`,
            class: form.className,
            action: form.action,
            method: form.method,
            fields: []
        };

        // Extraire les champs
        form.querySelectorAll('input, textarea, select').forEach(field => {
            formData.fields.push({
                name: field.name,
                type: field.type,
                id: field.id,
                placeholder: field.placeholder,
                label: findLabelForField(field),
                required: field.required,
                value: field.value
            });
        });

        forms.push(formData);
    });

    return forms;
}

// Trouver le label associé à un champ
function findLabelForField(field) {
    // Chercher un label avec for="fieldId"
    if (field.id) {
        const label = document.querySelector(`label[for="${field.id}"]`);
        if (label) return label.textContent.trim();
    }

    // Chercher un label parent
    const parentLabel = field.closest('label');
    if (parentLabel) return parentLabel.textContent.trim();

    return '';
}

// Helper: Générer le XPath pour cibler les éléments (important pour le click vocal)
function getXPath(element) {
    if (element.id) {
        return `//*[@id="${element.id}"]`;
    }

    if (element === document.body) {
        return '/html/body';
    }

    let path = [];
    let current = element;

    while (current && current !== document.body) {
        let tag = current.tagName.toLowerCase();
        let siblings = Array.from(current.parentNode.children).filter(e => e.tagName === current.tagName);

        if (siblings.length > 1) {
            let index = siblings.indexOf(current) + 1;
            tag += `[${index}]`;
        }

        path.unshift(tag);
        current = current.parentNode;
    }

    return '/html/body/' + path.join('/');
}

// Exécuter les actions DOM reçues de l'agent (Cas d'usage #2 et #3)
function executeAction(action) {
    console.log("🎬 Exécution action:", action);

    switch (action.type) {
        case 'navigate':
            if (action.method === 'click' && action.url) {
                // Ouvrir l'URL dans un nouvel onglet ou le même
                window.location.href = action.url;
            } else if (action.method === 'back') {
                window.history.back();
            }
            break;

        case 'scroll':
            const amount = action.amount || 300;
            const direction = action.direction === 'up' ? -amount : amount;
            window.scrollBy({
                top: direction,
                behavior: 'smooth'
            });
            break;

        case 'fill_and_submit':
            fillAndSubmitForm(action);
            break;

        case 'scan_forms':
            // Retourner les formulaires détectés
            const forms = extractForms();
            chrome.runtime.sendMessage({
                action: 'forms_detected',
                forms: forms
            });
            break;

        default:
            console.warn("Action non supportée:", action.type);
    }
}

// Remplir et soumettre un formulaire (Cas d'usage #3)
function fillAndSubmitForm(action) {
    const formId = action.form_id;
    const fields = action.fields || [];

    // Trouver le formulaire
    let form = document.getElementById(formId);
    if (!form) {
        form = document.querySelector(`form[class*="${formId}"]`);
    }
    if (!form) {
        form = document.querySelector('form'); // Premier formulaire par défaut
    }

    if (!form) {
        console.error("❌ Formulaire non trouvé");
        return;
    }

    console.log("📝 Remplissage du formulaire...");

    // Remplir les champs
    fields.forEach(field => {
        const input = form.querySelector(`[name="${field.name}"]`) ||
            form.querySelector(`[id="${field.name}"]`) ||
            form.querySelector(`input[type="email"]`); // Fallback pour email

        if (input) {
            input.value = field.value;
            console.log(`  ✅ ${field.name}: ${field.value}`);

            // Déclencher les événements pour les validations JS
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    // Soumettre après un court délai
    setTimeout(() => {
        console.log("📤 Soumission du formulaire...");
        form.submit();

        // Notifier le background
        chrome.runtime.sendMessage({
            action: 'form_submitted',
            success: true
        });
    }, 500);
}

// Notifier le chargement d'une nouvelle page (Cas d'usage #2)
window.addEventListener('load', () => {
    console.log("📄 Page chargée:", document.title);

    // Envoyer le contexte au background
    chrome.runtime.sendMessage({
        action: 'page_loaded',
        data: {
            url: window.location.href,
            title: document.title
        }
    });
});

// 1. Écouter les requêtes du background.js (via le service worker)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'get_dom_content') {
        const content = extractPageContent();
        sendResponse({ content: content });
        return true; // Pour une réponse asynchrone
    }

    // 2. Écouter les commandes d'action (Sprint 2.3)
    if (request.action === 'execute_dom_action') {
        executeAction(request.actionData);
        sendResponse({ success: true });
        return true;
    }

    // 3. Démarrer l'écoute hotword / reconnaissance via commande clavier
    if (request.action === 'start_listening_hotword') {
        startHotwordFlow();
        sendResponse({ started: true });
        return true;
    }
});

