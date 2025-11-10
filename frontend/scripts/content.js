function extractPageContent() {
    const structure = {
        url: window.location.href,
        title: document.title,
        main_sections: [],
        forms: extractForms()
    };

    const mainContentSelectors = [
        'article', 'main', '[role="main"]',
        '.post-content', '.article-content', '.content', '#content', '.entry-content'
    ];

    let mainContainer = null;
    for (const selector of mainContentSelectors) {
        mainContainer = document.querySelector(selector);
        if (mainContainer) break;
    }

    const searchRoot = mainContainer || document.body;
    const selectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'blockquote', 'pre'];
    const seenTexts = new Set();
    let totalLength = 0;
    const maxLength = 50000;

    searchRoot.querySelectorAll(selectors.join(', ')).forEach(element => {
        if (totalLength >= maxLength) return;

        const text = element.textContent.trim();
        if (text.length < 20 || seenTexts.has(text)) return;

        const excludeSelectors = [
            'nav', 'header', 'footer', 'aside', '.menu', '.navigation', '.sidebar',
            '.ads', '.comments', '.comment', '.related', '.recommended',
            'button', 'form', '[role="navigation"]', '[role="complementary"]'
        ];

        if (excludeSelectors.some(sel => element.closest(sel))) return;
        if (element.offsetParent === null) return;

        const uiPatterns = [
            /^(accéder|connexion|inscription|menu|recherche|partager|commenter|vote|upvote|downvote)/i,
            /^[0-9]+\s*(points?|commentaires?|votes?)/i,
            /^(accept|reject|agree|cookies?)/i
        ];

        if (uiPatterns.some(pattern => pattern.test(text))) return;

        seenTexts.add(text);
        totalLength += text.length;

        structure.main_sections.push({
            tag: element.tagName,
            text: text.substring(0, 1000),
            xpath: getXPath(element)
        });
    });

    return structure;
}

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

function findLabelForField(field) {
    if (field.id) {
        const label = document.querySelector(`label[for="${field.id}"]`);
        if (label) return label.textContent.trim();
    }

    const parentLabel = field.closest('label');
    if (parentLabel) return parentLabel.textContent.trim();

    return '';
}

function getXPath(element) {
    if (element.id) return `//*[@id="${element.id}"]`;
    if (element === document.body) return '/html/body';

    let path = [];
    let current = element;

    while (current && current !== document.body) {
        let tag = current.tagName.toLowerCase();
        let siblings = Array.from(current.parentNode.children).filter(e => e.tagName === current.tagName);

        if (siblings.length > 1) {
            tag += `[${siblings.indexOf(current) + 1}]`;
        }

        path.unshift(tag);
        current = current.parentNode;
    }

    return '/html/body/' + path.join('/');
}

function executeAction(action) {
    switch (action.type) {
        case 'navigate':
            if (action.method === 'click' && action.url) {
                window.location.href = action.url;
            } else if (action.method === 'back') {
                window.history.back();
            }
            break;

        case 'scroll':
            const amount = action.amount || 300;
            const direction = action.direction === 'up' ? -amount : amount;
            window.scrollBy({ top: direction, behavior: 'smooth' });
            break;

        case 'fill_and_submit':
            fillAndSubmitForm(action);
            break;

        case 'scan_forms':
            chrome.runtime.sendMessage({
                action: 'forms_detected',
                forms: extractForms()
            });
            break;

        default:
            console.warn("Action non supportée:", action.type);
    }
}

function fillAndSubmitForm(action) {
    let form = document.getElementById(action.form_id) ||
        document.querySelector(`form[class*="${action.form_id}"]`) ||
        document.querySelector('form');

    if (!form) {
        console.error("Formulaire non trouvé");
        return;
    }

    (action.fields || []).forEach(field => {
        const input = form.querySelector(`[name="${field.name}"]`) ||
            form.querySelector(`[id="${field.name}"]`) ||
            form.querySelector(`input[type="email"]`);

        if (input) {
            input.value = field.value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    setTimeout(() => {
        form.submit();
        chrome.runtime.sendMessage({ action: 'form_submitted', success: true });
    }, 500);
}

window.addEventListener('load', () => {
    chrome.runtime.sendMessage({
        action: 'page_loaded',
        data: { url: window.location.href, title: document.title }
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'get_dom_content') {
        sendResponse({ content: extractPageContent() });
        return true;
    }

    if (request.action === 'execute_dom_action') {
        executeAction(request.actionData);
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'start_listening_hotword') {
        sendResponse({ started: true });
        return true;
    }
});

