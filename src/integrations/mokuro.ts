// @reader content-script

import { createParseBatch, ParseBatch, requestParse } from '../content/background_comms.js';
import { applyTokens, Fragment } from '../content/parse.js';
import { CANCELED, showError } from '../util.js';
import { visibleObserver } from './common.js';

try {
    const pendingBatches = new Map<HTMLElement, ParseBatch>();

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

                const batch = createParseBatch(paragraphs);
                const applied = batch.entries.map(({ paragraph, promise }) =>
                    promise
                        .then(tokens => {
                            applyTokens(paragraph, tokens);
                        })
                        .catch(error => {
                            if (error !== CANCELED) {
                                showError(error);
                            }
                            throw error;
                        }),
                );

                Promise.all(applied)
                    .then(_ => visible.unobserve(page))
                    .finally(() => {
                        pendingBatches.delete(page);
                        page.style.backgroundColor = '';
                    });

                pendingBatches.set(page, batch);
                batches.push(batch);
                page.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
            }
            requestParse(batches);
        },
        elements => {
            for (const element of elements) {
                const batch = pendingBatches.get(element);
                if (batch) {
                    for (const { promise } of batch.entries) {
                        promise.cancel();
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
