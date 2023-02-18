const JPDB_RATELIMIT = 1.1; // seconds between requests

function wrap(obj, func) {
    return new Promise((resolve, reject) => { func(obj, resolve, reject) });
}

function snakeToCamel(string) {
    return string.replaceAll(/(?<!^_*)_(.)/g, (m, p1) => p1.toUpperCase())
}

const TOKEN_FIELDS = ['vocabulary_index', 'position_utf16', 'length_utf16', 'furigana'];
const VOCABULARY_FIELDS = ['vid', 'sid', 'rid', 'spelling', 'reading', 'meanings', 'card_state'];
const TOKEN_FIELD_NAMES = TOKEN_FIELDS.map(x => snakeToCamel(x));
const VOCABULARY_FIELD_NAMES = VOCABULARY_FIELDS.map(x => snakeToCamel(x));
async function parseSentenceAPI(text) {
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
        // TODO implement exponential backoff somehow?
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

    return [{ tokens, vocab }, JPDB_RATELIMIT];
}


async function parseSentenceScrape(text) {
    let response = await fetch(
        `https://jpdb.io/search?q=<…>${text.replaceAll('\n', '<\\>')}<…>`,
        { credentials: 'include' }
    );

    const doc = new DOMParser().parseFromString(await response.text(), 'text/html'),
        parseResult = doc.querySelector('.floating-sentence');

    const tokens = [];
    const vocab = [];

    if (parseResult === null) {
        const errorReason = doc.querySelector('.container')?.childNodes[1]?.textContent.trim();
        console.error(`Couldn't parse ${text}, reason: ${errorReason}`);
        if (errorReason === 'No results found.') {
            // The sentence couldn't be parsed
            return [{ tokens: [], vocab: [] }, JPDB_RATELIMIT];
        }
        else {
            // Some other jpdb error ocurred
            throw Error(errorReason);
        }
    }
    else {
        let offset = -3; // adjust for <…>
        parseResult.children[0]

        console.log('Scraping tokens', [...parseResult.children].map(child => child.innerText));

        for (const div of parseResult.children) {
            const a = div.querySelector('a');
            if (a == null) {
                // Not parsed, skip forward
                offset += div.innerText.replaceAll('<\\>', '\n').length;
            }
            else {
                const startOffset = offset;

                const furigana = [];
                for (const childNode of a.childNodes) {
                    if (childNode.nodeType === Node.TEXT_NODE) {
                        furigana.push(childNode.textContent);
                        offset += childNode.textContent.length;
                    }
                    else if (childNode.nodeType === Node.ELEMENT_NODE) {
                        const base = childNode.childNodes[0].textContent;
                        const furi = childNode.childNodes[1].textContent;
                        furigana.push([base, furi]);
                        offset += base.length;
                    }
                }
                const wordData = doc.querySelector(a.getAttribute('href'));

                const vid = parseInt(wordData.querySelector('input[type="hidden"][name="v"]').value);
                const sid = parseInt(wordData.querySelector('input[type="hidden"][name="s"]').value);

                let spelling = '';
                let reading = '';
                const spellingRuby = wordData.querySelector('ruby.v');
                for (let i = 0; i < spellingRuby.childNodes.length; i += 2) {
                    spelling += spellingRuby.childNodes[i].textContent;
                    reading += spellingRuby.childNodes[i + 1].textContent || spellingRuby.childNodes[i].textContent;
                }

                const meanings = [...wordData.querySelectorAll('.subsection-meanings .description')].map(x => x.firstChild.textContent)

                const tags = wordData.querySelector('.tags');
                // TODO parse tags.children[0].innerText to get the level/redundancy of the card
                const state = tags && (tags.children.length >= 2) ? [...tags.children[0].classList].slice(1) : 'not-in-deck';

                tokens.push({
                    vocabularyIndex: vocab.length,
                    positionUtf16: startOffset,
                    lengthUtf16: offset - startOffset,
                    furigana,
                });

                vocab.push({
                    vid, sid, rid: undefined,
                    spelling, reading,
                    meanings,
                    cardState: [state],

                    // html: wordData.innerHTML,
                });
            }
        }
    }

    return [{ tokens, vocab }, JPDB_RATELIMIT];
}


const pendingAPICalls = [];
let callerRunning = false;
function apiCall(command, options) {
    return new Promise((resolve, reject) => {
        pendingAPICalls.push({ command, ...options, resolve, reject });
        if (!callerRunning) {
            callerRunning = true;
            setTimeout(apiCaller, 0);
        }
    });
}

// TODO figure out how to turn this into an async loop rather than using setTimeout recursion
function apiCaller() {
    // If no API calls are pending, stop running
    if (pendingAPICalls.length === 0) {
        callerRunning = false;
        return;
    }

    // Get first call from queue
    const call = pendingAPICalls.shift();

    if (call.command === 'parse') {
        (config.useScraping ? parseSentenceScrape : parseSentenceAPI)(call.text)
            .then(([result, timeout]) => {
                setTimeout(apiCaller, 1000 * timeout);
                call.resolve(result);
            })
            .catch((err) => call.reject(err));

    } else {
        call.reject('Unknown command');
    }
}

async function readFile(path) {
    const resp = await fetch(browser.runtime.getURL(path));
    return await resp.text();
}

const DEFAULT_WORD_CSS = await readFile('content_word.css');
const DEFAULT_POPUP_CSS = await readFile('content_popup.css');

const config = {
    apiToken: localStorage.getItem('apiToken') ?? '',
    useScraping: JSON.parse(localStorage.getItem('useScraping') ?? false),
    customWordCSS: localStorage.getItem('customWordCSS') ?? '',
    customPopupCSS: localStorage.getItem('customPopupCSS') ?? '',
}
config.wordCSS = DEFAULT_WORD_CSS + config.customWordCSS;
config.popupCSS = DEFAULT_POPUP_CSS + config.customPopupCSS;

const tabs = new Set();

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    tabs.delete(tabId);
})

function notifyContentScripts(message) {
    for (const tabId of tabs)
        browser.tabs.sendMessage(tabId, message, (response) => { });
}

browser.contextMenus.create({
    id: 'parse-selection',
    title: 'Parse with jpdb',
    contexts: ['selection'],
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'parse-selection') {
        await browser.tabs.executeScript(tab.id, {
            file: "/content_common.js"
        });
        browser.tabs.executeScript(tab.id, {
            file: "/content_contextmenu.js"
        });
    }
});


const db = await wrap(indexedDB.open('jpdb', 1), (obj, resolve, reject) => {
    obj.onsuccess = (event) => resolve(obj.result);
    obj.onerror = (event) => reject(obj.error);
    obj.onupgradeneeded = (event) => {
        console.log('Database upgrade');
        const db = event.target.result;
        db.createObjectStore('paragraphs', { keyPath: 'text' });
        db.createObjectStore('words', { keyPath: ['vid', 'sid', 'rid'] });
    };
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Got message', message);
    switch (message.command) {
        case 'registerTab': {
            tabs.add(sender.tab.id)

            browser.tabs.insertCSS(sender.tab.id, { file: 'content_word.css' });
            if (config.customWordCSS)
                browser.tabs.insertCSS(sender.tab.id, { code: config.customWordCSS });

            sendResponse(config);
            return false;
        }

        case 'getConfig': {
            sendResponse(config);
            return false;
        }

        case 'setConfig': {
            const oldCSS = config.customWordCSS;

            Object.assign(config, message.config);
            config.wordCSS = DEFAULT_WORD_CSS + config.customWordCSS;
            config.popupCSS = DEFAULT_POPUP_CSS + config.customPopupCSS;

            for (const [key, value] of Object.entries(config)) {
                localStorage.setItem(key, value);
            }

            for (const tabId of tabs) {
                if (config.customWordCSS)
                    browser.tabs.insertCSS(tabId, { code: config.customWordCSS });
                if (oldCSS)
                    browser.tabs.removeCSS(tabId, { code: oldCSS });
            }

            notifyContentScripts({ command: "setConfig", config });
            return false;
        }

        case 'parse': {
            return apiCall('parse', { text: message.text });
        }

        default:
            return false;
    }
});
