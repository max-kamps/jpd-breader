// @reader content-script

import { showError } from '../content/toast.js';
import { addedObserver, parseVisibleObserver } from './common.js';

try {
    const visible = parseVisibleObserver();

    const added = addedObserver('div[class*="styles_text_"]', elements => {
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
