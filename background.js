const JPDB_RATELIMIT = 1.1; // seconds between requests

function wrap(obj, func) {
    return new Promise((resolve, reject) => { func(obj, resolve, reject) });
}

async function parseSentenceAPI(text) {
    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
        body: {
            text,
            token_fields: ['vocabulary_index', 'position_utf32', 'length_utf32', 'furigana'],
            vocabulary_fields: ['vid', 'sid', 'rid', 'spelling', 'reading', 'frequency_rank', 'meanings', 'card_level', 'card_state'],
        }
    };

    const response = await fetch('https://jpdb.io/api/v1/parse', options),
        data = response.json();
}

async function parseSentenceScrape(text) {
    console.log('parsing sentence', text);
    const cachedResults = await wrap(
        db.transaction('paragraphs', 'readonly')
            .objectStore('paragraphs')
            .get(text),

        (obj, resolve, reject) => {
            obj.onsuccess = (event) => { resolve(obj.result); }
            obj.onerror = (event) => { reject(obj.error); }
        }
    );

    if (cachedResults !== undefined) {
        // The sentence was already in the cache
        console.log('cached result', text, cachedResults);
        return [cachedResults, 0];
    }

    let response;
    try {
        response = await fetch(
            `https://jpdb.io/search?q=<…>${text}<…>`,
            { credentials: 'include' }
        );
    } catch (e) {
        return [{
            text,
            error: e.message,
        }, 0]
    }

    const doc = new DOMParser().parseFromString(await response.text(), 'text/html'),
        parseResult = doc.querySelector('.floating-sentence');

    const parsedWords = [];

    if (parseResult === null) {
        const errorReason = doc.querySelector('.container')?.childNodes[1]?.textContent.trim();
        console.error(`Couldn't parse ${text}, reason: ${errorReason}`);
        if (errorReason === 'No results found.') {
            // The sentence couldn't be parsed
            parsedWords.push({
                text: [{ base: text }],
                status: 'not-a-word',
            });
        } else {
            // Some other jpdb error ocurred
            return [{
                text,
                error: errorReason,
            }, JPDB_RATELIMIT * 1000];
        }
    } else {
        for (const div of parseResult.children) {
            const a = div.querySelector('a');
            if (a == null) {
                parsedWords.push({
                    text: [{ base: div.innerText }],
                    status: 'not-a-word',
                });
            } else {
                const parts = [];
                for (const childNode of a.childNodes) {
                    if (childNode.nodeType === Node.TEXT_NODE) {
                        parts.push({ base: childNode.textContent });
                    } else if (childNode.nodeType === Node.ELEMENT_NODE) {
                        parts.push({ base: childNode.childNodes[0].textContent, furi: childNode.childNodes[1].textContent });
                    }
                }
                const wordData = doc.querySelector(a.getAttribute('href'));
                const tags = wordData.querySelector('.tags');
                // TODO parse tags.children[0].innerText to get the level/redundancy of the card
                const status = tags && (tags.children.length >= 2) ? tags.children[0].classList[1] : 'none';
                parsedWords.push({
                    text: parts,
                    status,
                    dataHTML: wordData.innerHTML,
                });
            }
        }

        const firstWord = parsedWords[0].text[0],
            lastWord = parsedWords.at(-1).text.at(-1);

        firstWord.base = firstWord.base.replace('<…>', '')
        if (firstWord.base.length === 0)
            parsedWords.shift();

        lastWord.base = lastWord.base.replace('<…>', '')
        if (lastWord.base.length === 0)
            parsedWords.pop();

        console.log('sucessfully parsed', text, parsedWords);
    }

    const result = { text, words: parsedWords };

    const txn = db.transaction('paragraphs', 'readwrite');
    txn.objectStore('paragraphs').put(result);
    txn.commit();

    return [result, JPDB_RATELIMIT * 1000];
}

const pendingAPICalls = [];
let callerRunning = false;
function apiCall(obj) {
    pendingAPICalls.push(obj);
    if (!callerRunning) {
        callerRunning = true;
        setTimeout(apiCaller, 0);
    }
}

function apiCaller() {
    // If no API calls are pending, stop running
    if (pendingAPICalls.length === 0) {
        callerRunning = false;
        return;
    }

    // Get first call from queue
    const call = pendingAPICalls.shift();

    if (call.command === 'parse') {
        parseSentenceScrape(call.text)
            .then(([result, timeout]) => {
                setTimeout(apiCaller, timeout);
                call.resolve(result);
            })
            .catch(call.reject);

    } else {
        call.reject('Unknown command');
    }
}

let config = {
    wordCSS: localStorage.getItem('wordCSS') ?? `\
.jpdb-word[data-jpdb-status="not-a-word"] {}
.jpdb-word[data-jpdb-status="none"] { color: rgba(75, 141, 255, 0.8); }
.jpdb-word[data-jpdb-status="new"] { color: rgb(75, 141, 255); }
.jpdb-word[data-jpdb-status="learning"] { color: rgb(94, 167, 128); }
.jpdb-word[data-jpdb-status="known"] { color: rgb(112, 192, 0); }
.jpdb-word[data-jpdb-status="due"] { color: rgb(255, 69, 0); }
.jpdb-word[data-jpdb-status="failed"] { color: rgb(255, 0, 0); }
.jpdb-word[data-jpdb-status="blacklisted"] { color: rgb(119, 119, 119); }
.jpdb-word[data-jpdb-status="suspended"] { color: rgb(119, 119, 119); }
.jpdb-word[data-jpdb-status="locked"] { color: rgb(119, 119, 119); }`,
}

const tabs = new Set();

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    tabs.delete(tabId);
})

function notifyContentScripts(message) {
    for (const tabId of tabs)
        browser.tabs.sendMessage(tabId, message, function (response) { });
}

const db = await wrap(indexedDB.open('jpdb', 1), (obj, resolve, reject) => {
    obj.onsuccess = (event) => resolve(obj.result);
    obj.onerror = (event) => reject(obj.error);
    obj.onupgradeneeded = (event) => {
        console.log('Database upgrade');
        const db = event.target.result;
        db.createObjectStore('paragraphs', { keyPath: 'text' });
        db.createObjectStore('words', { keyPath: ['vid', 'sid', 'rid'] });

        // objectStore.createIndex("hours", "hours", { unique: false });
    };
});


browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Got message', message);
    switch (message.command) {
        case 'registerTab': {
            tabs.add(sender.tab.id)
            browser.tabs.insertCSS(sender.tab.id, { code: config.wordCSS });
            sendResponse(config);
            return false;
        }

        case 'getConfig': {
            sendResponse(config);
            return false;
        }

        case 'setConfig': {
            const oldCSS = config.wordCSS;
            config.wordCSS = message.config.wordCSS;
            localStorage.setItem('wordCSS', config.wordCSS);

            for (const tabId of tabs) {
                browser.tabs.insertCSS(tabId, { code: config.wordCSS });
                browser.tabs.removeCSS(tabId, { code: oldCSS });
            }

            notifyContentScripts({ command: "setConfig", config });
            return false;
        }

        case 'parse': {
            return new Promise((resolve, reject) => {
                apiCall({
                    command: 'parse',
                    text: message.text,
                    resolve, reject,
                });
            });
        }

        default:
            return false;
    }
});
