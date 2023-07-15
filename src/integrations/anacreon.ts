// @reader content-script

import { showError } from '../content/toast.js';
import { addedObserver, parseVisibleObserver } from './common.js';

try {
    const visible = parseVisibleObserver();

    const added = addedObserver('.textline, .line_box, .sentence-entry, .my-2.cursor-pointer', elements => {
        for (const element of elements) visible.observe(element);
    });

    added.observe(document.querySelector('#textlog, #entry_holder, main') ?? document.body, {
        subtree: true,
        childList: true,
    });
} catch (error) {
    showError(error);
}
