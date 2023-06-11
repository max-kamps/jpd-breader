import { browser } from '../util.js';
import { config } from '../background/background.js';

document.querySelector('#settings-link')?.addEventListener('click', () => {
    setTimeout(() => window.close(), 10);
});

function createParseButton(tab: browser.tabs.Tab): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = 'Parse ' + tab.title ?? 'Untitled';
    button.addEventListener('click', async () => {
        // Parse the page
        await browser.tabs.insertCSS(tab.id, { file: '/content/word.css', cssOrigin: 'author' });
        if (config.customWordCSS)
            await browser.tabs.insertCSS(tab.id, { code: config.customWordCSS, cssOrigin: 'author' });
        browser.tabs.executeScript(tab.id, { file: '/integrations/parse_selection.js' });

        // Close the popup
        setTimeout(() => window.close(), 10);
    });
    return button;
}

browser.tabs.query({ active: true }, tabs => {
    const buttonContainer = document.querySelector('#settings-link')?.parentElement;
    for (const tab of tabs) {
        const button = createParseButton(tab);
        buttonContainer?.appendChild(button);
    }
});
