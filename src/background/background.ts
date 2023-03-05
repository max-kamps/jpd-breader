import { Config } from '../types.js';
import { readExtFile } from '../util.js';
import * as backend from './backend.js';

// Config management

const DEFAULT_WORD_CSS = await readExtFile('/content/word.css');
const DEFAULT_POPUP_CSS = await readExtFile('/content/popup.css');
const DEFAULT_DIALOG_CSS = await readExtFile('/content/dialog.css');

export const config: Config = (() => {
    const apiToken = localStorage.getItem('apiToken') ?? '';
    const miningDeckId = localStorage.getItem('miningDeckId') ?? '';
    const forqDeckId = localStorage.getItem('forqDeckId') ?? 'forq';
    const blacklistDeckId = localStorage.getItem('blacklistDeckId') ?? 'blacklist';
    const neverForgetDeckId = localStorage.getItem('neverForgetDeckId') ?? 'never-forget';
    const customWordCSS = localStorage.getItem('customWordCSS') ?? '';
    const customPopupCSS = localStorage.getItem('customPopupCSS') ?? '';
    const wordCSS = DEFAULT_WORD_CSS + customWordCSS;
    const popupCSS = DEFAULT_POPUP_CSS + customPopupCSS;
    const dialogCSS = DEFAULT_DIALOG_CSS;

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

const ports = new Set<browser.runtime.Port>();

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

async function onPortMessage(message: any, port: browser.runtime.Port) {
    console.log('message:', message, port);

    try {
        let result: any = null;

        // TODO rewrite this so this always returns a response
        // Then check that response in the content script and possibly show an error message
        switch (message.command) {
            case 'updateConfig':
                {
                    const oldCSS = config.customWordCSS;

                    Object.assign(config, message.config);
                    config.wordCSS = DEFAULT_WORD_CSS + config.customWordCSS;
                    config.popupCSS = DEFAULT_POPUP_CSS + config.customPopupCSS;

                    for (const [key, value] of Object.entries(config)) {
                        localStorage.setItem(key, value);
                    }

                    for (const port of ports) {
                        if (config.customWordCSS)
                            browser.tabs.insertCSS(port.sender.tab.id, { code: config.customWordCSS });
                        if (oldCSS) browser.tabs.removeCSS(port.sender.tab.id, { code: oldCSS });
                    }

                    broadcastCommand('updateConfig', { config });
                }
                break;

            case 'parse':
                result = await backend.parse(message.text);
                break;

            case 'addToSpecial':
                result = await backend.addToDeck(
                    message.vid,
                    message.sid,
                    message.deck === 'blacklist' ? config.blacklistDeckId : config.neverForgetDeckId,
                );
                break;

            case 'review':
                await backend.review(message.vid, message.sid, message.rating);
                break;

            case 'mine':
                await backend.addToDeck(message.vid, message.sid, config.miningDeckId);

                if (message.sentence || message.translation) {
                    await backend.setSentence(message.vid, message.sid, message.sentence, message.translation);
                }

                if (message.forq) {
                    await backend.addToDeck(message.vid, message.sid, config.forqDeckId);
                }

                if (message.review) {
                    await backend.review(message.vid, message.sid, message.review);
                }

                break;

            case 'ping':
                result = 'pong';
                break;

            default:
                throw new Error(`Unknown command ${message.command}`);
        }

        postResponse(port, message, { result });
    } catch (error) {
        postResponse(port, message, { error });
    }
}

browser.runtime.onConnect.addListener(port => {
    console.log('connect:', port);
    ports.add(port);

    port.onDisconnect.addListener(onPortDisconnect);
    port.onMessage.addListener(onPortMessage);

    // TODO filter to only url-relevant config options
    postCommand(port, 'updateConfig', { config });
    browser.tabs.insertCSS(port.sender.tab.id, { code: config.customWordCSS });
});

// Context menu (Parse with jpdb)

function portForTab(tabId: number): browser.runtime.Port | undefined {
    for (const port of ports) if (port.sender.tab.id === tabId) return port;

    return undefined;
}

browser.contextMenus.create({
    id: 'parse-selection',
    title: 'Parse with jpdb',
    contexts: ['selection'],
});

async function insertCSS(tabId: number) {
    // We need to await here, because ordering is significant.
    // The custom styles should load after the default styles, so they can overwrite them
    await browser.tabs.insertCSS(tabId, { file: '/content/word.css' });
    if (config.customWordCSS) await browser.tabs.insertCSS(tabId, { code: config.customWordCSS });
}

browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'parse-selection') {
        const port = portForTab(tab.id);

        if (port === undefined) {
            // New tab, inject css
            await insertCSS(tab.id);
        }

        await browser.tabs.executeScript(tab.id, { file: '/content/inject_contextmenu.js' });
    }
});
