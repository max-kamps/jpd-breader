// @reader content-script

import { browser, showError } from '../util.js';
import { addedObserver, parseVisibleObserver } from './common.js';
import { requestParseSelection } from '../content/background_comms.js';

// Create the button element
const parse_page = document.createElement('button');
parse_page.innerHTML = 'Parse selection';
Object.assign(parse_page.style, { position: 'fixed', top: '0', right: '0', zIndex: '9999' });

document.body.appendChild(parse_page);

const parse_query = '*';
const observe_query = 'p';

function shouldParse(node: Node): boolean {
    if (node instanceof HTMLElement) {
        return node.matches(parse_query);
    } else {
        return true;
    }
}

try {
    const visible = parseVisibleObserver(shouldParse);

    const added = addedObserver(observe_query, elements => {
        for (const element of elements) {
            visible.observe(element);
        }
    });

    added.observe(document.body, {
        subtree: true,
        childList: true,
    });
} catch (error) {
    showError(error);
}

parse_page?.addEventListener('click', () => {
    requestParseSelection();
    browser.tabs.executeScript({ file: '/integrations/contextmenu.js' });
});
