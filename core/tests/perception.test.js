const PerceptionAgent = require('../agents/perception');
const { jest } = require('@jest/globals'); // Si vous utilisez Jest
test('Analyse un DOM valide', async () => {
    const perceptionAgent = new PerceptionAgent();
    const domContent = `
        <html>
            <body>
                <h1>Introduction</h1>
                <p>Bienvenue sur notre site...</p>
                <img src="https://example.com/image1.jpg" />
                <form action="/submit">
                    <input type="email" name="email" required />
                    <textarea name="message"></textarea>
                </form>
            </body>
        </html>
    `;
    const result = await perceptionAgent.analyzeDOM(domContent);
    expect(result.sections.length).toBe(1);
    expect(result.images.length).toBe(1);
    expect(result.forms.length).toBe(1);
});

test('Analyse un DOM vide', async () => {
    const perceptionAgent = new PerceptionAgent();
    const domContent = '';
    const result = await perceptionAgent.analyzeDOM(domContent);
    expect(result.sections).toEqual([]);
    expect(result.images).toEqual([]);
    expect(result.forms).toEqual([]);
});

test('Analyse des images non accessibles', async () => {
    const perceptionAgent = new PerceptionAgent();
    const domContent = `
        <html>
            <body>
                <img src="https://invalid-url.com/image.jpg" />
            </body>
        </html>
    `;
    const result = await perceptionAgent.analyzeDOM(domContent);
    expect(result.images[0].labels).toEqual([]); // Aucun label attendu
});