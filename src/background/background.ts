import { BackgroundToContentMessage, ContentToBackgroundMessage, ResponseTypeMap } from '../message_types.js';
import { Config, DeckId, Grade, Token } from '../types.js';
import { browser, isChrome, PromiseHandle, sleep } from '../util.js';
import * as backend from './backend.js';

if (isChrome) {
    (Error.prototype as any).toJSON = function () {
        return { message: this.message };
    };
}

// Config management

function localStorageGet(key: string, fallback: any = null): any {
    const data = localStorage.getItem(key);
    if (data === null) return fallback;

    try {
        return JSON.parse(data) ?? fallback;
    } catch {
        return fallback;
    }
}

function localStorageSet(key: string, value: any) {
    localStorage.setItem(key, JSON.stringify(value));
}

const defaultConfig: Config = {
    apiToken: null,
    miningDeckId: null,
    forqDeckId: 'forq',
    blacklistDeckId: 'blacklist',
    neverForgetDeckId: 'never-forget',
    customWordCSS: '',
    customPopupCSS: '',

    contextWidth: 1,
    forqOnMine: true,

    showPopupKey: { key: 'Shift', code: 'ShiftLeft', modifiers: [] },
    addKey: null,
    dialogKey: null,
    blacklistKey: null,
    neverForgetKey: null,
    nothingKey: null,
    somethingKey: null,
    hardKey: null,
    goodKey: null,
    easyKey: null,
};

const CURRENT_SCHEMA_VERSION = 1;
let schemaVersion = localStorageGet('schemaVersion', 0);

// schema migrations
if (schemaVersion === 0) {
    // Keybinds changed from string to object
    for (const key of [
        'showPopupKey',
        'blacklistKey',
        'neverForgetKey',
        'nothingKey',
        'somethingKey',
        'hardKey',
        'goodKey',
        'easyKey',
    ]) {
        localStorage.removeItem(key);
    }

    localStorageSet('schemaVersion', (schemaVersion = 1));
}

// If the schema version is not the current version after applying all migrations, give up and refuse to load the config
// Use the default as a fallback
export const config =
    schemaVersion === CURRENT_SCHEMA_VERSION
        ? (Object.fromEntries(
              Object.entries(defaultConfig).map(([key, defaultValue]) => [key, localStorageGet(key, defaultValue)]),
          ) as Config)
        : defaultConfig;

// API call queue

type Call<T> = PromiseHandle<T> & {
    func(): backend.Response<T>;
};

const pendingAPICalls: Call<unknown>[] = [];
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

function enqueue<T>(func: () => backend.Response<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        pendingAPICalls.push({ func, resolve, reject });
        apiCaller();
    });
}

export async function addToDeck(vid: number, sid: number, deckId: DeckId) {
    return enqueue(() => backend.addToDeck(vid, sid, deckId));
}
export async function removeFromDeck(vid: number, sid: number, deckId: DeckId) {
    return enqueue(() => backend.removeFromDeck(vid, sid, deckId));
}
export async function setSentence(vid: number, sid: number, sentence?: string, translation?: string) {
    return enqueue(() => backend.setSentence(vid, sid, sentence, translation));
}
export async function review(vid: number, sid: number, rating: Grade) {
    return enqueue(() => backend.review(vid, sid, rating));
}
export async function getCardState(vid: number, sid: number) {
    return enqueue(() => backend.getCardState(vid, sid));
}

const maxParseLength = 16384;

type PendingParagraph = PromiseHandle<Token[]> & {
    text: string;
    length: number;
};
const pendingParagraphs = new Map<number, PendingParagraph>();

async function batchParses() {
    // Greedily take as many paragraphs as can fit
    let length = 0;
    const strings: string[] = [];
    const handles: PromiseHandle<Token[]>[] = [];

    for (const [seq, paragraph] of pendingParagraphs) {
        length += paragraph.length;
        if (length > maxParseLength) break;
        strings.push(paragraph.text);
        handles.push(paragraph);
        pendingParagraphs.delete(seq);
    }

    if (strings.length === 0) return [null, 0] as [null, number];

    try {
        const [[tokens, cards], timeout] = await backend.parse(strings);

        for (const [i, handle] of handles.entries()) {
            handle.resolve(tokens[i]);
        }

        broadcast({ type: 'updateWordState', words: cards.map(card => [card.vid, card.sid, card.state]) });

        return [null, timeout] as [null, number];
    } catch (error) {
        for (const handle of handles) {
            handle.reject(error);
        }

        throw error;
    }
}

export function enqueueParse(seq: number, text: string): Promise<Token[]> {
    return new Promise((resolve, reject) => {
        pendingParagraphs.set(seq, {
            text,
            // HACK work around the ○○ we will add later
            length: new TextEncoder().encode(text).length + 7,
            resolve,
            reject,
        });
    });
}

export function startParse() {
    pendingAPICalls.push({ func: batchParses, resolve: () => {}, reject: () => {} });
    apiCaller();
}

// Content script communication

const ports = new Set<browser.runtime.ContentScriptPort>();

function post(port: browser.runtime.Port, message: BackgroundToContentMessage) {
    port.postMessage(message);
}

function broadcast(message: BackgroundToContentMessage) {
    for (const port of ports) port.postMessage(message);
}

function postResponse<T extends ContentToBackgroundMessage & { seq: number }>(
    port: browser.runtime.Port,
    request: T,
    result: ResponseTypeMap[T['type']]['result'],
) {
    port.postMessage({ type: 'success', seq: request.seq, result });
}

function onPortDisconnect(port: browser.runtime.Port) {
    console.log('disconnect:', port);
    ports.delete(port);
}

async function broadcastNewWordState(vid: number, sid: number) {
    broadcast({ type: 'updateWordState', words: [[vid, sid, await getCardState(vid, sid)]] });
}

const messageHandlers: {
    [Req in ContentToBackgroundMessage as Req['type']]: (request: Req, port: browser.runtime.Port) => Promise<void>;
} = {
    async cancel(request, port) {
        // Right now, only parse requests can actually be canceled
        pendingParagraphs.delete(request.seq);
        post(port, { type: 'canceled', seq: request.seq });
    },

    async updateConfig(request, port) {
        const oldCSS = config.customWordCSS;

        Object.assign(config, request.config);
        for (const [key, value] of Object.entries(config)) {
            localStorageSet(key, value);
        }
        localStorageSet('schemaVersion', (schemaVersion = CURRENT_SCHEMA_VERSION));

        for (const port of ports) {
            if (config.customWordCSS) {
                browser.tabs.insertCSS(port.sender.tab.id, { code: config.customWordCSS, cssOrigin: 'author' });
            }

            if (oldCSS) {
                browser.tabs.removeCSS(port.sender.tab.id, { code: oldCSS });
            }
        }

        postResponse(port, request, null);
        broadcast({ type: 'updateConfig', config, defaultConfig });
    },

    async parse(request, port) {
        for (const [seq, text] of request.texts) {
            enqueueParse(seq, text)
                .then(tokens => post(port, { type: 'success', seq: seq, result: tokens }))
                .catch(error => post(port, { type: 'error', seq: seq, error }));
        }
        startParse();
    },

    async setFlag(request, port) {
        const deckId = request.flag === 'blacklist' ? config.blacklistDeckId : config.neverForgetDeckId;

        if (deckId === null) {
            throw Error(`No deck ID set for ${request.flag}, check the settings page`);
        }

        if (request.state === true) {
            await addToDeck(request.vid, request.sid, deckId);
        } else {
            await removeFromDeck(request.vid, request.sid, deckId);
        }

        postResponse(port, request, null);
        await broadcastNewWordState(request.vid, request.sid);
    },

    async review(request, port) {
        await review(request.vid, request.sid, request.rating);
        postResponse(port, request, null);
        await broadcastNewWordState(request.vid, request.sid);
    },

    async mine(request, port) {
        if (config.miningDeckId === null) {
            throw Error(`No mining deck ID set, check the settings page`);
        }

        if (request.forq && config.forqDeckId === null) {
            throw Error(`No forq deck ID set, check the settings page`);
        }

        // Safety: This is safe, because we early-errored for this condition
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await addToDeck(request.vid, request.sid, config.miningDeckId!);

        if (request.sentence || request.translation) {
            await setSentence(
                request.vid,
                request.sid,
                request.sentence ?? undefined,
                request.translation ?? undefined,
            );
        }

        if (request.forq) {
            // Safety: This is safe, because we early-errored for this condition
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await addToDeck(request.vid, request.sid, config.forqDeckId!);
        }

        if (request.review) {
            await review(request.vid, request.sid, request.review);
        }

        postResponse(port, request, null);
        await broadcastNewWordState(request.vid, request.sid);
    },
};

async function onPortMessage(message: ContentToBackgroundMessage, port: browser.runtime.Port) {
    console.log('message:', message, port);

    try {
        await messageHandlers[message.type](message as any, port);
    } catch (error) {
        post(port, { type: 'error', seq: (message as any).seq ?? null, error });
    }
}

browser.runtime.onConnect.addListener(port => {
    console.log('connect:', port);

    if (port.sender.tab === undefined) {
        // Connection was not from a content script
        port.disconnect();
        return;
    }

    ports.add(port);

    port.onDisconnect.addListener(onPortDisconnect);
    port.onMessage.addListener(onPortMessage);

    // TODO filter to only url-relevant config options
    post(port, { type: 'updateConfig', config, defaultConfig });
    browser.tabs.insertCSS(port.sender.tab.id, { code: config.customWordCSS, cssOrigin: 'author' });
});

// Context menu (Parse with jpdb)

function portForTab(tabId: number): browser.runtime.Port | undefined {
    for (const port of ports) if (port.sender.tab.id === tabId) return port;

    return undefined;
}

const parseSelection = browser.contextMenus.create({
    id: 'parse-selection',
    title: 'Parse 「%s」with jpdb',
    contexts: ['selection'],
});

async function insertCSS(tabId: number) {
    // We need to await here, because ordering is significant.
    // The custom styles should load after the default styles, so they can overwrite them
    await browser.tabs.insertCSS(tabId, { file: '/content/word.css', cssOrigin: 'author' });
    if (config.customWordCSS) await browser.tabs.insertCSS(tabId, { code: config.customWordCSS, cssOrigin: 'author' });
}

browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === parseSelection) {
        const port = portForTab(tab.id);

        if (port === undefined) {
            // New tab, inject css
            await insertCSS(tab.id);
        }

        await browser.tabs.executeScript(tab.id, { file: '/integrations/contextmenu.js' });
    }
});
