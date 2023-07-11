// @reader content-script

import { showError } from '../content/toast.js';
import { addedObserver, parseVisibleObserver } from './common.js';

try {
    const visible = parseVisibleObserver();

    const added = addedObserver('yt-formatted-string.ytd-transcript-segment-renderer', elements => {
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
