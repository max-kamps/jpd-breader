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
        browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('Got message', message);

            switch (message.command) {
                case 'setConfig': {
                    config = message.config;
                    return false;
                }

                default:
                    return false;
            }
        });

        config = await browser.runtime.sendMessage({ command: 'registerTab' });

        const selection = getSelection();
        const selectedNodes = [];
        for (let i = 0; i < selection.rangeCount; i++) {
            const range = selection.getRangeAt(i);
            // TODO Support partial node selections?
            selectedNodes.push(...iterSelectedNodes(selection, range.commonAncestorContainer));
        }

        const fragments = textFragments(selectedNodes);
        const text = fragments.map(x => x.text).join('');

        const result = await browser.runtime.sendMessage({
            command: 'parse',
            text,
        });

        applyParseResult(fragments, result, false);

        getSelection().empty();
    } catch (e) {
        console.error(e);
        alert(`Error: ${e.message}`); // TODO replace with proper toast?
    }
})();
