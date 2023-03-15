// @reader content-script

import { showError } from '../util.js';
import { applyParseResult, requestParse, textFragments } from '../content/content.js';

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
    if (selection === null) throw Error('No selection found');

    const selectedNodes = new Set<Text | HTMLElement>();
    for (let i = 0; i < selection.rangeCount; i++) {
        const range = selection.getRangeAt(i);
        // TODO Support partial node selections?
        for (const node of iterSelectedNodes(selection, range.commonAncestorContainer)) {
            selectedNodes.add(node);
        }
    }

    const fragments = textFragments(Array.from(selectedNodes.values()));
    const text = fragments.map(x => x.text).join('');
    const tokens = await requestParse(text);
    applyParseResult(fragments, tokens, false);

    getSelection()?.empty();
} catch (error) {
    showError(error);
}
