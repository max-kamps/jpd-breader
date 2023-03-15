import { Config } from '../types.js';
import { isChrome, browser } from '../util.js';
import * as backend from './backend.js';
import { BackgroundRequest, BackgroundResponseMap } from './command_types.js';

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

    showPopupKey: 'Shift',
    blacklistKey: null,
    neverForgetKey: null,
    nothingKey: null,
    somethingKey: null,
    hardKey: null,
    goodKey: null,
    easyKey: null,
};

export const config = Object.fromEntries(
    Object.entries(defaultConfig).map(([key, defaultValue]) => [key, localStorageGet(key, defaultValue)]),
) as Config;

// Content script communication

const ports = new Set<browser.runtime.ContentScriptPort>();

function postCommand(port: browser.runtime.Port, command: string, args: { [key: string]: any }) {
    port.postMessage({ command, ...args });
}

function postResponse<T extends BackgroundRequest>(
    port: browser.runtime.Port,
    request: T,
    result: BackgroundResponseMap[T['command']]['result'],
) {
    port.postMessage({ command: 'response', seq: request.seq, result });
}

function postError(port: browser.runtime.Port, request: { seq: number }, error: { message: string }) {
    port.postMessage({ command: 'response', seq: request.seq, error });
}

function broadcastCommand(command: string, args: { [key: string]: any }) {
    const message = { command, ...args };
    for (const port of ports) port.postMessage(message);
}

function onPortDisconnect(port: browser.runtime.Port) {
    console.log('disconnect:', port);
    ports.delete(port);
}

async function broadcastNewWordState(vid: number, sid: number) {
    broadcastCommand('updateWordState', {
        words: [[vid, sid, await backend.getCardState(vid, sid)]],
    });
}

const commandHandlers: {
    [Req in BackgroundRequest as Req['command']]: (request: Req, port: browser.runtime.Port) => Promise<void>;
} = {
    async updateConfig(request, port) {
        const oldCSS = config.customWordCSS;

        Object.assign(config, request.config);

        for (const [key, value] of Object.entries(request.config)) {
            localStorageSet(key, value);
        }

        for (const port of ports) {
            if (config.customWordCSS) browser.tabs.insertCSS(port.sender.tab.id, { code: config.customWordCSS });
            if (oldCSS) browser.tabs.removeCSS(port.sender.tab.id, { code: oldCSS });
        }

        postResponse(port, request, null);
        broadcastCommand('updateConfig', { config, defaultConfig });
    },

    async parse(request, port) {
        const [tokens, cards] = await backend.parse(request.text);
        postResponse(port, request, tokens);
        broadcastCommand('updateWordState', {
            words: cards.map(card => [card.vid, card.sid, card.state]),
        });
    },

    async setFlag(request, port) {
        const deckId = request.flag === 'blacklist' ? config.blacklistDeckId : config.neverForgetDeckId;

        if (deckId === null) {
            throw Error(`No deck ID set for ${request.flag}, check the settings page`);
        }

        if (request.state === true) {
            await backend.addToDeck(request.vid, request.sid, deckId);
        } else {
            await backend.removeFromDeck(request.vid, request.sid, deckId);
        }

        postResponse(port, request, null);
        await broadcastNewWordState(request.vid, request.sid);
    },

    async review(request, port) {
        await backend.review(request.vid, request.sid, request.rating);
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

        await backend.addToDeck(request.vid, request.sid, config.miningDeckId);

        if (request.sentence || request.translation) {
            await backend.setSentence(
                request.vid,
                request.sid,
                request.sentence ?? undefined,
                request.translation ?? undefined,
            );
        }

        if (request.forq) {
            // Safety: This is safe, because we early-errored for this condition
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await backend.addToDeck(request.vid, request.sid, config.forqDeckId!);
        }

        if (request.review) {
            await backend.review(request.vid, request.sid, request.review);
        }

        postResponse(port, request, null);
        await broadcastNewWordState(request.vid, request.sid);
    },
};

async function onPortMessage(request: BackgroundRequest, port: browser.runtime.Port) {
    console.log('message:', request, port);

    try {
        await commandHandlers[request.command](request as any, port);
    } catch (error) {
        postError(port, request, error);
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
    postCommand(port, 'updateConfig', { config, defaultConfig });
    browser.tabs.insertCSS(port.sender.tab.id, { code: config.customWordCSS });
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
    await browser.tabs.insertCSS(tabId, { file: '/content/word.css' });
    if (config.customWordCSS) await browser.tabs.insertCSS(tabId, { code: config.customWordCSS });
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
