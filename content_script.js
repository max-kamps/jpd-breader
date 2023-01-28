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
    rts.forEach(e => {e.style.display = 'none'});
    const text = elem.innerText;
    rts.forEach(e => {e.style.removeProperty('display')});
    return text;
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
        // FIXME(Security) this is not properly escaped
        const textHtml = result.words.map(word => `<span data-jpdb-status="${word.status}">${word.text.map(x => x.furi ? `<ruby><rb>${x.base}</rb><rt>${x.furi}</rt></ruby>` : x.base).join('')}</span>`).join('');
        console.log('replacing html', paragraph.innerHTML, textHtml)
        paragraph.innerHTML = textHtml;
    }
}

function wrap(obj, func) {
    return new Promise((resolve, reject) => {func(obj, resolve, reject)});
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
        return     
    
    paragraphOnScreenObserver.observe(p);
}

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
