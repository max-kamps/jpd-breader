import { assertNonNull, sleep, truncate } from '../util.js';
import { config } from './background.js';
import { Card, Token } from '../types.js';

const API_RATELIMIT = 0.2; // seconds between requests
const SCRAPE_RATELIMIT = 1.1; // seconds between requests

export type Response<T = null> = Promise<[T, number]>;

export type Call = {
    func: () => Response<any>;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
};

const pendingAPICalls: Call[] = [];
let callerRunning = false;

async function apiCaller() {
    // If no API calls are pending, stop running
    if (callerRunning || pendingAPICalls.length === 0)
        // Only run one instance of this function at a time
        return;

    callerRunning = true;

    while (pendingAPICalls.length > 0) {
        // Get first call from queue

        // Safety: We know this can't be undefined, because we checked that the length > 0
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const call = pendingAPICalls.shift()!;

        console.log('Servicing API call:', call);

        try {
            const [result, wait] = await call.func();
            call.resolve(result);
            await sleep(wait);
        } catch (error) {
            call.reject(error);
            // TODO implement exponential backoff
            await sleep(1500);
        }
    }

    callerRunning = false;
}

function enqueue<T>(func: () => Response<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        console.log('Enqueueing API call:', func);
        pendingAPICalls.push({ func, resolve, reject });
        apiCaller();
    });
}

type JpdbError = {
    error:
        | 'bad_key'
        | 'bad_request'
        | 'bad_deck'
        | 'bad_vid'
        | 'bad_sid'
        | 'bad_rid'
        | 'bad_sentence'
        | 'bad_translation'
        | 'bad_image'
        | 'bad_audio'
        | 'too_many_decks'
        | 'too_many_cards_in_deck'
        | 'too_many_cards_in_total'
        | 'api_unavailable'
        | 'too_many_requests';
    error_message: string;
};

type TokenFields = {
    vocabulary_index: number;
    position_utf8: number;
    position_utf16: number;
    position_utf32: number;
    length_utf8: number;
    length_utf16: number;
    length_utf32: number;
    furigana: null | (string | [string, string])[];
};

type CardState =
    | ['new' | 'learning' | 'known' | 'never-forget' | 'due' | 'failed' | 'suspended' | 'blacklisted']
    | ['redundant', 'learning' | 'known' | 'never-forget' | 'due' | 'failed' | 'suspended']
    | ['locked', 'new' | 'due' | 'failed']
    | ['redundant', 'locked'] // Weird outlier, might either be due or failed
    | null;

type VocabFields = {
    vid: number;
    sid: number;
    rid: number;
    spelling: string;
    reading: string;
    frequency_rank: number | null;
    meanings: string[];
    card_level: number | null;
    card_state: CardState;
    due_at: number;
};

type MapFieldTuple<Tuple extends readonly [...(keyof Fields)[]], Fields> = { [I in keyof Tuple]: Fields[Tuple[I]] };

export function parse(text: string): Promise<[Token[], Card[]]> {
    return enqueue(() => _parse(text));
}

// NOTE: If you change these, make sure to change the .map calls in _parse too
const TOKEN_FIELDS = ['vocabulary_index', 'position_utf16', 'length_utf16', 'furigana'] as const;
const VOCAB_FIELDS = ['vid', 'sid', 'rid', 'spelling', 'reading', 'frequency_rank', 'meanings', 'card_state'] as const;
async function _parse(text: string): Response<[Token[], Card[]]> {
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiToken}`,
            Accept: 'application/json',
        },
        body: JSON.stringify({
            text,
            token_fields: TOKEN_FIELDS,
            vocabulary_fields: VOCAB_FIELDS,
        }),
    };

    const response = await fetch('https://jpdb.io/api/v1/parse', options);

    if (!(200 <= response.status && response.status <= 299)) {
        const data: JpdbError = await response.json();
        throw Error(`While parsing 「${truncate(text, 20)}」: ${data.error_message}`);
    }

    const data: {
        tokens: MapFieldTuple<typeof TOKEN_FIELDS, TokenFields>[];
        vocabulary: MapFieldTuple<typeof VOCAB_FIELDS, VocabFields>[];
    } = await response.json();

    const cards: Card[] = data.vocabulary.map(vocab => {
        // NOTE: If you change these, make sure to change VOCAB_FIELDS too
        const [vid, sid, rid, spelling, reading, frequencyRank, meanings, cardState] = vocab;
        return { vid, sid, rid, spelling, reading, frequencyRank, meanings, state: cardState ?? ['not-in-deck'] };
    });

    const tokens: Token[] = data.tokens.map(token => {
        // This is type-safe, but not... variable name safe :/
        // NOTE: If you change these, make sure to change TOKEN_FIELDS too
        const [vocabularyIndex, positionUtf16, lengthUtf16, furigana] = token;

        const card = cards[vocabularyIndex];
        const normalizedFurigana: null | [string, string | undefined][] =
            furigana && furigana.map(part => (typeof part === 'string' ? [part, undefined] : part));

        return { card, offset: positionUtf16, length: lengthUtf16, furigana: normalizedFurigana };
    });

    return [[tokens, cards], API_RATELIMIT];
}

export function addToDeck(
    vid: number,
    sid: number,
    deckId: number | 'blacklist' | 'never-forget' | 'forq',
): Promise<null> {
    return enqueue(() => (deckId === 'forq' ? _addToForqScrape(vid, sid) : _addToDeck(vid, sid, deckId)));
}

async function _addToDeck(vid: number, sid: number, deckId: number | 'blacklist' | 'never-forget'): Response {
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiToken}`,
            Accept: 'application/json',
        },
        body: JSON.stringify({
            id: deckId,
            vocabulary: [[vid, sid]],
        }),
    };

    const response = await fetch('https://jpdb.io/api/v1/deck/add-vocabulary', options);

    if (!(200 <= response.status && response.status <= 299)) {
        const data: JpdbError = await response.json();
        throw Error(`While adding word ${vid}/${sid} to deck "${deckId}": ${data.error_message}`);
    }

    return [null, API_RATELIMIT];
}

async function _addToForqScrape(vid: number, sid: number): Response {
    const response = await fetch('https://jpdb.io/prioritize', {
        method: 'POST',
        credentials: 'include',
        redirect: 'manual',
        headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/110.0',
            Accept: '*/*',
            'content-type': 'application/x-www-form-urlencoded',
        },
        body: `v=${vid}&s=${sid}&origin=/`,
    });

    if (response.status >= 400) {
        throw Error(`While adding word ${vid}/${sid} to FORQ: HTTP error ${response.statusText}`);
    }

    return [null, SCRAPE_RATELIMIT];
}

export function removeFromDeck(
    vid: number,
    sid: number,
    deckId: number | 'blacklist' | 'never-forget' | 'forq',
): Promise<null> {
    return enqueue(() => (deckId === 'forq' ? _removeFromForqScrape(vid, sid) : _removeFromDeck(vid, sid, deckId)));
}

async function _removeFromDeck(vid: number, sid: number, deckId: number | 'blacklist' | 'never-forget'): Response {
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiToken}`,
            Accept: 'application/json',
        },
        body: JSON.stringify({
            id: deckId,
            vocabulary: [[vid, sid]],
        }),
    };

    const response = await fetch('https://jpdb.io/api/v1/deck/remove-vocabulary', options);

    if (!(200 <= response.status && response.status <= 299)) {
        const data: JpdbError = await response.json();
        throw Error(`While removing word ${vid}/${sid} from deck "${deckId}": ${data.error_message}`);
    }

    return [null, API_RATELIMIT];
}

async function _removeFromForqScrape(vid: number, sid: number): Response {
    const response = await fetch('https://jpdb.io/deprioritize', {
        method: 'POST',
        credentials: 'include',
        redirect: 'manual',
        headers: {
            Accept: '*/*',
            'content-type': 'application/x-www-form-urlencoded',
        },
        body: `v=${vid}&s=${sid}&origin=`,
    });

    if (response.status >= 400) {
        throw Error(`While removing word ${vid}/${sid} from FORQ: HTTP error ${response.statusText}`);
    }

    return [null, SCRAPE_RATELIMIT];
}

export function setSentence(
    vid: number,
    sid: number,
    sentence: string | undefined,
    translation: string | undefined,
): Promise<null> {
    return enqueue(() => _setSentence(vid, sid, sentence, translation));
}

async function _setSentence(vid: number, sid: number, sentence?: string, translation?: string): Response {
    const body: any = { vid, sid };
    if (sentence) body.sentence = sentence;
    if (translation) body.translation = translation;

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiToken}`,
            Accept: 'application/json',
        },
        body: JSON.stringify(body),
    };

    const response = await fetch('https://jpdb.io/api/v1/set-card-sentence', options);

    if (!(200 <= response.status && response.status <= 299)) {
        const data: JpdbError = await response.json();
        throw Error(
            `While setting sentence for word ${vid}/${sid} to ${
                sentence === undefined ? 'none' : `「${truncate(sentence, 10)}」`
            } (translation: ${translation === undefined ? 'none' : `'${truncate(translation, 20)}'`}): ${
                data.error_message
            }`,
        );
    }

    return [null, API_RATELIMIT];
}

export function review(
    vid: number,
    sid: number,
    rating: 'nothing' | 'something' | 'hard' | 'good' | 'easy' | 'pass' | 'fail',
): Promise<null> {
    return enqueue(() => _reviewScrape(vid, sid, rating));
}

const REVIEW_GRADES = {
    nothing: '1',
    something: '2',
    hard: '3',
    good: '4',
    easy: '5',

    pass: 'p',
    fail: 'f',

    known: 'k',
    unknown: 'n',
    never_forget: 'w',
    blacklist: '-1',
};
async function _reviewScrape(vid: number, sid: number, rating: keyof typeof REVIEW_GRADES): Response {
    // Get current review number
    const response = await fetch(`https://jpdb.io/review?c=vf%2C${vid}%2C${sid}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            Accept: '*/*',
        },
    });

    if (response.status >= 400) {
        throw Error(`While getting next review number for word ${vid}/${sid}: HTTP error ${response.statusText}`);
    }

    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    const reviewNoInput: HTMLInputElement | null = doc.querySelector(
        'form[action^="/review"] input[type=hidden][name=r]',
    );

    assertNonNull(reviewNoInput);

    const reviewNo = parseInt(reviewNoInput.value);

    const reviewResponse = await fetch('https://jpdb.io/review', {
        method: 'POST',
        credentials: 'include',
        redirect: 'manual',
        headers: {
            Accept: '*/*',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `c=vf%2C${vid}%2C${sid}&r=${reviewNo}&g=${REVIEW_GRADES[rating]}`, // &force=true
    });

    if (reviewResponse.status >= 400) {
        throw Error(`While adding ${rating} review to word ${vid}/${sid}: HTTP error ${response.statusText}`);
    }

    return [null, 2 * SCRAPE_RATELIMIT];
}

export function getCardState(vid: number, sid: number): Promise<CardState> {
    return enqueue(() => _getCardState(vid, sid));
}

async function _getCardState(vid: number, sid: number): Response<CardState> {
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiToken}`,
            Accept: 'application/json',
        },
        body: JSON.stringify({
            list: [[vid, sid]],
            fields: ['card_state'],
        }),
    };

    const response = await fetch('https://jpdb.io/api/v1/lookup-vocabulary', options);

    if (!(200 <= response.status && response.status <= 299)) {
        const data: JpdbError = await response.json();
        throw Error(`While getting state for word ${vid}/${sid}: ${data.error_message}`);
    }

    type MapFieldTuple<Tuple extends readonly [...(keyof Fields)[]], Fields> = { [I in keyof Tuple]: Fields[Tuple[I]] };
    const data: { vocabulary_info: [MapFieldTuple<['card_state'], VocabFields> | null] } = await response.json();

    const vocabInfo = data.vocabulary_info[0];
    if (vocabInfo === null) throw Error(`Can't get state for word ${vid}/${sid}, word does not exist`);

    return [vocabInfo[0], API_RATELIMIT];
}
