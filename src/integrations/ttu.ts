// @reader content-script

import { showError } from '../content/toast.js';
import { addedObserver, parseVisibleObserver } from './common.js';

function shouldParse(node: Node): boolean {
    if (node instanceof HTMLElement) {
        return !node.matches(`[data-ttu-spoiler-img]`);
    } else {
        return true;
    }
}

try {
    const visible = parseVisibleObserver(shouldParse);

    const added = addedObserver('.book-content p, .book-content div.calibre1', elements => {
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
