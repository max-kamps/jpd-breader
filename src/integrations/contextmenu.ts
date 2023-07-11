// @reader content-script

import { requestParse } from '../content/background_comms.js';
import { displayCategory, Fragment, Paragraph } from '../content/parse.js';
import { showError } from '../content/toast.js';
import { parseParagraphs } from './common.js';

// Abandon hope all ye who enter here. This function has taken the life of many a coder.
// If there is a(nother) bug in this, consider contacting the author directly ~hmry
function paragraphsInRange(range: Range): Paragraph[] {
    // This function may appear overly complex at first glance. However, do not be deceived. It is complex for good reason.
    // You might think selections are given as a range with start and end nodes. This is not quite true.
    // The start and end points are given as *boundaries between nodes*.
    // The start point might be after all the children of a node, but before the end tag of that node.
    // The end point might be after the start tag of a node, but before all of its children.
    // This is a nightmare to deal with. (If you already know a good way to tackle this sort of problem, you may consider simplifying this code.
    // Otherwise, I would suggest not wasting your time.)

    // The way I chose to deal with this is transforming the start and end points, so that they refer to *inclusive* start and end leaf nodes.
    // That is, startNode is the first leaf node in the selection, and endNode is the last leaf node in the selection.

    let startNode: Node;
    if (range.startContainer instanceof CharacterData) {
        // Selection starts inside character data, at offset startOffset.
        // We just ignore the offset and process the entire character data node
        // TODO Support partial text selections
        startNode = range.startContainer;
    } else if (range.startOffset >= range.startContainer.childNodes.length) {
        // Selection starts inside the node... after all its children.
        // This is a nightmare to deal with, so we instead find the first node that is actually part of the selection
        // That is, the next node in document order - next sibling, or next sibling of parent, or next sibling of parent of parent, etc
        startNode = range.startContainer;
        while (startNode.nextSibling === null) {
            if (startNode.parentNode === null)
                throw new Error('Selection started at end of node, but there was no next node');

            startNode = startNode.parentNode;
        }
        startNode = startNode.nextSibling;
    } else {
        // Selection starts inside the startContainer, at the startOffset'th child
        // Use that child as our start node
        startNode = range.startContainer.childNodes[range.startOffset];
    }

    let endNode: Node;
    if (range.endContainer instanceof CharacterData) {
        // Selection ends inside character data, at offset startOffset.
        // We just ignore the offset and process the entire character data node
        // TODO Support partial text selections
        endNode = range.endContainer;
    } else if (range.endOffset === 0) {
        // Selection ends inside the node... before all its children.
        // This is a nightmare to deal with, so we instead find the last node that is actually part of the selection
        // That is, the previous leaf node in document order - the previous sibling, or the parent node's previous sibling, or the parent node's parent node's previous sibling, etc.
        endNode = range.endContainer;
        while (endNode.previousSibling === null) {
            if (endNode.parentNode === null)
                throw new Error('Selection ended at start of node, but there was no previous node');

            endNode = endNode.parentNode;
        }
        endNode = endNode.previousSibling;
    } else {
        // Selection ends inside the endContainer, at the endOffset'th child
        // Use the previous child (the last child that is still inside the selection) as our end node
        endNode = range.endContainer.childNodes[range.endOffset - 1];
    }

    console.log('start:', startNode, 'end:', endNode);

    // Set up recursion stack
    // We need information from further up the tree (such as furigana, or whether we should ignore some nodes because they are invisible)
    // So first we walk up the tree collecting all parent nodes, and then walk down again recording this information

    let current = startNode;

    const parents: Node[] = [];
    while (current.parentNode !== null) {
        current = current.parentNode;
        if (current.parentNode === null) break;
        parents.unshift(current);
    }

    console.log('parents:', parents);

    current = startNode;

    const stack: { node: Node; display: ReturnType<typeof displayCategory>; rubyTexts: string[]; ignore: boolean }[] =
        [];

    let rubyTexts: string[] = [];
    let ignore = false;

    for (const parent of parents) {
        const display = displayCategory(parent);
        console.log('Start parent:', display, parent);

        if (display === 'none' || display === 'ruby-text') {
            ignore = true;
        } else if (display === 'ruby') {
            rubyTexts = ['TODO parse ruby'];
        }

        stack.push({ node: parent, display, rubyTexts, ignore });
    }

    let offset = 0; // number of UTF-16 codepoints since the start of the current paragraph
    const fragments: Fragment[] = []; // Fragments that are part of the current paragraphs
    const paragraphs: Paragraph[] = []; // All paragraphs found so far

    function breakParagraph() {
        // Remove fragments from the end that only contain whitespace.
        // (The ones at the start have already been ignored)
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

    outerLoop: while (true) {
        const display = displayCategory(current);

        console.log('current:', current, 'display:', display, 'rubyTexts:', rubyTexts, 'ignore:', ignore);

        if (display === 'none' || display === 'ruby-text') {
            ignore = true;
        } else if (display === 'ruby') {
            rubyTexts = ['TODO parse ruby'];
        }

        if (!ignore) {
            if (display === 'text') {
                const text = current as Text;

                // Ignore empty text nodes, as well as whitespace at the beginning of the run
                if (text.data.length > 0 && !(fragments.length === 0 && text.data.trim().length === 0)) {
                    console.log('Pushing as text');
                    fragments.push({
                        start: offset,
                        length: text.length,
                        end: (offset += text.length),
                        node: text,
                        hasRuby: rubyTexts.length !== 0,
                    });
                } else {
                    console.log('Ignoring leading whitespace');
                }
            } else if (display === 'block') {
                breakParagraph();
            }
        }

        if (current === endNode) break;

        if (current.firstChild !== null) {
            console.log('Continuing with child');
            stack.push({ display, rubyTexts, ignore, node: current });
            current = current.firstChild;
            continue;
        } else if (current.nextSibling !== null) {
            console.log('Continuing with sibling');
            ignore = stack[stack.length - 1].ignore;
            rubyTexts = stack[stack.length - 1].rubyTexts;
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

                if (parent.node === endNode) {
                    break outerLoop;
                }

                if (parent.display === 'block' && !parent.ignore) {
                    breakParagraph();
                }
            } while (parent.node.nextSibling === null);

            // console.log('Continuing with parents sibling');
            current = parent.node.nextSibling;
            rubyTexts = stack[stack.length - 1].rubyTexts;
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

    if (paragraphs.length > 0) {
        const [batches, applied] = parseParagraphs(paragraphs);

        requestParse(batches);
        await Promise.allSettled(applied);
    }

    getSelection()?.empty();
} catch (error) {
    showError(error);
}
