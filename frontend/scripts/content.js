// --- Rôle du content script: Lire la page et la transmettre à l'agent ---

// Fonction pour extraire une structure simplifiée du DOM
function extractPageContent() {
    const structure = {
        url: window.location.href,
        title: document.title,
        main_sections: [],
        forms: extractForms(), // Extraction des formulaires (Cas d'usage #3)
    };

    // ✅ STRATÉGIE 1: Chercher l'élément principal de contenu
    const mainContentSelectors = [
        'article',
        'main',
        '[role="main"]',
        '.post-content',
        '.article-content',
        '.content',
        '#content',
        '.entry-content',
        '[data-test-id="post-content"]', // Reddit
        '.Post', // Reddit
        'div[data-click-id="text"]' // Reddit post body
    ];

    let mainContainer = null;
    for (const selector of mainContentSelectors) {
        mainContainer = document.querySelector(selector);
        if (mainContainer) {
            console.log(`📦 Main content found with selector: ${selector}`);
            break;
        }
    }

    // ✅ STRATÉGIE 2: Si pas de conteneur principal, chercher dans tout le document
    // mais avec des filtres stricts
    const searchRoot = mainContainer || document.body;

    // ✅ Extraction améliorée avec priorité au contenu principal
    const selectors = [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',  // Titres
        'p',                                   // Paragraphes
        'li',                                  // Items de liste
        'blockquote',                          // Citations
        'pre',                                 // Code
    ];

    // ✅ Utiliser un Set pour éviter les doublons
    const seenTexts = new Set();
    let totalLength = 0;
    const maxLength = 50000; // Limite de caractères

    searchRoot.querySelectorAll(selectors.join(', ')).forEach(element => {
        // ✅ Arrêter si on a déjà beaucoup de contenu
        if (totalLength >= maxLength) {
            return;
        }

        const text = element.textContent.trim();

        // Skip empty, too short, or already seen content
        if (text.length < 20 || seenTexts.has(text)) {
            return;
        }

        // ✅ FILTRES STRICTS: exclure navigation, sidebar, footer, ads, menus
        const excludeSelectors = [
            'nav', 'header', 'footer', 'aside',
            '.menu', '.navigation', '.sidebar', '.ads',
            '.comments', '.comment', // Exclure les commentaires
            '.related', '.recommended', // Exclure les suggestions
            'button', 'form', // Exclure les boutons et formulaires
            '[role="navigation"]',
            '[role="complementary"]',
            '[aria-label*="navigation"]',
            '[aria-label*="menu"]'
        ];

        const isInExcludedSection = excludeSelectors.some(sel => element.closest(sel));
        if (isInExcludedSection) {
            return;
        }

        // ✅ Vérifier que l'élément est visible
        const isVisible = element.offsetParent !== null;
        if (!isVisible) {
            return;
        }

        // ✅ Filtrer les textes qui ressemblent à des éléments UI
        const uiPatterns = [
            /^(accéder|connexion|inscription|menu|recherche|partager|commenter|vote|upvote|downvote)/i,
            /^[0-9]+\s*(points?|commentaires?|votes?)/i,
            /^(accept|reject|agree|cookies?)/i
        ];

        if (uiPatterns.some(pattern => pattern.test(text))) {
            return;
        }

        seenTexts.add(text);
        totalLength += text.length;

        structure.main_sections.push({
            tag: element.tagName,
            text: text.substring(0, 1000), // ✅ Augmenter la limite
            xpath: getXPath(element)
        });
    });

    console.log(`📄 Extracted ${structure.main_sections.length} content sections (${totalLength} chars total)`);

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

