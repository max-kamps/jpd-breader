'use strict';
(async () => {
    function textFragments(elem, offset = 0) {
        console.log(offset, elem.outerHTML);

        let fragments = [];

        for (const child of elem.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                const length = [...child.textContent].length;

                fragments.push({
                    node: child,
                    text: child.textContent,
                    length,
                    offset,
                    furi: null,
                });

                offset += length;
            }
            else if (child.nodeType === Node.ELEMENT_NODE) {
                // TODO Skip spoiler text in images
                if (child.tagName === 'RUBY') {
                    const bases = [], rubies = [];

                    for (const rubyChild of rubyChild.childNodes) {
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
                    // Ruby text - Furigana
                    const length = bases.reduce((s, n) => s + n);
                    fragments.push({
                        node: child,
                        text: bases.join(''),
                        length,
                        offset,
                        furi: bases.map((base, i) => [base, rubies[i]]),
                    });

                    offset += length;
                }
                else {
                    fragments.push(...textFragments(child, offset));
                }
            }
        }

        console.log(offset, fragments);
        return fragments;
    }

    function showPopup({ target: word }) {
        popup.innerHTML = word.dataHTML;
        popup.style.display = 'block';

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

        popup.style.left = `${box.right}px`;
        popup.style.top = `${box.bottom}px`;
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

            const fragments = textFragments(p);

            if (fragments.length > 0) {
                const text = fragments.map(x => x.text).join('');
                
                console.log('parsing', text);
                
                const result = await browser.runtime.sendMessage({
                    command: 'parse',
                    text,
                });
    
                applyParseResult(p, result);
            }
            else {
                // TODO make paragraph completed
            }
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
