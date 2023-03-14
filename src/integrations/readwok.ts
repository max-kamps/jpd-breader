'use strict';
(async () => {
    const browser = (globalThis as any).browser ?? (globalThis as any).chrome;
    const mod: typeof import('./common.js') = await import(browser.runtime.getURL('/integrations/common.js'));
    const observeParagraph = (p: HTMLElement, paragraphOnScreenObserver: IntersectionObserver) => {
        if (p.innerText.trim().length == 0) {
            // Paragraph is empty
            return;
        }

        if (p.classList.contains('jpdb-parse-done'))
            // Already parsed
            return;

        paragraphOnScreenObserver.observe(p);
    };

    const stuffAfter = (observeParagraph: Function, paragraphOnScreenObserver: IntersectionObserver) => {
        document.querySelectorAll('.styles_text__WPY8-').forEach(e => observeParagraph(e, paragraphOnScreenObserver));

        const newParagraphObserver = new MutationObserver((mutations, _observer) => {
            for (const mutation of mutations) {
                if (mutation.type !== 'childList') continue;

                for (const node of mutation.addedNodes) {
                    if (node.nodeName === 'DIV') {
                        (node as HTMLElement)
                            .querySelectorAll('.styles_text__WPY8-')
                            .forEach(e => observeParagraph(e, paragraphOnScreenObserver));
                    }
                }
            }
        });

        newParagraphObserver.observe(document.body, {
            subtree: true,
            childList: true,
        });
    };

    await mod.startParsingVisible(observeParagraph, stuffAfter);
})();
