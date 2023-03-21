// @reader content-script

import { requestParse } from '../content/background_comms.js';
import { applyParseResult, Fragment } from '../content/parse.js';
import { showError } from '../util.js';
import { visibleObserver } from './common.js';

try {
    const visible = visibleObserver(async elements => {
        for (const page of elements) {
            try {
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
    });

    for (const page of document.querySelectorAll('#pagesContainer > div')) {
        visible.observe(page);
    }
} catch (error) {
    showError(error);
}
