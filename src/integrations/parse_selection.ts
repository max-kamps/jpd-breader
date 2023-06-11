// @reader content-script

import { browser, showError } from '../util.js';
import { paragraphsInNode, parseParagraphs } from './common.js';
import { requestParse } from '../content/background_comms.js';

// Create the button element
const parse_page = document.createElement('button');
parse_page.innerHTML = 'Parse selection';
Object.assign(parse_page.style, { position: 'fixed', top: '0', right: '0', zIndex: '9999' });

document.body.appendChild(parse_page);
parse_page?.addEventListener('click', () => {
    browser.tabs.executeScript({ file: '/integrations/contextmenu.js' });
});

try {
    const paragraphs = paragraphsInNode(document.body);

    if (paragraphs.length > 0) {
        const [batch, applied] = parseParagraphs(paragraphs);
        requestParse([batch]);
        Promise.allSettled(applied);
    }
} catch (error) {
    showError(error);
}
