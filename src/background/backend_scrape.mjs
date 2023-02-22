const RATELIMIT = 1.1; // seconds between requests


export async function parse(text) {
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
            // The sentence didn't contain any words jpdb understood
            return [{ tokens: [], vocab: [] }, RATELIMIT];
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

                const meanings = [...wordData.querySelectorAll('.subsection-meanings .description')].map(
                    x => x.firstChild.textContent.replace(/^\d+\. /, '').trim())

                const tags = wordData.querySelector('.tags');
                // TODO parse tags.children[0].innerText to get the level/redundancy of the card
                const state = tags && (tags.children.length >= 2) ? [...tags.children[0].classList].slice(1) : ['not-in-deck'];

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
                    cardState: state,

                    // html: wordData.innerHTML,
                });
            }
        }
    }

    return [{ tokens, vocab }, RATELIMIT];
}

export async function review(vid, sid, rating) {

}

export async function addToForq(vid, sid, rating) {

}
