// @reader content-script

import { showError } from '../util.js';
import { addedObserver, parseVisibleObserver } from './common.js';

function shouldParse(node: Node): boolean {
    if (node instanceof HTMLElement) {
        return !node.matches(`
            br,
            img`);
    } else {
        return true;
    }
}

try {
    const visible = parseVisibleObserver(shouldParse);

    const added = addedObserver(
        // <div> causes a splitText error, so it has been omitted.
        'p, h2, h1',
        elements => {
            for (const element of elements) visible.observe(element);
        },
    );

    added.observe(document.body, {
        subtree: true,
        childList: true,
    });
} catch (error) {
    showError(error);
}
