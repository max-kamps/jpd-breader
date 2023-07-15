import { createParseBatch, ParseBatch, requestParse } from '../content/background_comms.js';
import { applyTokens, displayCategory, Fragment, Paragraph } from '../content/parse.js';
import { showError } from '../content/toast.js';
import { Canceled } from '../util.js';

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

export function visibleObserver(
    enterCallback: (elements: HTMLElement[]) => void,
    exitCallback: (elements: HTMLElement[]) => void,
): IntersectionObserver {
    const elementVisibleObserver = new IntersectionObserver(
        (entries, _observer) => {
            try {
                const exited = entries.filter(entry => !entry.isIntersecting).map(entry => entry.target as HTMLElement);
                if (exited.length !== 0) exitCallback(exited);

                const entered = entries.filter(entry => entry.isIntersecting).map(entry => entry.target as HTMLElement);
                if (entered.length !== 0) enterCallback(entered);
            } catch (error) {
                showError(error);
            }
        },
        {
            rootMargin: '50% 50% 50% 50%',
        },
    );

    return elementVisibleObserver;
}

export function addedObserver(selector: string, callback: (elements: HTMLElement[]) => void): MutationObserver {
    const existingElements = document.querySelectorAll(selector);
    if (existingElements.length > 0) {
        callback([...existingElements] as HTMLElement[]);
    }

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

export function parseVisibleObserver(filter: (node: Node) => boolean = () => true) {
    const pendingBatches = new Map<HTMLElement, ParseBatch[]>();

    const visible = visibleObserver(
        elements => {
            const batches: ParseBatch[] = [];
            for (const element of elements) {
                if (pendingBatches.get(element) !== undefined) continue;

                const paragraphs = paragraphsInNode(element, filter);
                if (paragraphs.length === 0) {
                    visible.unobserve(element);
                    continue;
                }

                const [elemBatches, applied] = parseParagraphs(paragraphs);

                Promise.all(applied)
                    .then(_ => visible.unobserve(element))
                    .finally(() => {
                        pendingBatches.delete(element);
                    });

                pendingBatches.set(element, elemBatches);
                batches.push(...elemBatches);
            }
            requestParse(batches);
        },
        elements => {
            for (const element of elements) {
                const batches = pendingBatches.get(element);
                if (batches) {
                    for (const { abort } of batches) abort.abort();
                }
            }
        },
    );

    return visible;
}

export function parseParagraphs(paragraphs: Paragraph[]): [ParseBatch[], Promise<void>[]] {
    const batches = paragraphs.map(createParseBatch);
    const applied = batches.map(({ paragraph, promise }) =>
        promise
            .then(tokens => {
                applyTokens(paragraph, tokens);
            })
            .catch(error => {
                if (!(error instanceof Canceled)) {
                    showError(error);
                }
                throw error;
            }),
    );

    return [batches, applied];
}
