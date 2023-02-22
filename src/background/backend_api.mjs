import { snakeToCamel } from "../util.mjs";
import { config } from "./background.mjs";
/** @template [T=null] @typedef {import('backend_types.mjs').Response<T>} Response */
/** @typedef {import('backend_types.mjs').Token} Token */
/** @typedef {import('backend_types.mjs').Vocab} Vocab */


const RATELIMIT = 0.2; // seconds between requests


const TOKEN_FIELDS = ['vocabulary_index', 'position_utf16', 'length_utf16', 'furigana'];
const VOCABULARY_FIELDS = ['vid', 'sid', 'rid', 'spelling', 'reading', 'meanings', 'card_state'];
const TOKEN_FIELD_NAMES = TOKEN_FIELDS.map(x => snakeToCamel(x));
const VOCABULARY_FIELD_NAMES = VOCABULARY_FIELDS.map(x => snakeToCamel(x));


/**
 * @param {string} text 
 * @returns {Response<{tokens: Token[], vocab: Vocab[]}>}
 */
export async function parse(text) {
    console.log(config);
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiToken}`,
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            text,
            token_fields: TOKEN_FIELDS,
            vocabulary_fields: VOCABULARY_FIELDS,
        })
    };

    const response = await fetch('https://jpdb.io/api/v1/parse', options),
        data = await response.json();

    if (!(200 <= response.status && response.status <= 299)) {
        throw Error(data.error_message);
    }

    // Turn the field arrays into objects
    const tokens = data.tokens.map(fields => Object.fromEntries(fields.map((value, i) => [TOKEN_FIELD_NAMES[i], value])));
    const vocab = data.vocabulary.map(fields => Object.fromEntries(fields.map((value, i) => [VOCABULARY_FIELD_NAMES[i], value])));

    // Normalize token furigana
    for (const token of tokens) {
        // If the token does not have any furigana, just use the vocabulary spelling
        if (token.furigana === null) {
            token.furigana = [vocab[token.vocabularyIndex].spelling];
            continue;
        }

        // Merge adjacent parts without furigana into a single string
        const joinedFurigana = [];
        let seq;
        for (const part of token.furigana) {
            if (typeof part === 'string') {
                seq = (seq === undefined) ? part : seq + part;
            }
            else {
                if (seq !== undefined)
                    joinedFurigana.push(seq);

                joinedFurigana.push(part);
            }
        }
        if (seq !== undefined)
            joinedFurigana.push(seq);
    }

    for (const word of vocab) {
        if (word.cardState === null)
            word.cardState = ['not-in-deck'];
    }

    // TODO figure out if caching this is even useful
    // const txn = db.transaction('paragraphs', 'readwrite');
    // txn.objectStore('paragraphs').put({ text, tokens });
    // txn.objectStore('words').put({});
    // txn.commit();

    return [{ tokens, vocab }, RATELIMIT];
}


/**
 * @param {number} vid 
 * @param {number} sid 
 * @param {number|'blacklist'|'never-forget'} deckId 
 * @returns {Response}
 */
export async function addToDeck(vid, sid, deckId) {
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiToken}`,
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            id: deckId,
            vocabulary: [[vid, sid]],
        })
    };

    const response = await fetch('https://jpdb.io/api/v1/deck/add-vocabulary', options),
        data = await response.json();

    if (!(200 <= response.status && response.status <= 299)) {
        throw Error(data.error_message);
    }

    return [null, RATELIMIT];
}


/**
 * @param {number} vid 
 * @param {number} sid 
 * @param {string|undefined} sentence 
 * @param {string|undefined} translation 
 * @returns {Response}
 */
export async function setSentence(vid, sid, sentence, translation) {
    const body = {
        vid, sid,
    };

    if (sentence)
        body.sentence = sentence;
    
    if (translation)
        body.translation = translation;

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiToken}`,
            'Accept': 'application/json',
        },
        body: JSON.stringify(body)
    };

    const response = await fetch('https://jpdb.io/api/v1/set-card-sentence', options),
        data = await response.json();

    if (!(200 <= response.status && response.status <= 299)) {
        throw Error(data.error_message);
    }

    return [null, RATELIMIT];
}
