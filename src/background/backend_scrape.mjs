/** @template [T=null] @typedef {import('backend_types.mjs').Response<T>} Response */
/** @typedef {import('backend_types.mjs').Token} Token */
/** @typedef {import('backend_types.mjs').Vocab} Vocab */

import { assert } from '../util.mjs';


const RATELIMIT = 1.1; // seconds between requests


/**
 * @param {string} text 
 * @returns {Response<{tokens: Token[], vocab: Vocab[]}>}
 */
export async function parse(text) {
    let response = await fetch(
        `https://jpdb.io/search?q=<…>${text.replaceAll('\n', '<\\>')}<…>`,
        { credentials: 'include' }
    );

    const doc = new DOMParser().parseFromString(await response.text(), 'text/html'),
        parseResult = doc.querySelector('.floating-sentence');

    const tokens = [];
    const vocab = [];

    if (parseResult === null) {
        const errorReason = doc.querySelector('.container')?.childNodes[1]?.textContent?.trim();
        console.error(`Couldn't parse ${text}, reason: ${errorReason}`);
        if (errorReason === 'No results found.') {
            // The sentence didn't contain any words jpdb understood
            return [{ tokens: [], vocab: [] }, RATELIMIT];
        }
        else {
            // Some other jpdb error ocurred
            throw Error(errorReason);
        }
    }
    else {
        let offset = -3; // adjust for <…>

        for (const token of parseResult.children) {
            assert(token instanceof HTMLElement, 'Unexpected non-html element in parse result');
            const a = token.querySelector('a');
            if (a === null) {
                // Not parsed, skip forward
                offset += token.innerText.replaceAll('<\\>', '\n').length;
            }
            else {
                const startOffset = offset;

                /** @type {(string|[string, string])[]} */
                const furigana = [];

                for (const childNode of a.childNodes) {
                    if (childNode.nodeType === Node.TEXT_NODE) {
                        const text = /** @type {Text} */ (childNode).data;
                        furigana.push(text);
                        offset += text.length;
                    }
                    else if (childNode.nodeType === Node.ELEMENT_NODE) {
                        const base = childNode.childNodes[0]?.textContent;
                        const furi = childNode.childNodes[1]?.textContent;
                        assert(!!base, 'Unexpected empty furigana base');
                        assert(!!furi, 'Unexpected empty furigana');
                        furigana.push([base, furi]);
                        offset += base.length;
                    }
                }

                const wordElemId = a.getAttribute('href');
                assert(wordElemId !== null, 'Token has no href');

                const wordData = doc.querySelector(wordElemId);
                assert(wordData !== null, 'Word data element not found');

                const vid = parseInt(/** @type {HTMLInputElement|null} */(wordData.querySelector('input[type="hidden"][name="v"]'))?.value ?? 'NaN');
                const sid = parseInt(/** @type {HTMLInputElement|null} */(wordData.querySelector('input[type="hidden"][name="s"]'))?.value ?? 'NaN');
                assert(!isNaN(vid) && !isNaN(sid), 'Invalid word ID');

                let spelling = '';
                let reading = '';
                const spellingRuby = wordData.querySelector('ruby.v');
                assert(spellingRuby !== null, 'Spelling element not found');

                for (let i = 0; i < spellingRuby.childNodes.length; i += 2) {
                    spelling += spellingRuby.childNodes[i].textContent;
                    reading += spellingRuby.childNodes[i + 1].textContent || spellingRuby.childNodes[i].textContent;
                }

                const meanings = [...wordData.querySelectorAll('.subsection-meanings .description')]
                    .map(x => {
                        const text = x.textContent;
                        assert(text !== null, "Empty meaning");
                        return text.replace(/^\d+\. /, '').trim()
                    });

                assert(meanings.length >= 1, 'Word has no meanings');

                const tags = wordData.querySelector('.tags');
                // TODO parse tags.children[0].innerText to get the level/redundancy of the card
                const state = tags && tags.children.length >= 2 ? [...tags.children[0].classList].slice(1) : ['not-in-deck'];
                assert(state.length >= 1, 'Card has no state');

                tokens.push({
                    vocabularyIndex: vocab.length,
                    positionUtf16: startOffset,
                    lengthUtf16: offset - startOffset,
                    furigana,
                });

                vocab.push({
                    vid, sid, rid: undefined,
                    spelling, reading,
                    meanings: /** @type {[string, ...string[]]} */ (meanings),
                    cardState: /** @type {[string, ...string[]]} */ (state),

                    // html: wordData.innerHTML,
                });
            }
        }
    }

    return [{ tokens, vocab }, RATELIMIT];
}


/**
 * @param {number} vid
 * @param {number} sid
 * @param {'nothing'|'something'|'hard'|'good'|'easy'|'pass'|'fail'} rating
 * @returns {Response}
 */
export async function review(vid, sid, rating) {

}


/**
 * @param {number} vid 
 * @param {number} sid 
 * @returns {Response}
 */
export async function addToForq(vid, sid) {

}
