'use strict';


// Utility functions

function wrap(obj, func) {
    return new Promise((resolve, reject) => { func(obj, resolve, reject) });
}

function html(strings, ...substitutions) {
    var template = document.createElement('template');
    template.innerHTML = String.raw(strings, ...substitutions).trim();
    return template.content.firstElementChild;
}


// Popup-related functions

let _popup;
function getPopup(addListeners = true) {
    if (!_popup) {
        _popup = html`<div id=jpdb-popup style="all:initial;position:absolute;z-index:1000;opacity:0;visibility:hidden;top:0;left:0;"></div>`;
        const shadow = _popup.attachShadow({ mode: 'closed' });
        shadow.innerHTML = `
            <style>${config.popupCSS}</style>
            <article lang=ja>
                <section class=mine-buttons>
                    Mine:
                    <button class=add>Add to deck...</button>
                    <button class=blacklist>Blacklist</button>
                    <button class=never-forget>Never Forget</button>
                </section>
                <section class=mine-buttons>
                    Review:
                    <button class=nothing>Nothing</button>
                    <button class=something>Something</button>
                    <button class=hard>Hard</button>
                    <button class=good>Good</button>
                    <button class=easy>Easy</button>
                </section>
                <section id=vocab-content></section>
            </article>`;

        shadow.vocabSection = shadow.querySelector('#vocab-content');


        if (addListeners) {
            shadow.querySelector('button.add').addEventListener('click', () => {
                showDialog(shadow.data);
            });

            function doMine(command) {
                postMessage({ command, vid: shadow.data.vid, sid: shadow.data.sid });
            }

            shadow.querySelector('button.blacklist').addEventListener('click', () => { doMine('addToBlacklist'); });
            shadow.querySelector('button.never-forget').addEventListener('click', () => { doMine('addToNeverForget'); });

            function doReview(rating) {
                postMessage({ command: 'review', rating, vid: shadow.data.vid, sid: shadow.data.sid });
            }

            shadow.querySelector('button.nothing').addEventListener('click', () => { doReview('nothing'); });
            shadow.querySelector('button.something').addEventListener('click', () => { doReview('something'); });
            shadow.querySelector('button.hard').addEventListener('click', () => { doReview('hard'); });
            shadow.querySelector('button.good').addEventListener('click', () => { doReview('good'); });
            shadow.querySelector('button.easy').addEventListener('click', () => { doReview('easy'); });

            _popup.addEventListener('mouseenter', ({ target }) => target.fadeIn());
            _popup.addEventListener('mouseleave', ({ target }) => target.fadeOut());
        }

        _popup.fadeIn = () => {
            _popup.style.transition = 'opacity 60ms ease-in, visibility 60ms';
            _popup.style.opacity = 1;
            _popup.style.visibility = 'visible';
        }

        _popup.fadeOut = () => {
            _popup.style.transition = 'opacity 200ms ease-in, visibility 200ms';
            _popup.style.opacity = 0;
            _popup.style.visibility = 'hidden';
        }

        _popup.setContent = (data) => {
            shadow.data = data;
            shadow.vocabSection.innerHTML = `
                <div class=header>
                    <span class=spelling>${data.spelling}</span>
                    ${(data.spelling !== data.reading) ? `<span class=reading>(${data.reading})</span>` : ''}
                    <div class=state>${data.cardState.map(s => `<span class=${s}>${s}</span>`).join('')}</div>
                </div>
                <small>id: ${data.vid ?? '???'} / ${data.sid ?? '???'} / ${data.rid ?? '???'}</small>
                <ol>${data.meanings.map(gloss => `<li>${gloss}</li>`).join('')}</ol>`;
        }

        document.body.appendChild(_popup);
    }

    return _popup;
}

let _dialog;
function getDialog() {
    if (!_dialog) {
        _dialog = html`<dialog id=jpdb-dialog style="all:revert;padding:0;border:none;background-color:transparent;"><div style="all:initial;"></div></dialog>`;
        const shadow = _dialog.lastChild.attachShadow({ mode: 'closed' });
        shadow.innerHTML = `
            <style>${config.dialogCSS}</style>
            <article lang=ja>
                <div id=header></div>
                <div>
                    <label for=sentence>Sentence:</label>
                    <div id=sentence role=textbox contenteditable></div>
                    <button id=add-context>Add surrounding sentences</button>
                </div>
                <div>
                    <label for=sentence>Translation:</label>
                    <div id=translation role=textbox contenteditable></div>
                </div>
                <div>
                    <label>Also add to FORQ: <input type=checkbox id=add-to-forq></label>
                </div>
                <div>
                    <button class=cancel>Cancel</button>
                    <button class=add>Add</button>
                <div>
                    Add and review
                    <button class=nothing>Nothing</button>
                    <button class=something>Something</button>
                    <button class=hard>Hard</button>
                    <button class=good>Good</button>
                    <button class=easy>Easy</button>
                </div>
            </article>`;

        const header = shadow.querySelector('#header');
        const sentence = shadow.querySelector('#sentence');

        shadow.querySelector('button.cancel').addEventListener('click', () => {
            _dialog.close();
        });

        // We can't use click because then mousedown inside the content and mouseup outside would count as a click
        _dialog.addEventListener('mousedown', ({ target }) => {
            // Click on the dialog, but not on any children
            // That must mean the user clicked on the background outside of the dialog
            _dialog.wasClicked = (target === _dialog)
        });
        _dialog.addEventListener('mouseup', ({ target }) => {
            if (_dialog.wasClicked && (target === _dialog))
                _dialog.close();

            _dialog.wasClicked = false;
        });

        shadow.querySelector('button.add').addEventListener('click', ({ target }) => {
            // TODO
            _dialog.close();
        });

        function rerender() {
            const data = shadow.data;
            const contextWidth = shadow.contextWidth;

            // FIXME(Security) not escaped
            header.innerHTML = `<span class=spelling>${data.spelling}</span>${(data.spelling !== data.reading) ? `<span class=reading>(${data.reading})</span>` : ''}`

            if (data.sentenceBreaks === undefined) {
                data.sentenceBreaks = [...data.fullText.matchAll(/[。！？]/g)].map(match => match.index);
                data.sentenceBreaks.unshift(-1);
                data.sentenceBreaks.push(data.fullText.length);

                // Bisect_right to find the array index of the enders to the left and right of our token
                let left = 0, right = data.sentenceBreaks.length;
                while (left < right) {
                    const middle = (left + right) >> 1;
                    if (data.sentenceBreaks[middle] <= data.textPos) {
                        left = middle + 1;
                    }
                    else {
                        right = middle;
                    }
                }

                data.sentenceIndex = left;
            }

            const start = data.sentenceBreaks[Math.max(data.sentenceIndex - 1 - contextWidth, 0)] + 1;
            const end = data.sentenceBreaks[Math.min(data.sentenceIndex + contextWidth, data.sentenceBreaks.length - 1)] + 1;

            sentence.innerText = data.fullText.slice(start, end).trim();
        }

        shadow.querySelector('#add-context').addEventListener('click', () => {
            shadow.contextWidth++;
            rerender();
        });

        _dialog.setContent = (data) => {
            shadow.data = data;
            shadow.contextWidth = 0;
            rerender();
        }

        document.body.appendChild(_dialog);
    }

    return _dialog;
}

function showDialog(data) {
    const dialog = getDialog();
    dialog.setContent(data);
    dialog.showModal();
}

function showPopup({ target: word }) {
    let popup = getPopup();

    if (word.lastChild === popup) {
        // popup already in this word
        popup.fadeIn();
        return;
    }

    if (word.vocabData === undefined)
        return;

    const box = word.getBoundingClientRect();

    const { writingMode } = getComputedStyle(word);

    const rightSpace = window.innerWidth - box.left - box.width,
        bottomSpace = window.innerHeight - box.top - box.height;

    if (writingMode.startsWith('horizontal')) {
        popup.style.left = `${box.left + window.scrollX}px`;
        popup.style.removeProperty('right');

        if (box.top < bottomSpace) {
            popup.style.top = `${box.bottom + window.scrollY}px`;
            popup.style.removeProperty('bottom');
        }
        else {
            popup.style.bottom = `${window.innerHeight - box.top + window.scrollY}px`;
            popup.style.removeProperty('top');
        }
    } else {
        popup.style.top = `${box.top + window.scrollY}px`;
        popup.style.removeProperty('bottom');

        if (box.left < rightSpace) {
            popup.style.left = `${box.right + window.scrollX}px`;
            popup.style.removeProperty('right');
        }
        else {
            popup.style.right = `${window.innerWidth - box.left + window.scrollX}px`;
            popup.style.removeProperty('left');
        }
    }

    // popup.innerHTML = [...Object.entries(word.vocabData)].map(([key, value]) => `<b>${key}</b>: ${value}`).join('<br>');
    popup.setContent(word.vocabData);
    popup.fadeIn();
}

function hidePopup({ target: word }) {
    getPopup().fadeOut();
}


// Parsing-related functions

function textFragments(nodes) {
    // Get a list of fragments (text nodes along with metainfo) contained in the given nodes
    let fragments = [];
    let offset = 0;

    for (const node of nodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            const length = text.length;
            fragments.push({ node, text, length, offset, furi: null });
            offset += length;
        }
        else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'RUBY') {
            const bases = [], rubies = [];

            for (const rubyChild of node.childNodes) {
                if (rubyChild.nodeType === Node.TEXT_NODE) {
                    bases.push(rubyChild.textContent);
                }
                else if (rubyChild.nodeType === Node.ELEMENT_NODE) {
                    if (rubyChild.tagName === 'RB') {
                        bases.push(rubyChild.textContent);
                    }
                    else if (rubyChild.tagName === 'RT') {
                        rubies.push(rubyChild.textContent);
                    }
                }
            }
            const text = bases.join('');
            const length = text.length;
            const furi = bases.map((base, i) => [base, rubies[i]]);

            fragments.push({ node, text, length, offset, furi });
            offset += length;
        }
    }

    return fragments;
}

function furiganaToRuby(parts) {
    return parts.map(x => (typeof x === 'string') ? x : `<ruby>${x[0]}<rt>${x[1]}</rt></ruby>`).join('');
}

function replaceNode(original, replacement, keepOriginal = false) {
    console.log('Replacing:', original, 'with', replacement);

    if (!keepOriginal) {
        original.parentNode.replaceChild(replacement, original);
    }
    else {
        replacement.style.position = 'relative';
        original.parentNode.replaceChild(replacement, original);

        const wrapper = html`<span class="jpdb-ttu-wrapper" style="position:absolute;top:0;right:0;visibility:hidden"></span>`;
        wrapper.appendChild(original);

        replacement.appendChild(wrapper);
    }
}

function applyParseResult(fragments, result, keepTextNodes = false) {
    // keep_text_nodes is a workaround for a ttu issue.
    //   Ttu returns to your bookmarked position at load time. 
    //   To do that, it scrolls to a specific text node.
    //   If we delete those nodes, it will crash on load when a bookmark exists.
    //   Instead, we keep the existing elements by making them invisible,
    //   and positioning them at the top right corner of our new element.
    // TODO position at top left for horizontal writing
    console.log('Applying results:', fragments, result);
    const { tokens, vocab } = result;
    let tokenIndex = 0;
    let fragmentIndex = 0;
    let curOffset = 0;
    let replacement;
    const text = fragments.map(x => x.text).join('')

    while (true) {
        if (tokenIndex >= tokens.length || fragmentIndex >= fragments.length) {
            break;
        }

        if (replacement === undefined)
            replacement = html`<span class="jpdb-parsed"></span>`;

        const fragment = fragments[fragmentIndex];
        const token = tokens[tokenIndex];
        const word = vocab[token.vocabularyIndex];

        // console.log('Fragment', fragment.text, `at ${fragment.offset}:${fragment.offset + fragment.length}`, fragment);
        const spelling = token.furigana.map(p => (typeof p === 'string') ? p : p[0]).join('');
        const reading = token.furigana.map(p => (typeof p === 'string') ? p : p[1]).join('');
        // console.log('Token', `${reading}（${spelling}）`, `at ${token.positionUtf16}:${token.positionUtf16 + token.lengthUtf16}`, token);

        if (curOffset >= fragment.offset + fragment.length) {
            replaceNode(fragment.node, replacement, keepTextNodes);
            replacement = undefined;
            fragmentIndex++;
            // console.log('Got to end of fragment, next fragment');
            continue;
        }

        if (curOffset >= token.positionUtf16 + token.lengthUtf16) {
            tokenIndex++;
            // console.log('Got to end of token, next token');
            continue;
        }

        // curOffset is now guaranteed to be inside a fragment, and either before or inside of a token
        if (curOffset < token.positionUtf16) {
            // There are no tokens at the current offset - emit the start of the fragment unparsed
            const headString = fragment.text.slice(curOffset - fragment.offset, token.positionUtf16 - fragment.offset);
            // FIXME(Security) Not escaped
            replacement.appendChild(html`<span class="jpdb-word unparsed">${headString}</span>`);
            curOffset += headString.length;
            // console.log('Emitted unparsed string', headString);
            continue;
        }

        {
            // There is a guaranteed token at the current offset
            // TODO maybe add sanity checks here to make sure the parse is plausible?
            // TODO take into account fragment furigana
            // TODO Token might overlap end of fragment... Figure out this edge case later

            // FIXME(Security) Not escaped
            const elem = html`<span class="jpdb-word ${word.cardState.join(' ')}">${furiganaToRuby(token.furigana)}</span>`;
            elem.vocabData = word;
            elem.vocabData.fullText = text;
            elem.vocabData.textPos = curOffset;
            elem.addEventListener('mouseenter', showPopup);
            elem.addEventListener('mouseleave', hidePopup);
            replacement.appendChild(elem);
            curOffset += token.lengthUtf16;
            // console.log('Emitted token');
            continue;
        }
    }

    // There might be trailing text not part of any tokens - emit it unparsed
    if (fragmentIndex < fragments.length) {
        let fragment = fragments[fragmentIndex];
        if (curOffset < fragment.offset + fragment.length) {
            const tailString = fragment.text.slice(curOffset - fragment.offset);

            // FIXME(Security) Not escaped
            replacement.appendChild(html`<span class="jpdb-word unparsed">${tailString}</span>`);
            // console.log('Emitted unparsed tail', tailString);
            replaceNode(fragment.node, replacement, keepTextNodes);
        }
    }

}

// Background script communication

let config = {};

const waitingPromises = new Map();
let nextSeq = 0;

function postMessage(message) {
    port.postMessage(message);
}

function postRequest(message) {
    message.seq = nextSeq++;
    return new Promise((resolve, reject) => {
        waitingPromises.set(message.seq, { resolve, reject });
        port.postMessage(message);
    });
}

const port = browser.runtime.connect();
port.onDisconnect.addListener(() => {
    console.error('disconnect:', port);
});
port.onMessage.addListener((message, port) => {
    console.log('message:', message, port);

    switch (message.command) {
        case 'response': {
            const promise = waitingPromises.get(message.seq);
            waitingPromises.delete(message.seq);
            if (message.error === undefined)
                promise.resolve(message.result);
            else
                promise.reject(message.error);
        } break;

        case 'updateConfig': {
            Object.assign(config, message.config);
        } break;

        default:
            console.error('Unknown command');
    }
});
