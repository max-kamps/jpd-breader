// @reader content-script

import { ParseBatch, requestParse } from '../content/background_comms.js';
import { Fragment } from '../content/parse.js';
import { showError } from '../content/toast.js';
import { parseParagraphs, visibleObserver } from './common.js';

try {
    const pendingBatches = new Map<HTMLElement, ParseBatch[]>();

    const visible = visibleObserver(
        elements => {
            const batches: ParseBatch[] = [];
            for (const page of elements) {
                if (pendingBatches.get(page) !== undefined) continue;

                // Manually create fragments, since mokuro puts every line in a separate <p>aragraph
                const paragraphs = [...page.querySelectorAll('.textBox')].map(box => {
                    const fragments: Fragment[] = [];
                    let offset = 0;
                    for (const p of box.children) {
                        if (p.tagName !== 'P') continue;
                        const text = p.firstChild as Text;
                        text.data = text.data
                            .replaceAll('．．．', '…')
                            .replaceAll('．．', '…')
                            .replaceAll('！！', '‼')
                            .replaceAll('！？', '“⁉');

                        const start = offset;
                        const length = text.length;
                        const end = (offset += length);

                        fragments.push({ node: text, start, end, length, hasRuby: false });
                    }
                    return fragments;
                });

                if (paragraphs.length === 0) {
                    visible.unobserve(page);
                    continue;
                }

                const [pageBatches, applied] = parseParagraphs(paragraphs);

                Promise.all(applied)
                    .then(_ => visible.unobserve(page))
                    .finally(() => {
                        pendingBatches.delete(page);
                        page.style.backgroundColor = '';
                    });

                pendingBatches.set(page, pageBatches);
                batches.push(...pageBatches);
                page.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
            }
            requestParse(batches);
        },
        elements => {
            for (const element of elements) {
                const batches = pendingBatches.get(element);
                if (batches) {
                    for (const { abort } of batches) {
                        abort.abort();
                    }
                    element.style.backgroundColor = 'rgba(0, 255, 0, 0.3)';
                }
            }
        },
    );

    for (const page of document.querySelectorAll('#pagesContainer > div')) {
        visible.observe(page);
    }
} catch (error) {
    showError(error);
}
