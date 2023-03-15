// @reader content-script

import { showError } from '../util.js';
import { startParsingVisible } from './common.js';

function observeParagraph(p: HTMLElement, paragraphOnScreenObserver: IntersectionObserver) {
    if (p.innerText.trim().length == 0) {
        // Paragraph is empty
        return;
    }

    if (p.classList.contains('jpdb-parse-done'))
        // Already parsed
        return;

    paragraphOnScreenObserver.observe(p);
}

function stuffAfter(paragraphOnScreenObserver: IntersectionObserver) {
    document
        .querySelectorAll('p,li,a,.wikitable,.mw-page-title-main,.mbox-text-span,.thumbcaption,.mw-headline')
        .forEach(e => observeParagraph(e as HTMLElement, paragraphOnScreenObserver));

    const newParagraphObserver = new MutationObserver((mutations, _observer) => {
        for (const mutation of mutations) {
            if (mutation.type !== 'childList') continue;

            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;

                if (node.nodeName === 'p') observeParagraph(node as HTMLElement, paragraphOnScreenObserver);
                else
                    (node as HTMLElement)
                        .querySelectorAll('p')
                        .forEach(e => observeParagraph(e, paragraphOnScreenObserver));
            }
        }
    });

    newParagraphObserver.observe(document.body, {
        subtree: true,
        childList: true,
    });
}

try {
    await startParsingVisible(stuffAfter);
} catch (error) {
    showError(error);
}
