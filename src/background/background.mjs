import { readExtFile } from "../util.mjs";
import { apiCall } from "./backend_queue.mjs";


// Config management

const DEFAULT_WORD_CSS = await readExtFile('src/content/word.css');
const DEFAULT_POPUP_CSS = await readExtFile('src/content/popup.css');
const DEFAULT_DIALOG_CSS = await readExtFile('src/content/dialog.css');

export const config = {
    apiToken: localStorage.getItem('apiToken') ?? '',
    useScraping: JSON.parse(localStorage.getItem('useScraping') ?? false),
    miningDeckId: localStorage.getItem('miningDeckId') ?? '',
    forqDeckId: localStorage.getItem('forqDeckId') ?? 'forq',
    blacklistDeckId: localStorage.getItem('blacklistDeckId') ?? 'blacklist',
    neverForgetDeckId: localStorage.getItem('neverForgetDeckId') ?? 'never-forget',
    customWordCSS: localStorage.getItem('customWordCSS') ?? '',
    customPopupCSS: localStorage.getItem('customPopupCSS') ?? '',
}
config.wordCSS = DEFAULT_WORD_CSS + config.customWordCSS;
config.popupCSS = DEFAULT_POPUP_CSS + config.customPopupCSS;
config.dialogCSS = DEFAULT_DIALOG_CSS;


// Content script communication

const ports = new Set();

function postCommand(port, command, args) {
    port.postMessage({ command, ...args });
}

function postResponse(port, request, args) {
    port.postMessage({ command: 'response', seq: request.seq, ...args });
}

function broadcastCommand(command, args) {
    const message = { command, ...args };
    for (const port of ports)
        port.postMessage(message);
}

function onPortDisconnect(port) {
    console.log('disconnect:', port);
    ports.delete(port);
}

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
            apiCall('parse', { text: message.text })
                .then(result => postResponse(port, message, { result }))
                .catch(error => postResponse(port, message, { error }));
        } break;

        case 'addToBlacklist': {
            apiCall('addToDeck', { vid: message.vid, sid: message.sid, deckId: config.blacklistDeckId });
        } break;

        case 'addToNeverForget': {
            apiCall('addToDeck', { vid: message.vid, sid: message.sid, deckId: config.neverForgetDeckId });
        } break;

        case 'mine': {
            apiCall('addToDeck', { vid: message.vid, sid: message.sid, deckId: config.miningDeckId });

            if (message.sentence || message.translation) {
                apiCall('setSentence', { vid: message.vid, sid: message.sid, sentence: message.sentence, translation: message.translation });
            }

            if (message.forq) {
                apiCall('addToDeck', { vid: message.vid, sid: message.sid, deckId: config.forqDeckId });
            }

            if (message.review) {
                apiCall('review', { vid: message.vid, sid: message.sid, rating: message.review });
            }
        } break;

        case 'review': {
            apiCall('review', { vid: message.vid, sid: message.sid, rating: message.rating });
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
