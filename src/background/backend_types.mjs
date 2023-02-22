
/**
 * @typedef {object} Token
 * @property {number} vocabularyIndex
 * @property {number} positionUtf16
 * @property {number} lengthUtf16
 * @property {(string|[string, string])[]} furigana
 */

// TODO get rid of undefined on 'rid' when scrape parsing gets removed eventually
/**
 * @typedef {object} Vocab
 * @property {number} vid
 * @property {number} sid
 * @property {number|undefined} rid
 * @property {string} spelling
 * @property {string} reading
 * @property {[string, ...string[]]} meanings
 * @property {[string, ...string[]]} cardState
 */

/**
 * @template [T=null]
 * @typedef {Promise<[T, number]>} Response
 */
