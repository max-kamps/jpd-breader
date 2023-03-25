import { Token } from '../types.js';
import { jsxCreateElement, nonNull } from '../util.js';
import { onWordHoverStart, onWordHoverStop } from './content.js';
import { JpdbWord } from './types.js';

export type Fragment = {
    start: number;
    end: number;
    length: number;
    node: Text;
    hasRuby: boolean;
};

/**
 * A Paragraph is a collection of fragments that are semantically connected.
 * Every sequence of inline elements not interrupted by a block element
 * in the source html corresponds to their own Paragraph.
 */
export type Paragraph = Fragment[];

export function displayCategory(element: Node): 'text' | 'ruby' | 'ruby-text' | 'inline' | 'block' | 'none' {
    if (element instanceof Text) {
        return 'text';
    } else if (element instanceof Element) {
        const display = getComputedStyle(element).display.split(/\s/g);
        if (display[0] === 'none') return 'none';

        // NOTE Workaround for Chrome not supporting multi-value display and display: ruby
        if (element.tagName === 'RUBY') return 'ruby';
        if (element.tagName === 'RP') return 'none';
        if (element.tagName === 'RT') return 'ruby-text';
        if (element.tagName === 'RB') return 'inline';

        // Not sure how `inline list-item` or `list-item inline` should behave
        // These are roughly ordered by the frequency I expect them to show up
        if (display.some(x => x.startsWith('block'))) return 'block';
        if (display.some(x => x.startsWith('inline'))) return 'inline';

        if (display[0] === 'flex') return 'block';
        if (display[0] === 'grid') return 'block';
        if (display[0].startsWith('table')) return 'block';
        if (display[0].startsWith('flow')) return 'block';
        if (display[0] === 'ruby') return 'ruby';
        if (display[0].startsWith('ruby-text')) return 'ruby-text';
        if (display[0].startsWith('ruby-base')) return 'inline';
        if (display[0].startsWith('math')) return 'inline';
        if (display.includes('list-item')) return 'block';

        // Questionable
        if (display[0] === 'contents') return 'inline';
        if (display[0] === 'run-in') return 'block';

        throw new Error(`Unknown display value ${display.join(' ')}`);
    } else {
        return 'none';
    }
}

function splitFragment(fragments: Fragment[], fragmentIndex: number, splitOffset: number) {
    const oldFragment = fragments[fragmentIndex];
    // console.log('Splitting fragment', oldFragment);

    const newNode = oldFragment.node.splitText(splitOffset - oldFragment.start);

    // Insert new fragment
    const newFragment: Fragment = {
        start: splitOffset,
        end: oldFragment.end,
        length: oldFragment.end - splitOffset,
        node: newNode,
        hasRuby: oldFragment.hasRuby,
    };
    fragments.splice(fragmentIndex + 1, 0, newFragment);

    // Change endpoint of existing fragment accordingly
    oldFragment.end = splitOffset;
    oldFragment.length = splitOffset - oldFragment.start;
}

function insertBefore(newNode: Node, referenceNode: Node) {
    nonNull(referenceNode.parentElement).insertBefore(newNode, referenceNode);
}

function insertAfter(newNode: Node, referenceNode: Node) {
    const parent = nonNull(referenceNode.parentElement);
    const sibling = referenceNode.nextSibling;
    if (sibling) {
        parent.insertBefore(newNode, sibling);
    } else {
        parent.appendChild(newNode);
    }
}

function wrap(node: Node, wrapper: HTMLElement) {
    insertBefore(wrapper, node);
    wrapper.append(node);
}

export const reverseIndex = new Map<string, { className: string; elements: JpdbWord[] }>();
export function applyTokens(fragments: Paragraph, tokens: Token[]) {
    // console.log('Applying results:', fragments, tokens);

    let fragmentIndex = 0;
    let curOffset = 0;
    let fragment = fragments[fragmentIndex];

    for (const token of tokens) {
        if (!fragment) return;
        // console.log('at', curOffset, 'fragment', fragment, 'token', token);

        // Wrap all unparsed fragments that appear before the token
        while (curOffset < token.start) {
            if (fragment.end > token.start) {
                // Only the beginning of the node is unparsed. Split it.
                splitFragment(fragments, fragmentIndex, token.start);
            }

            // console.log('Unparsed original:', fragment.node.data);
            wrap(fragment.node, <span class='jpdb-word unparsed'></span>);

            curOffset += fragment.length;

            fragment = fragments[++fragmentIndex];
            if (!fragment) return;
        }

        // Accumulate fragments until we have enough to fit the current token
        while (curOffset < token.end) {
            if (fragment.end > token.end) {
                // Only the beginning of the node is part of the token. Split it.
                splitFragment(fragments, fragmentIndex, token.end);
            }

            // console.log('Part of token:', fragment.node.data);
            const className = `jpdb-word ${token.card.state.join(' ')}`;
            const wrapper = (
                token.rubies && !fragment.hasRuby ? (
                    <ruby class={className} onmouseenter={onWordHoverStart} onmouseleave={onWordHoverStop}></ruby>
                ) : (
                    <span class={className} onmouseenter={onWordHoverStart} onmouseleave={onWordHoverStop}></span>
                )
            ) as JpdbWord;

            const idx = reverseIndex.get(`${token.card.vid}/${token.card.sid}`);
            if (idx === undefined) {
                reverseIndex.set(`${token.card.vid}/${token.card.sid}`, { className, elements: [wrapper] });
            } else {
                idx.elements.push(wrapper);
            }

            wrapper.jpdbData = {
                token,
                context: 'TODO',
                contextOffset: curOffset,
            };

            wrap(fragment.node, wrapper);

            if (!fragment.hasRuby) {
                for (const ruby of token.rubies) {
                    if (ruby.start >= fragment.start && ruby.end <= fragment.end) {
                        // Ruby is contained in fragment
                        if (ruby.start > fragment.start) {
                            splitFragment(fragments, fragmentIndex, ruby.start);
                            insertAfter(<rt></rt>, fragment.node);
                            fragment = fragment = fragments[++fragmentIndex];
                        }

                        if (ruby.end < fragment.end) {
                            splitFragment(fragments, fragmentIndex, ruby.end);
                            insertAfter(<rt class='jpdb-furi'>{ruby.text}</rt>, fragment.node);
                            fragment = fragment = fragments[++fragmentIndex];
                        } else {
                            insertAfter(<rt class='jpdb-furi'>{ruby.text}</rt>, fragment.node);
                        }
                    }
                }
            }

            curOffset = fragment.end;

            fragment = fragments[++fragmentIndex];
            if (!fragment) break;
        }
    }

    // Wrap any left-over fragments in unparsed wrappers
    for (const fragment of fragments.slice(fragmentIndex)) {
        // console.log('Unparsed original:', fragment.node.data);
        wrap(fragment.node, <span class='jpdb-word unparsed'></span>);
    }
}
