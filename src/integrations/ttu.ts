// @reader content-script

import { showError } from '../content/toast.js';
import { addedObserver, parseVisibleObserver } from './common.js';

function shouldParse(node: Node): boolean {
    if (node instanceof HTMLElement) {
        return !node.matches('[data-ttu-spoiler-img]');
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

    let isCursorInsidePopup = false;

    window.addEventListener(
        'wheel',
        e => {
            if (isCursorInsidePopup) {
                e.stopPropagation();
                e.preventDefault();
            }
        },
        { capture: true },
    );

    document.addEventListener('mouseover', e => {
        const popup = (e.target as HTMLElement)?.closest('#jpdb-popup');
        if (popup) {
            isCursorInsidePopup = true;
        }
    });

    document.addEventListener('mouseout', e => {
        const popup = (e.target as HTMLElement)?.closest('#jpdb-popup');
        if (!popup) {
            isCursorInsidePopup = false;
        }
    });
} catch (error) {
    showError(error);
}
