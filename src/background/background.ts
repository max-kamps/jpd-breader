import { Config } from '../types.js';
import { isChrome, browser, readExtFile } from '../util.js';
import * as backend from './backend.js';

if (isChrome) {
    (Error.prototype as any).toJSON = function () {
        return { message: this.message };
    };
}

// Config management

const defaultConfig: Config = {
    apiToken: null,
    miningDeckId: null,
    forqDeckId: 'forq',
    blacklistDeckId: 'blacklist',
    neverForgetDeckId: 'never-forget',
    customWordCSS: '',
    customPopupCSS: '',
    wordCSS: await readExtFile('/content/word.css'),
    popupCSS: await readExtFile('/content/popup.css'),
    dialogCSS: await readExtFile('/content/dialog.css'),
};

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

export const config: Config = (() => {
    const apiToken = localStorageGet('apiToken', defaultConfig.apiToken);
    const miningDeckId = localStorageGet('miningDeckId', defaultConfig.miningDeckId);
    const forqDeckId = localStorageGet('forqDeckId', defaultConfig.forqDeckId);
    const blacklistDeckId = localStorageGet('blacklistDeckId', defaultConfig.blacklistDeckId);
    const neverForgetDeckId = localStorageGet('neverForgetDeckId', defaultConfig.neverForgetDeckId);
    const customWordCSS = localStorageGet('customWordCSS', defaultConfig.customWordCSS);
    const customPopupCSS = localStorageGet('customPopupCSS', defaultConfig.customPopupCSS);
    const wordCSS = defaultConfig.wordCSS + customWordCSS;
    const popupCSS = defaultConfig.popupCSS + customPopupCSS;
    const dialogCSS = defaultConfig.dialogCSS;

    return {
        apiToken,
        miningDeckId,
        forqDeckId,
        blacklistDeckId,
        neverForgetDeckId,
        customWordCSS,
        customPopupCSS,
        wordCSS,
        popupCSS,
        dialogCSS,
    };
})();

// Content script communication

const ports = new Set<browser.runtime.ContentScriptPort>();

function postCommand(port: browser.runtime.Port, command: string, args: { [key: string]: any }) {
    port.postMessage({ command, ...args });
}

function postResponse(port: browser.runtime.Port, request: { seq: number }, args: { [key: string]: any }) {
    port.postMessage({ command: 'response', seq: request.seq, ...args });
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

async function onPortMessage(message: any, port: browser.runtime.Port) {
    console.log('message:', message, port);

    try {
        switch (message.command) {
            case 'updateConfig':
                {
                    const oldCSS = config.customWordCSS;

                    Object.assign(config, message.config);
                    config.wordCSS = defaultConfig.wordCSS + config.customWordCSS;
                    config.popupCSS = defaultConfig.popupCSS + config.customPopupCSS;

                    for (const [key, value] of Object.entries(config)) {
                        localStorageSet(key, value);
                    }

                    for (const port of ports) {
                        if (config.customWordCSS)
                            browser.tabs.insertCSS(port.sender.tab.id, { code: config.customWordCSS });
                        if (oldCSS) browser.tabs.removeCSS(port.sender.tab.id, { code: oldCSS });
                    }

                    broadcastCommand('updateConfig', { config, defaultConfig });
                }
                break;

            case 'parse':
                {
                    const [tokens, cards] = await backend.parse(message.text);
                    postResponse(port, message, { result: tokens });
                    broadcastCommand('updateWordState', {
                        words: cards.map(card => [card.vid, card.sid, card.state]),
                    });
                }
                break;

            case 'setFlag':
                {
                    const deckId = message.flag === 'blacklist' ? config.blacklistDeckId : config.neverForgetDeckId;

                    if (deckId === null) {
                        throw Error(`No deck ID set for ${message.flag}, check the settings page`);
                    }

                    if (message.state === true) {
                        await backend.addToDeck(message.vid, message.sid, deckId);
                    } else {
                        await backend.removeFromDeck(message.vid, message.sid, deckId);
                    }

                    postResponse(port, message, { result: null });
                    broadcastNewWordState(message.vid, message.sid);
                }
                break;

            case 'review':
                postResponse(port, message, {
                    result: await backend.review(message.vid, message.sid, message.rating),
                });
                broadcastNewWordState(message.vid, message.sid);
                break;

            case 'mine':
                if (config.miningDeckId === null) {
                    throw Error(`No mining deck ID set, check the settings page`);
                }

                if (message.forq && config.forqDeckId === null) {
                    throw Error(`No forq deck ID set, check the settings page`);
                }

                await backend.addToDeck(message.vid, message.sid, config.miningDeckId);

                if (message.sentence || message.translation) {
                    await backend.setSentence(message.vid, message.sid, message.sentence, message.translation);
                }

                if (message.forq) {
                    // Safety: This is safe, because we early-errored for this condition
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    await backend.addToDeck(message.vid, message.sid, config.forqDeckId!);
                }

                if (message.review) {
                    await backend.review(message.vid, message.sid, message.review);
                }

                postResponse(port, message, { result: null });
                broadcastNewWordState(message.vid, message.sid);
                break;

            case 'ping':
                postResponse(port, message, { result: 'pong' });
                break;

            default:
                throw new Error(`Unknown command ${message.command}`);
        }
    } catch (error) {
        postResponse(port, message, { error });
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

        await browser.tabs.executeScript(tab.id, { file: '/content/contextmenu_inject.js' });
    }
});
