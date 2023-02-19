function* iterSelectedNodes(selection, node) {
    if (!selection.containsNode(node, true))
        return;

    if (node.nodeType === Node.TEXT_NODE) {
        // TODO Support partial node selections?
        yield node;
    }
    else if (node.nodeType == Node.ELEMENT_NODE) {
        if (node.tagName === 'RUBY') {
            yield node;
        }
        else {
            for (const child of node.childNodes) {
                yield* iterSelectedNodes(selection, child);
            }
        }
    }
}

(async () => {
    try {
        const selection = getSelection();
        const selectedNodes = new Set();
        for (let i = 0; i < selection.rangeCount; i++) {
            const range = selection.getRangeAt(i);
            // TODO Support partial node selections?
            for (const node of iterSelectedNodes(selection, range.commonAncestorContainer)) {
                selectedNodes.add(node);
            }
        }

        const fragments = textFragments(selectedNodes);
        const text = fragments.map(x => x.text).join('');
        const result = await postRequest({ command: 'parse', text });
        applyParseResult(fragments, result, false);

        getSelection().empty();
    } catch (e) {
        console.error(e);
        alert(`Error: ${e.message}`); // TODO replace with proper toast?
    }
})();
