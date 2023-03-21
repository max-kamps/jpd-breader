// @reader content-script

import { showError } from '../util.js';
import { addedObserver, parseNodes } from './common.js';

try {
    // Parse lines that already exist
    parseNodes([...document.querySelectorAll('div[class*="styles_text_"]')]);

    // Parse new lines as they are added
    const added = addedObserver('div[class*="styles_text_"]', elements => {
        console.log(elements);
        parseNodes(elements);
    });

    added.observe(document.body, {
        subtree: true,
        childList: true,
    });
} catch (error) {
    showError(error);
}
