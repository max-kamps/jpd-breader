import { readExtFile } from "../util.mjs";
import * as backend from "./backend.mjs";


// Config management

const DEFAULT_WORD_CSS = await readExtFile('src/content/word.css');
const DEFAULT_POPUP_CSS = await readExtFile('src/content/popup.css');
const DEFAULT_DIALOG_CSS = await readExtFile('src/content/dialog.css');

export const config = (() => {
    const apiToken = localStorage.getItem('apiToken') ?? '';
    const useScraping = JSON.parse(localStorage.getItem('useScraping') ?? 'false');
    const miningDeckId = localStorage.getItem('miningDeckId') ?? '';
    const forqDeckId = localStorage.getItem('forqDeckId') ?? 'forq';
    const blacklistDeckId = localStorage.getItem('blacklistDeckId') ?? 'blacklist';
    const neverForgetDeckId = localStorage.getItem('neverForgetDeckId') ?? 'never-forget';
    const customWordCSS = localStorage.getItem('customWordCSS') ?? '';
    const customPopupCSS = localStorage.getItem('customPopupCSS') ?? '';
    const wordCSS = DEFAULT_WORD_CSS + customWordCSS;
    const popupCSS = DEFAULT_POPUP_CSS + customPopupCSS;
    const dialogCSS = DEFAULT_DIALOG_CSS;

    return { apiToken, useScraping, miningDeckId, forqDeckId, blacklistDeckId, neverForgetDeckId, customWordCSS, customPopupCSS, wordCSS, popupCSS, dialogCSS };
})();


// Content script communication

/**
 * @type Set<browser.runtime.Port>
 */
const ports = new Set();

/**
 * @param {browser.runtime.Port} port 
 * @param {string} command 
 * @param {{[key: string]: any}} args 
 */
function postCommand(port, command, args) {
    port.postMessage({ command, ...args });
}

/**
 * @param {browser.runtime.Port} port 
 * @param {{seq: number}} request 
 * @param {{[key: string]: any}} args 
 */
function postResponse(port, request, args) {
    port.postMessage({ command: 'response', seq: request.seq, ...args });
}

/**
 * @param {string} command 
 * @param {{[key: string]: any}} args 
 */
function broadcastCommand(command, args) {
    const message = { command, ...args };
    for (const port of ports)
        port.postMessage(message);
}

/**
 * @param {browser.runtime.Port} port 
 */
function onPortDisconnect(port) {
    console.log('disconnect:', port);
    ports.delete(port);
}

/**
 * @param {any} message 
 * @param {browser.runtime.Port} port 
 */
function onPortMessage(message, port) {
    console.log('message:', message, port);

    // TODO rewrite this so this always returns a response
    // Then check that response in the content script and possibly show an error message
    switch (message.command) {
        case 'updateConfig': {
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
                if (oldCSS)
                    browser.tabs.removeCSS(port.sender.tab.id, { code: oldCSS });
            }

            broadcastCommand('updateConfig', { config });
        } break;

        case 'parse': {
            backend.parse(message.text)
                .then(result => postResponse(port, message, { result }))
                .catch(error => postResponse(port, message, { error }));
        } break;

        case 'addToBlacklist': {
            backend.addToDeck(message.vid, message.sid, config.blacklistDeckId);
        } break;

        case 'addToNeverForget': {
            backend.addToDeck(message.vid, message.sid, config.neverForgetDeckId);
        } break;

        case 'mine': {
            backend.addToDeck(message.vid, message.sid, config.miningDeckId);

            if (message.sentence || message.translation) {
                backend.setSentence(message.vid, message.sid, message.sentence, message.translation);
            }

            if (message.forq) {
                backend.addToDeck(message.vid, message.sid, config.forqDeckId);
            }

            if (message.review) {
                backend.review(message.vid, message.sid, message.review);
            }
        } break;

        case 'review': {
            backend.review(message.vid, message.sid, message.rating);
        } break;

        case 'ping': {
            postResponse(port, message, { result: 'pong' });
        } break;

        default:
            console.error('Unknown command');
    }
}

browser.runtime.onConnect.addListener((port) => {
    console.log('connect:', port);
    ports.add(port);

    port.onDisconnect.addListener(onPortDisconnect);
    port.onMessage.addListener(onPortMessage);

    // TODO filter to only url-relevant config options
    postCommand(port, 'updateConfig', { config });
    browser.tabs.insertCSS(port.sender.tab.id, { code: config.customWordCSS });
})


// Context menu (Parse with jpdb)

function portForTab(tabId) {
    for (const port of ports)
        if (port.sender.tab.id === tabId)
            return port;
}

browser.contextMenus.create({
    id: 'parse-selection',
    title: 'Parse with jpdb',
    contexts: ['selection'],
});

async function insertCSS(tabId) {
    // We need to await here, because ordering is significant.
    // The custom styles should load after the default styles, so they can overwrite them
    await browser.tabs.insertCSS(tabId, { file: '/src/content/word.css' })
    if (config.customWordCSS)
        await browser.tabs.insertCSS(tabId, { code: config.customWordCSS });
}

browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'parse-selection') {
        const port = portForTab(tab.id);

        if (port === undefined) {
            // New tab, inject css
            await insertCSS(tab.id);
        }

        await browser.tabs.executeScript(tab.id, { file: '/src/content/inject_contextmenu.js' });
    }
});
