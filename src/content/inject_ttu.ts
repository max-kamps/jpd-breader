(async () => {
    'use strict';

    const content: typeof import('./content.js') = await import(
        (globalThis.browser ?? chrome).runtime.getURL('/content/content.js')
    );

    function* iterTextNodes(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            yield node;
        } else if (node.nodeType == Node.ELEMENT_NODE) {
            if (node.hasAttribute('data-ttu-spoiler-img')) {
                // Skip this node, we don't want to parse the spoiler label as text
                return;
            }
            if (node.tagName === 'RUBY') {
                yield node;
            } else {
                for (const child of node.childNodes) {
                    yield* iterTextNodes(child);
                }
            }
        }
    }

    const visibleParagraphs = new Set(); // queue of paragraphs waiting to be parsed

    let parsingInProgress = false;
    async function parseVisibleParagraphs() {
        // This function keeps running as long as there are visible paragraphs waiting to be parsed.

        if (parsingInProgress || visibleParagraphs.size == 0)
            // Only run one instance of this function at a time
            return;

        parsingInProgress = true;

        while (visibleParagraphs.size > 0) {
            // Get earliest (rightmost) paragraph
            // TODO support horizontal writing?
            // TODO check to not exceed 2MB(?) limit
            // TODO iterate in fixed chunks of always 10 paragraphs (by child index), whether they are visible or not,
            // rather than only picking *up to* 10 of the visible paragraphs.
            const paragraphs = [...visibleParagraphs.values()].sort((a, b) => a.offsetLeft - b.offsetLeft).slice(0, 10);
            for (const p of paragraphs) {
                visibleParagraphs.delete(p);
                paragraphOnScreenObserver.unobserve(p);
            }

            const fragments = content.textFragments(paragraphs.flatMap(p => [...iterTextNodes(p)]));

            if (fragments.length > 0) {
                const text = fragments.map(x => x.text).join('');

                console.log('parsing', text);

                const result = await content.postRequest('parse', { text });

                content.applyParseResult(fragments, result, true);
            }
        }

        parsingInProgress = false;
    }

    const paragraphOnScreenObserver = new IntersectionObserver(
        (entries, observer) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    // console.log('Entered view:', entry.target, entry.target.innerText);
                    visibleParagraphs.add(entry.target);
                } else {
                    // console.log('Left view:', entry.target, entry.target.innerText);
                    visibleParagraphs.delete(entry.target);
                }
            }
            parseVisibleParagraphs();
        },
        {
            rootMargin: '0px -120px 0px -120px', // TODO for debugging purposes, remove this
            // rootMargin: '100% 100% 100% 100%',
        },
    );
    document.body.insertAdjacentHTML(
        'beforeend',
        `<div style="position:fixed;top:0;right:120px;bottom:0;left:120px;box-shadow:inset 0 0 8px #f00;pointer-events:none;"></div>`,
    );

    function observeParagraph(p) {
        if (p.innerText.trim().length == 0)
            // Paragraph is empty
            return;

        if (p.classList.contains('jpdb-parse-done'))
            // Already parsed
            return;

        paragraphOnScreenObserver.observe(p);
    }

    document.querySelectorAll('p').forEach(observeParagraph);

    const newParagraphObserver = new MutationObserver((mutations, observer) => {
        for (const mutation of mutations) {
            if (mutation.type !== 'childList') continue;

            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;

                if (node.nodeName === 'p') observeParagraph(node);
                else node.querySelectorAll('p').forEach(observeParagraph);
            }
        }
    });

    newParagraphObserver.observe(document.body, {
        subtree: true,
        childList: true,
    });
})();
