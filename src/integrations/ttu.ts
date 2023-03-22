// @reader content-script

import { showError } from '../util.js';
import { addedObserver, parseNodes, visibleObserver } from './common.js';

function shouldParse(node: Node): boolean {
    if (node instanceof HTMLElement) {
        return !node.matches(`[data-ttu-spoiler-img]`);
    } else {
        return true;
    }
}

try {
    // Parse lines (<p>) as they come into view
    const visible = visibleObserver(elements => {
        parseNodes(elements, shouldParse);
    });

    for (const section of document.querySelectorAll('.book-content > * > *')) {
        visible.observe(section);
    }

    // Ttu may add new paragraphs after our extension loads, so observe those too
    const added = addedObserver('.book-content > * > *', elements => {
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
