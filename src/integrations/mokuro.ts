// @reader content-script

import { showError } from '../util.js';
import { startParsingVisible } from './common.js';

//TODO merge all <p> in a textbox (otherwise parsing can get cut off or weird)?
function observeParagraph(p: HTMLElement, paragraphOnScreenObserver: IntersectionObserver) {
    if (p.classList.contains('jpdb-parse-done'))
        // Already parsed
        return;

    paragraphOnScreenObserver.observe(p);
}

function stuffAfter(paragraphOnScreenObserver: IntersectionObserver) {
    const getCurrentPage = () => {
        const id = document.getElementById('pageIdxDisplay') as HTMLElement;
        const page = id.innerText.split('/')[0].split(',');
        return page;
    };

    const parseCurrentPage = () => {
        const startPages = getCurrentPage();
        startPages.forEach(page => {
            const actualPage = parseInt(page) - 1;
            const div = document.getElementById('page' + actualPage.toString()) as HTMLElement;
            observeParagraph(div, paragraphOnScreenObserver);
        });
    };

    parseCurrentPage();

    const pageChangeObserver = new MutationObserver((mutations, _observer) => {
        for (const mutation of mutations) {
            if (mutation.type !== 'childList') continue;
            for (const node of mutation.addedNodes) {
                if (node.nodeName === '#text') {
                    parseCurrentPage();
                }
            }
        }
    });

    pageChangeObserver.observe(document.getElementById('pageIdxDisplay') as HTMLElement, {
        childList: true,
    });
}

try {
    await startParsingVisible(stuffAfter);
} catch (error) {
    showError(error);
}
