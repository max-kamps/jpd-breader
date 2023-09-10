// @reader content-script

import { ParseBatch, requestParse } from '../content/background_comms.js';
import { showError } from '../content/toast.js';
import { addedObserver, paragraphsInNode, parseParagraphs } from './common.js';

addStyles();

try {
    const added = addedObserver('.asbplayer-offscreen', async elements => {
        const batches: ParseBatch[] = [];
        const promises: Promise<void>[] = [];

        for (const element of elements) {
            const paragraphs = paragraphsInNode(element);

            if (paragraphs.length > 0) {
                const [elemBatches, applied] = parseParagraphs(paragraphs);
                batches.push(...elemBatches);
                promises.push(...applied);
            }
        }

        if (batches.length > 0) {
            requestParse(batches);
            await Promise.allSettled(promises);
        }
    });

    added.observe(document.body, {
        subtree: true,
        childList: true,
    });
} catch (error) {
    showError(error);
}

function addStyles() {
    const sheet = (function () {
        const style = document.createElement('style');
        style.appendChild(document.createTextNode(''));
        document.head.appendChild(style);
        return style.sheet;
    })()!;

    // ensure jpdb-popup is displayed on top of subtitles
    sheet.insertRule('.asbplayer-subtitles-container-bottom { z-index: 2147483646 }', 0);
}
