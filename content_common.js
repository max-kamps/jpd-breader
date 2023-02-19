'use strict';

function html(strings, ...substitutions) {
    var template = document.createElement('template');
    template.innerHTML = String.raw(strings, ...substitutions).trim();
    return template.content.firstElementChild;
}

let config;
let _popup;

function getPopup() {
    if (!_popup) {
        _popup = html`<div id=jpdb-popup style="all:initial;position:absolute;z-index:1000;opacity:0;visibility:hidden;top:0;left:0;"></div>`;
        const shadow = _popup.attachShadow({ mode: 'closed' });
        shadow.appendChild(html`<style>${config.popupCSS}</style>`)
        shadow.appendChild(html`<article></article>`);

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
            shadow.lastChild.innerHTML = `
                <h1>
                    <span class=spelling>${data.spelling}</span>
                    ${(data.spelling !== data.reading) ? `<span class=reading>(${data.reading})</span>` : ''}
                    <div class=state>${data.cardState.map(s => `<span class=${s}>${s}</span>`).join('')}</div>
                </h1>
                <small>id: ${data.vid ?? '???'} / ${data.sid ?? '???'} / ${data.rid ?? '???'}</small>
                <ol>${data.meanings.map(gloss => `<li>${gloss}</li>`).join('')}</ol>`;
        }
    }

    return _popup;
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

    word.style.position = 'relative';
    word.appendChild(popup);

    const box = word.getBoundingClientRect();

    // TODO choose position more cleverly
    // const {writingMode} = getComputedStyle(word);
    // const rightSpace = window.clientWidth - box.left - box.width,
    //     bottomSpace = window.clientHeight - box.top - box.height;

    // if (writingMode.startsWith('horizontal')) {
    //     if (box.top < bottomSpace)
    //         ...
    // } else {
    //     if (box.left < rightSpace)
    //         ...
    // }

    popup.style.left = `${box.width}px`;
    popup.style.top = `${box.height}px`;

    // popup.innerHTML = [...Object.entries(word.vocabData)].map(([key, value]) => `<b>${key}</b>: ${value}`).join('<br>');
    popup.setContent(word.vocabData);
    popup.fadeIn();
}

function hidePopup({ target: word }) {
    getPopup().fadeOut();
}

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
    return parts.map(x => (typeof x === 'string') ? x : `<ruby><rb>${x[0]}</rb><rt>${x[1]}</rt></ruby>`).join('');
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

function wrap(obj, func) {
    return new Promise((resolve, reject) => { func(obj, resolve, reject) });
}
