// @reader content-script

import { requestParse } from '../content/background_comms.js';
import { applyParseResult, displayCategory, Fragment, Paragraph } from '../content/parse.js';
import { showError } from '../util.js';

function paragraphsInRange(range: Range): Paragraph[] {
    // TODO Support partial selections in start and end text nodes
    const start: Node =
        range.startContainer instanceof Text
            ? range.startContainer
            : range.startContainer.childNodes[range.startOffset];

    const end: Node =
        range.endContainer instanceof Text ? range.endContainer : range.endContainer.childNodes[range.endOffset - 1];

    // console.log('start:', start, 'end:', end);

    // Set up stack
    // Because ranges annoyingly give us start and end nodes which may be
    // at totally different levels of nesting inside the DOM, we need to
    // manually set up the stack as if we had recursed to the start node from its parent nodes.

    let current = start;
    const parents: Node[] = [];
    while (current.parentNode !== null) {
        current = current.parentNode;
        if (current instanceof Document) break;
        parents.unshift(current);
    }
    current = start;

    let hasRuby = false;
    let ignore = false;

    const stack: { node: Node; display: ReturnType<typeof displayCategory>; hasRuby: boolean; ignore: boolean }[] = [];

    for (const parent of parents) {
        const display = displayCategory(parent);
        // console.log('Start parent:', display, parent);
        if (display === 'ruby') {
            hasRuby = true;
        } else if (display === 'none' || display === 'ruby-text') {
            ignore = true;
        }

        stack.push({ node: parent, display, hasRuby, ignore });
    }

    let offset = 0;
    const fragments: Fragment[] = [];
    const paragraphs: Paragraph[] = [];

    function breakParagraph() {
        // Remove fragments from the end that are just whitespace
        // (the ones from the start have already been ignored)

        let end = fragments.length - 1;
        for (; end >= 0; end--) {
            if (fragments[end].node.data.trim().length > 0) break;
        }

        const trimmedFragments = fragments.slice(0, end + 1);

        if (trimmedFragments.length) {
            paragraphs.push(trimmedFragments);
        }

        fragments.splice(0);
        offset = 0;
    }

    while (true) {
        // console.log('current:', current, 'hasRuby:', hasRuby, 'ignore:', ignore);

        const display = displayCategory(current);

        if (display === 'text' && !ignore) {
            const text = current as Text;
            // console.log('Pushing as text');
            // Ignore empty text nodes, as well as whitespace at the beginning of the run
            if (text.data.length > 0 && !(fragments.length === 0 && text.data.trim().length === 0)) {
                fragments.push({
                    start: offset,
                    length: text.length,
                    end: (offset += text.length),
                    node: text,
                    hasRuby,
                });
            }
        } else if (display === 'ruby-text' || display === 'none') {
            ignore = true;
        } else if (display === 'ruby') {
            hasRuby = true;
        } else if (display === 'block' && !ignore) {
            breakParagraph();
        }

        if (current === end) break;

        if (current.firstChild !== null) {
            // console.log('Continuing with child');
            stack.push({ display, hasRuby, ignore, node: current });
            current = current.firstChild;
            continue;
        } else if (current.nextSibling !== null) {
            // console.log('Continuing with sibling');
            ignore = stack[stack.length - 1].ignore;
            hasRuby = stack[stack.length - 1].hasRuby;
            current = current.nextSibling;
            continue;
        } else {
            // We need to break the section/paragraph again on our way up
            let parent;
            do {
                parent = stack.pop();
                if (!parent) {
                    throw Error('Reached end of document while iterating nodes');
                }
                // console.log('Parent:', parent.node);

                if (parent.display === 'block' && !parent.ignore) {
                    breakParagraph();
                }
            } while (parent.node.nextSibling === null);

            // console.log('Continuing with parents sibling');
            current = parent.node.nextSibling;
            hasRuby = stack[stack.length - 1].hasRuby;
            ignore = stack[stack.length - 1].ignore;
            continue;
        }
    }

    breakParagraph();
    return paragraphs;
}

try {
    const selection = getSelection();
    if (selection === null) throw Error('No selection found');

    const paragraphs: Paragraph[] = [];
    for (let i = 0; i < selection.rangeCount; i++) {
        const range = selection.getRangeAt(i);
        paragraphs.push(...paragraphsInRange(range));
    }

    console.log(
        'Parsing',
        paragraphs.flat().map(fragment => fragment.node.data),
    );

    const tokens = await requestParse(paragraphs);
    applyParseResult(paragraphs, tokens);

    getSelection()?.empty();
} catch (error) {
    showError(error);
}
