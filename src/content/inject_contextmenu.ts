(async () => {
    'use strict';

    const content: typeof import('./content.js') = await import(browser.runtime.getURL('/content/content.js'));

    function* iterSelectedNodes(selection: Selection, node: Node): Generator<Text | HTMLElement> {
        if (!selection.containsNode(node, true)) return;

        if (node.nodeType === Node.TEXT_NODE) {
            // TODO Support partial node selections?
            yield node as Text;
        } else if (node.nodeType == Node.ELEMENT_NODE) {
            if ((node as Element).tagName === 'RUBY') {
                yield node as HTMLElement;
            } else {
                for (const child of node.childNodes) {
                    yield* iterSelectedNodes(selection, child);
                }
            }
        }
    }

    try {
        const selection = getSelection();

        if (selection === null) return;

        const selectedNodes = new Set<Text | HTMLElement>();
        for (let i = 0; i < selection.rangeCount; i++) {
            const range = selection.getRangeAt(i);
            // TODO Support partial node selections?
            for (const node of iterSelectedNodes(selection, range.commonAncestorContainer)) {
                selectedNodes.add(node);
            }
        }

        const fragments = content.textFragments(Array.from(selectedNodes.values()));
        const text = fragments.map(x => x.text).join('');
        const tokens = await content.requestParse(text);
        content.applyParseResult(fragments, tokens, false);

        getSelection()?.empty();
    } catch (error) {
        console.error(error);
        alert(`Error: ${error.message}`); // TODO replace with proper toast?
    }
})();
