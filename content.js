'use strict';
(async () => {
    function innerTextNoFurigana(elem) {
        // let text = [];

        // for (const child of elem.childNodes) {
        //     if (child.nodeType === Node.TEXT_NODE) {
        //         text.push(child.textContent);
        //     } else if (child.nodeType === Node.ELEMENT_NODE) {
        //         for (const r of child.childNodes) {
        //             if (r.nodeType === Node.TEXT_NODE) || r.nodeType === Node.ELEMENT_NODE && r.tagName === 'RB') {
        //                 text.push(r.textContent);
        //             }
        //         }
        //     }
        // }

        // return text.join('');

        // elem = elem.cloneNode(true);
        const rts = elem.querySelectorAll('rt');
        rts.forEach(e => { e.style.display = 'none' });
        const text = elem.innerText;
        rts.forEach(e => { e.style.removeProperty('display') });
        return text;
    }

    function showPopup({ target: word }) {
        popup.innerHTML = word.dataHTML;
        popup.style.display = 'block';
    }

    function hidePopup() {
        popup.style.display = 'none';
    }

    function applyParseResult(paragraph, result) {
        if (result.words === undefined) {
            paragraph.classList.add('jpdb-parse-failed');
            console.error(result);
        } else if (result.words.length == 0) {
            paragraph.classList.add('jpdb-parse-failed');
            console.error(result);
        } else {
            paragraph.classList.add('jpdb-parse-done');
            const newParagraph = document.createElement('p');
            newParagraph.classList.add('jpdb-parse-done')
            newParagraph.style.position = 'relative';
            for (const word of result.words) {
                const span = document.createElement('span');
                span.classList.add('jpdb-word');
                span.dataset.jpdbStatus = word.status;
                // FIXME(Security) this is not properly escaped
                span.innerHTML = word.text.map(x => x.furi ? `<ruby><rb>${x.base}</rb><rt>${x.furi}</rt></ruby>` : x.base).join('');
                span.dataHTML = word.dataHTML;
                span.addEventListener('mouseenter', showPopup);
                span.addEventListener('mouseleave', hidePopup);
                newParagraph.insertAdjacentElement('beforeend', span);
            }

            // Work around ttu bug - it keeps references to the existing paragraph's text node,
            // and requests their position to figure out where to scroll when loading a bookmark.
            // We keep the existing paragraph, place it at the same position as the new paragraph,
            // and hide it.
            paragraph.insertAdjacentElement('beforebegin', newParagraph);
            newParagraph.insertAdjacentElement('beforeend', paragraph);
            // paragraph.style.opacity = '0.5';
            paragraph.style.visibility = 'hidden';
            paragraph.style.position = 'absolute';
            paragraph.style.top = '0';
            paragraph.style.right = '0';
            paragraph.style.zIndex = '-1'
        }
    }

    function wrap(obj, func) {
        return new Promise((resolve, reject) => { func(obj, resolve, reject) });
    }

    let parsingInProgress = false;
    const visibleParagraphs = new Set();
    async function jpdbParseSentence() {
        while (visibleParagraphs.size > 0) {
            // Get earliest (rightmost) paragraph
            const p = Array.from(visibleParagraphs.values()).reduce((a, b) => a.offsetLeft > b.offsetLeft ? a : b);
            visibleParagraphs.delete(p);
            paragraphOnScreenObserver.unobserve(p);

            const text = innerTextNoFurigana(p)
            console.log('parsing', text);

            const result = await browser.runtime.sendMessage({
                command: 'parse',
                text,
            });

            applyParseResult(p, result);
        }

        parsingInProgress = false;
    }
    function sentencesPending() {
        console.log('Sentences pending!')
        if (!parsingInProgress) {
            parsingInProgress = true;
            jpdbParseSentence();
        }
    }

    const paragraphOnScreenObserver = new IntersectionObserver((entries, observer) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                // console.log('Entered view:', entry.target, entry.target.innerText);
                visibleParagraphs.add(entry.target);
                sentencesPending();
            } else {
                // console.log('Left view:', entry.target, entry.target.innerText);
                visibleParagraphs.delete(entry.target);
            }
        }
    }, {
        rootMargin: '0px -100px 0px -100px',
    });

    function observeNewParagraph(p) {
        if (p.innerText.trim().length == 0)
            // Paragraph is empty
            return;

        if (p.classList.contains('ttu-img-container') || p.classList.contains('ttu-illustration-container'))
            // Paragraph is an image container, not text
            // FIXME sometimes, these contain text though.
            // Figure out some way to parse image countainers without including the spoiler text
            return;

        if (p.classList.contains('jpdb-parse-done'))
            // Already parsed
            return;

        paragraphOnScreenObserver.observe(p);
    }

    document.body.insertAdjacentHTML('beforeend', `
<div id=jpdb-popup style="display:none;top:0;left:0;">
</div>
`);
    const popup = document.querySelector('#jpdb-popup');

    document.querySelectorAll('p').forEach(observeNewParagraph);

    const newParagraphObserver = new MutationObserver((mutations, observer) => {
        for (const mutation of mutations) {
            if (mutation.type !== 'childList')
                continue;

            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE)
                    continue;

                if (node.nodeName === 'p')
                    observeNewParagraph(node);
                else
                    node.querySelectorAll('p').forEach(observeNewParagraph);
            }
        }
    });

    newParagraphObserver.observe(document.body, {
        subtree: true,
        childList: true,
    });

    let config = await browser.runtime.sendMessage({ command: 'registerTab' });

    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Got message', message);

        switch (message.command) {
            case 'setConfig': {
                config = message.config;
                return false;
            }

            default:
                return false;
        }
    });
})();
