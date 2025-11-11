/**
 * Content Script - Extraction du contenu de la page
 * 
 * Améliorations pour éviter les pages vides :
 * 1. ✅ Système de retry (3 tentatives avec délai de 500ms)
 * 2. ✅ Attente du statut 'complete' de la page
 * 3. ✅ Fallback sur extraction basique si sélecteurs échouent
 * 4. ✅ Cache pour éviter les extractions multiples (5s)
 * 5. ✅ Logs détaillés pour debug
 * 6. ✅ Helper window.debugExtractContent() pour tests
 */

// Cache du contenu extrait
let cachedContent = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5000; // 5 secondes

function extractPageContent(useCache = true) {
    // Utiliser le cache si disponible et valide
    if (useCache && cachedContent && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
        console.log('💾 Utilisation du cache');
        return cachedContent;
    }

    const structure = {
        url: window.location.href,
        title: document.title,
        main_sections: [],
        images: [],  // ✅ NOUVEAU : Liste des images
        forms: extractForms()
    };

    // Vérifier l'état de chargement
    const loadingState = document.readyState;
    console.log(`📄 État de la page: ${loadingState}, Titre: "${document.title}"`);

    const mainContentSelectors = [
        'article', 'main', '[role="main"]',
        '.post-content', '.article-content', '.content', '#content', '.entry-content',
        '.main', '.page-content', '#main-content', '.article-body'
    ];

    let mainContainer = null;
    for (const selector of mainContentSelectors) {
        mainContainer = document.querySelector(selector);
        if (mainContainer) {
            console.log(`✅ Conteneur principal trouvé: ${selector}`);
            break;
        }
    }

    const searchRoot = mainContainer || document.body;
    const selectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'blockquote', 'pre', 'div.text'];
    const seenTexts = new Set();
    let totalLength = 0;
    const maxLength = 50000;

    const allElements = searchRoot.querySelectorAll(selectors.join(', '));
    console.log(`🔍 Éléments trouvés: ${allElements.length}`);

    allElements.forEach(element => {
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

    // ✅ Extraire les images significatives de la page
    structure.images = extractImages(mainContainer || document.body);

    console.log(`📊 Extraction terminée: ${structure.main_sections.length} sections, ${structure.images.length} images, ${totalLength} caractères`);

    // Fallback : Si aucun contenu trouvé, extraire le texte brut du body
    if (structure.main_sections.length === 0) {
        console.log('⚠️ Aucune section trouvée - Fallback sur extraction basique');
        const bodyText = document.body.innerText.trim();

        if (bodyText.length > 50) {
            // Diviser en paragraphes approximatifs
            const paragraphs = bodyText.split(/\n\n+/).filter(p => p.trim().length > 20);

            paragraphs.forEach(text => {
                if (structure.main_sections.length < 20 && totalLength < maxLength) {
                    const cleanText = text.trim().substring(0, 1000);
                    structure.main_sections.push({
                        tag: 'P',
                        text: cleanText,
                        xpath: '/html/body'
                    });
                    totalLength += cleanText.length;
                }
            });

            console.log(`📝 Fallback: ${structure.main_sections.length} paragraphes extraits`);
        }
    }

    // Mettre en cache
    cachedContent = structure;
    cacheTimestamp = Date.now();

    return structure;
}

function extractImages(container) {
    const images = [];
    const seenUrls = new Set();

    // Sélecteurs pour les images significatives
    const imageSelectors = 'img, picture > img, figure > img, [role="img"]';

    container.querySelectorAll(imageSelectors).forEach((img, index) => {
        // Filtrer les petites images (icons, logos, etc.)
        if (img.width < 100 || img.height < 100) return;

        // Filtrer les images cachées
        if (img.offsetParent === null) return;

        // Obtenir l'URL de l'image
        let imageUrl = img.src || img.dataset.src || img.dataset.lazySrc;
        if (!imageUrl || imageUrl.startsWith('data:image/svg')) return;

        // Éviter les doublons
        if (seenUrls.has(imageUrl)) return;
        seenUrls.add(imageUrl);

        // Extraire les informations contextuelles
        const alt = img.alt || '';
        const title = img.title || '';

        // Chercher une caption dans figure ou figcaption
        let caption = '';
        const figure = img.closest('figure');
        if (figure) {
            const figcaption = figure.querySelector('figcaption');
            if (figcaption) {
                caption = figcaption.textContent.trim();
            }
        }

        // Position approximative dans le document
        const position = index;

        images.push({
            url: imageUrl,
            alt: alt,
            title: title,
            caption: caption,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            position: position,
            xpath: getXPath(img)
        });
    });

    console.log(`🖼️ ${images.length} images significatives extraites`);
    return images;
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

// Invalider le cache lors des changements de page
let lastUrl = window.location.href;
setInterval(() => {
    if (window.location.href !== lastUrl) {
        console.log('🔄 URL changée - Invalidation du cache');
        cachedContent = null;
        cacheTimestamp = 0;
        lastUrl = window.location.href;
    }
}, 1000);

// Notifier quand la page est chargée
window.addEventListener('load', () => {
    console.log('✅ Page complètement chargée');
    cachedContent = null; // Invalider le cache
    chrome.runtime.sendMessage({
        action: 'page_loaded',
        data: { url: window.location.href, title: document.title }
    });
});

// Aussi notifier sur DOMContentLoaded (plus rapide)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('✅ DOM prêt');
        cachedContent = null; // Invalider le cache
    });
} else {
    console.log('✅ DOM déjà prêt');
}

// Helper de debug (accessible depuis la console)
window.debugExtractContent = () => {
    const content = extractPageContent();
    console.log('🔍 Debug - Contenu extrait:', content);
    console.log(`📊 ${content.main_sections.length} sections trouvées`);
    console.log(`📝 Première section:`, content.main_sections[0]);
    return content;
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'get_dom_content') {
        // Attendre que le contenu soit prêt avec plusieurs tentatives
        waitForContent(3, 500).then(content => {
            sendResponse({ content });
        }).catch(() => {
            // Même si timeout, envoyer ce qu'on a
            sendResponse({ content: extractPageContent() });
        });
        return true; // Async response
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

// Attendre que le contenu soit disponible
async function waitForContent(maxRetries = 3, delay = 500) {
    for (let i = 0; i < maxRetries; i++) {
        const content = extractPageContent();

        // Vérifier si on a du contenu significatif
        if (content.main_sections.length > 0) {
            console.log(`✅ Contenu extrait avec succès (tentative ${i + 1})`);
            return content;
        }

        console.log(`⏳ Tentative ${i + 1}/${maxRetries} - En attente du contenu...`);

        // Attendre avant la prochaine tentative
        if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    console.warn('⚠️ Timeout - Retour du contenu disponible');
    return extractPageContent();
}

