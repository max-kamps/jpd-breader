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
    }

    const stuffAfter = (observeParagraph: Function, paragraphOnScreenObserver: IntersectionObserver) => {
        document.querySelectorAll('.textline,.line_box').forEach((e) => observeParagraph(e, paragraphOnScreenObserver));

        const newParagraphObserver = new MutationObserver((mutations, _observer) => {
            for (const mutation of mutations) {
                if (mutation.type !== 'childList') continue;

                for (const node of mutation.addedNodes) {
                    // if (node.nodeType !== Node.ELEMENT_NODE) continue;

                    if (node.nodeName === "DIV") {
                        // (node as HTMLElement).querySelectorAll("span[class=\"\"]").forEach((e) => observeParagraph(e, paragraphOnScreenObserver));
                        (node as HTMLElement).querySelectorAll("span").forEach((e) => observeParagraph(e, paragraphOnScreenObserver));
                        // observeParagraph(node as HTMLElement);
                    }
                    // else (node as HTMLElement).querySelectorAll('p').forEach(observeParagraph);
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
