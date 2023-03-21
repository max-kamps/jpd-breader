import { requestParse } from '../content/background_comms.js';
import { applyParseResult, displayCategory, Fragment, Paragraph } from '../content/parse.js';
import { showError } from '../util.js';

export function paragraphsInNode(node: Node, filter: (node: Node) => boolean = () => true): Paragraph[] {
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

    function pushText(text: Text, hasRuby: boolean) {
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
    }

    function recurse(node: Node, hasRuby: boolean) {
        const display = displayCategory(node);

        if (display === 'block') {
            breakParagraph();
        }

        if (display === 'none' || display === 'ruby-text' || filter(node) === false) return;

        if (display === 'text') {
            pushText(node as Text, hasRuby);
        } else {
            if (display === 'ruby') {
                hasRuby = true;
            }

            for (const child of node.childNodes) {
                recurse(child, hasRuby);
            }

            if (display === 'block') {
                breakParagraph();
            }
        }
    }

    // TODO check if any of the parents of node are ruby?
    recurse(node, false);
    return paragraphs;
}

// export function paragraphsInNode(node: Node, filter: (node: Node) => boolean = () => true): Paragraph[] {
//     // TODO Support partial selections in start and end text nodes

//     // console.log('start:', start, 'end:', end);

//     let hasRuby = false;

//     const stack: { node: Node; display: ReturnType<typeof displayCategory>; hasRuby: boolean }[] = [];

//     let offset = 0;
//     const fragments: Fragment[] = [];
//     const paragraphs: Paragraph[] = [];

//     function breakParagraph() {
//         // Remove fragments from the end that are just whitespace
//         // (the ones from the start have already been ignored)

//         let end = fragments.length - 1;
//         for (; end >= 0; end--) {
//             if (fragments[end].node.data.trim().length > 0) break;
//         }

//         const trimmedFragments = fragments.slice(0, end + 1);

//         if (trimmedFragments.length) {
//             paragraphs.push(trimmedFragments);
//         }

//         fragments.splice(0);
//         offset = 0;
//     }

//     outerLoop: while (true) {
//         // console.log('current:', current, 'hasRuby:', hasRuby);

//         const display = displayCategory(node);
//         stack.push({ display, hasRuby, node });

//         const ignore = display === 'none' || display === 'ruby-text' || filter(node) === false;

//         if (!ignore) {
//             if (display === 'text') {
//                 const text = node as Text;
//                 // console.log('Pushing as text');
//                 // Ignore empty text nodes, as well as whitespace at the beginning of the run
//                 if (text.data.length > 0 && !(fragments.length === 0 && text.data.trim().length === 0)) {
//                     fragments.push({
//                         start: offset,
//                         length: text.length,
//                         end: (offset += text.length),
//                         node: text,
//                         hasRuby,
//                     });
//                 }
//             } else if (display === 'ruby') {
//                 hasRuby = true;
//             } else if (display === 'block') {
//                 breakParagraph();
//             }
//         }

//         if (!ignore && node.firstChild !== null) {
//             // console.log('Continuing with child');
//             node = node.firstChild;
//         } else {
//             let parent;
//             do {
//                 parent = nonNull(stack.pop());
//                 // console.log('Parent:', parent.node);

//                 if (stack.length == 0) {
//                     break outerLoop;
//                 }

//                 // Break the paragraph because we are leaving the parent block element
//                 if (parent.display === 'block') {
//                     breakParagraph();
//                 }
//             } while (parent.node.nextSibling === null);

//             // console.log('Continuing with parents sibling');
//             node = parent.node.nextSibling;
//             hasRuby = parent.hasRuby;
//             break;
//         }
//     }

//     breakParagraph();
//     return paragraphs;
// }

export function visibleObserver(callback: (elements: HTMLElement[]) => void): IntersectionObserver {
    const visibleElements = new Set<HTMLElement>(); // queue of paragraphs waiting to be parsed

    let parsingInProgress = false;
    async function parseVisibleParagraphs() {
        // This function keeps running as long as there are visible paragraphs waiting to be parsed.

        if (parsingInProgress || visibleElements.size == 0)
            // Only run one instance of this function at a time
            return;

        parsingInProgress = true;

        while (visibleElements.size > 0) {
            const elements = [...visibleElements.values()]
                // HACK Get earliest (top-rightmost) paragraph.
                // This is necessary because the "add context" feature currently depends on the order things were parsed in.
                .sort((a, b) => a.offsetTop - b.offsetTop && b.offsetLeft - a.offsetLeft)
                // TODO Find a better way of picking multiple elements. Right now we always pick *up to 10*.
                // But that's suboptimal if the user slowly scrols one element at a time.
                // Ideally, we would choose as many elements fit into the jpdb parse character limit,
                // and get additional elements if the number of visible elements is below some limit.
                .slice(0, 10);

            for (const e of elements) {
                visibleElements.delete(e);
                elementVisibleObserver.unobserve(e);
            }

            try {
                callback(elements);
            } catch (error) {
                showError(error);
            }
        }

        parsingInProgress = false;
    }

    const elementVisibleObserver = new IntersectionObserver(
        (entries, _observer) => {
            try {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        // console.log('Entered view:', entry.target, entry.target.innerText);
                        visibleElements.add(entry.target as HTMLElement);
                    } else {
                        // console.log('Left view:', entry.target, entry.target.innerText);
                        visibleElements.delete(entry.target as HTMLElement);
                    }
                }
                parseVisibleParagraphs();
            } catch (error) {
                showError(error);
            }
        },
        {
            // rootMargin: '0px -120px 0px -120px', // debugging purposes, remove this
            rootMargin: '100% 100% 100% 100%',
        },
    );

    // document.body.insertAdjacentHTML(
    //     'beforeend',
    //     `<div style="position:fixed;top:0;right:120px;bottom:0;left:120px;box-shadow:inset 0 0 8px #f00;pointer-events:none;"></div>`,
    // );
    //
    return elementVisibleObserver;
}

export function addedObserver(selector: string, callback: (elements: HTMLElement[]) => void): MutationObserver {
    const newParagraphObserver = new MutationObserver((mutations, _observer) => {
        for (const mutation of mutations) {
            if (mutation.type !== 'childList') continue;

            const filteredNodes: HTMLElement[] = [];

            for (const node of mutation.addedNodes) {
                // TODO support non-elements (like text nodes)
                if (node instanceof HTMLElement) {
                    if (node.matches(selector)) {
                        filteredNodes.push(node);
                    }

                    // TODO support non-html elements
                    filteredNodes.push(...(node.querySelectorAll(selector) as Iterable<HTMLElement>));
                }
            }

            if (filteredNodes.length) callback(filteredNodes);
        }
    });

    return newParagraphObserver;
}

export async function parseNodes(nodes: Node[], filter: (node: Node) => boolean = () => true) {
    try {
        const paragraphs = nodes.flatMap(node => paragraphsInNode(node, filter));

        if (paragraphs.length > 0) {
            console.log(
                'Parsing',
                paragraphs.flat().map(fragment => fragment.node.data),
            );

            const tokens = await requestParse(paragraphs);
            applyParseResult(paragraphs, tokens);
        }
    } catch (error) {
        showError(error);
    }
}
