import * as api from "./backend_api.mjs";
import * as scrape from "./backend_scrape.mjs";
import { sleep } from "../util.mjs";
import { config } from "./background.mjs";
/** @template [T=null] @typedef {import('backend_types.mjs').Response<T>} Response */
/** @typedef {import('backend_types.mjs').Token} Token */
/** @typedef {import('backend_types.mjs').Vocab} Vocab */


/**
 * @typedef {object} ParseCall
 * @property {'parse'} command
 * @property {string} text
 */

/**
 * @typedef {object} AddToDeckCall
 * @property {'addToDeck'} command
 * @property {number} vid
 * @property {number} sid
 * @property {number|'blacklist'|'forq'|'never-forget'} deckId
 */

/**
 * @typedef {object} SetSentenceCall
 * @property {'setSentence'} command
 * @property {number} vid 
 * @property {number} sid 
 * @property {string|undefined} sentence 
 * @property {string|undefined} translation 
 */

/**
 * @typedef {object} ReviewCall
 * @property {'review'} command
 * @property {number} vid
 * @property {number} sid
 * @property {'nothing'|'something'|'hard'|'good'|'easy'|'pass'|'fail'} rating
 */

/**
 * @typedef {ParseCall|AddToDeckCall|SetSentenceCall|ReviewCall} Call_
 */

/**
 * @typedef {{func: () => Promise<[any, number]>, resolve: (value: any) => void, reject: (reason: any) => void}} Call
 */

/** @type {Call[]} */
const pendingAPICalls = [];
let callerRunning = false;

async function apiCaller() {
    // If no API calls are pending, stop running
    if (callerRunning || pendingAPICalls.length === 0)
        // Only run one instance of this function at a time
        return;

    callerRunning = true;

    while (pendingAPICalls.length > 0) {
        // Get first call from queue

        const call = /** @type Call */ (pendingAPICalls.shift());
        console.log('Servicing API call:', call);

        try {
            const [result, wait] = await call.func();
            call.resolve(result);
            await sleep(wait);
        }
        catch (error) {
            call.reject(error);
            // TODO implement exponential backoff
            await sleep(1500);
        }
    }

    callerRunning = false;
}

/**
 * @param {() => Promise<any>} func 
 * @returns 
 */
function enqueue(func) {
    return new Promise((resolve, reject) => {
        console.log('Enqueueing API call:', func)
        pendingAPICalls.push({ func, resolve, reject });
        apiCaller();
    });
}


/**
 * @param {string} text 
 * @returns {Response<{tokens: Token[], vocab: Vocab[]}>}
 */
export function parse(text) {
    return enqueue(async () =>
        await (config.useScraping ? scrape : api).parse(text));
}

/**
 * @param {number} vid 
 * @param {number} sid 
 * @param {number|'blacklist'|'never-forget'|'forq'} deckId 
 * @returns {Response}
 */
export function addToDeck(vid, sid, deckId) {
    return enqueue(async () =>
        await (deckId === 'forq' ? scrape.addToForq(vid, sid) : api.addToDeck(vid, sid, deckId)));
}

/**
 * @param {number} vid 
 * @param {number} sid 
 * @param {string|undefined} sentence 
 * @param {string|undefined} translation 
 * @returns {Response}
 */
export function setSentence(vid, sid, sentence, translation) {
    return enqueue(async () =>
        await api.setSentence(vid, sid, sentence, translation));
}

/**
 * @param {number} vid
 * @param {number} sid
 * @param {'nothing'|'something'|'hard'|'good'|'easy'|'pass'|'fail'} rating
 * @returns {Response}
 */
export function review(vid, sid, rating) {
    return enqueue(async () =>
        await scrape.review(vid, sid, rating));
}
