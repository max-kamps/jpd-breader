// @reader content-script

import { showError } from '../util.js';
import { addedObserver, parseNodes } from './common.js';

try {
    // Parse lines that already exist
    parseNodes([...document.querySelectorAll('.textline, .line_box')]);

    // Parse new lines as they are added
    const added = addedObserver('.textline, .line_box', elements => {
        parseNodes(elements);
    });

    added.observe(document.querySelector('#textlog') ?? document.body, {
        subtree: true,
        childList: true,
    });
} catch (error) {
    showError(error);
}
