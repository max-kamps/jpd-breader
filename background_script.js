const JPDB_RATELIMIT = 1.1; // seconds between requests

function wrap(obj, func) {
    return new Promise((resolve, reject) => {func(obj, resolve, reject)});
}

async function parseSentence(text) {
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

    const resp = await fetch(
            `https://jpdb.io/search?q=<…>${text}<…>`,
            {credentials: 'include'}
          ),
          doc = new DOMParser().parseFromString(await resp.text(), 'text/html');

    const parseResult = doc.querySelector('.floating-sentence');
    const parsedWords = [];

    if (parseResult === null) {
        const errorReason = doc.querySelector('.container')?.childNodes[1]?.textContent;
        console.error(`Couldn't parse ${text}, reason: ${errorReason}`);
        return [{
            text,
            error: errorReason,
        }, JPDB_RATELIMIT * 1000]
    }
    
    for (const div of parseResult.children) {
        const a = div.querySelector('a');
        if (a == null) {
            parsedWords.push({
                text: [{base: div.innerText}],
                status: 'None',
            });
        } else {
            const parts = [];
            for (const childNode of a.childNodes) {
                if (childNode.nodeType === Node.TEXT_NODE) {
                    parts.push({base: childNode.textContent});
                } else if (childNode.nodeType === Node.ELEMENT_NODE) {
                    parts.push({base: childNode.childNodes[0].textContent, furi: childNode.childNodes[1].textContent});
                }	
            }
            const wordData = doc.querySelector(a.getAttribute('href'));
            const tags = wordData.querySelector('.tags');
            const status = tags && (tags.children.length >= 2) ? `${tags.children[0].classList[1]} ${tags.children[0].innerText}` : 'None';
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

    const result = {text, words: parsedWords};

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
        parseSentence(call.text)
            .then(([result, timeout]) => {
                setTimeout(apiCaller, timeout);
                call.resolve(result);
            })
            .catch(call.reject);

    } else {
        call.reject('Unknown command');
    }
}

const db = await wrap(indexedDB.open('jpdb', 1), (obj, resolve, reject) => {
    obj.onsuccess = (event) => resolve(obj.result);
    obj.onerror = (event) => reject(obj.error);
    obj.onupgradeneeded = (event) => {
        console.log('Database upgrade');
        const db = event.target.result;
        db.createObjectStore("paragraphs", { keyPath: "text" });
        db.createObjectStore("words", { keyPath: "id" });
        
        // objectStore.createIndex("hours", "hours", { unique: false });
    };
});

browser.runtime.onMessage.addListener((message, callback) => {
    console.log('Got message', message)
    if (message.command === "parse") {
        return new Promise((resolve, reject) => {
            apiCall({
                command: 'parse',
                text: message.text,
                resolve, reject,
            });
        });
    } else
        return false;
});
