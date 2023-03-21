// @reader content-script

import { showError } from '../util.js';
import { addedObserver, parseNodes, visibleObserver } from './common.js';

function shouldParse(node: Node): boolean {
    if (node instanceof HTMLElement) {
        return !node.matches(`
            .p-lang-btn,
            .vector-menu-heading-label,
            .vector-toc-toggle,
            .vector-page-toolbar,
            .mw-editsection,
            sup.reference`);
    } else {
        return true;
    }
}

try {
    // Parse headline and content as they becomes visible
    const visible = visibleObserver(elements => {
        parseNodes(elements, shouldParse);
    });

    for (const section of document.querySelectorAll('#firstHeading, #mw-content-text .mw-parser-output > *')) {
        visible.observe(section);
    }

    // Parse popups as they get added
    const added = addedObserver('.mwe-popups-extract > *', elements => {
        parseNodes(elements, shouldParse);
    });

    added.observe(document.body, {
        subtree: true,
        childList: true,
    });
} catch (error) {
    showError(error);
}
