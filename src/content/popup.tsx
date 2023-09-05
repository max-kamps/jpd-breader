import { browser, clamp, nonNull } from '../util.js';
import { jsxCreateElement } from '../jsx.js';
import { config, requestMine, requestReview, requestSetFlag } from './background_comms.js';
import { Dialog } from './dialog.js';
import { getSentences, JpdbWord, JpdbWordData } from './word.js';

const PARTS_OF_SPEECH: { [k: string]: string } = {
    n: 'Noun', // JMDict: "noun (common) (futsuumeishi)"
    pn: 'Pronoun', // JMDict: "pronoun"
    pref: 'Prefix', // JMDict: "prefix"
    suf: 'Suffix', // JMDict: "suffix"
    // 'n-adv': '', // Not used in jpdb: n + adv instead. JMDict: "adverbial noun (fukushitekimeishi)"
    // 'n-pr': '', // Not used in jpdb: name instead. JMDict: "proper noun"
    // 'n-pref': '', // Not used in jpdb: n + pref instead. JMDict: "noun, used as a prefix"
    // 'n-suf': '', // Not used in jpdb: n + suf instead. JMDict: "noun, used as a suffix"
    // 'n-t': '', // Not used in jpdb: n instead. JMDict: "noun (temporal) (jisoumeishi)"

    // 'n-pr': '', // JMDict: "proper noun"
    name: 'Name', // Not from JMDict
    'name-fem': 'Name (Feminine)', // Not from JMDict
    'name-male': 'Name (Masculine)', // Not from JMDict
    'name-surname': 'Surname', // Not from JMDict
    'name-person': 'Personal Name', // Not from JMDict
    'name-place': 'Place Name', // Not from JMDict
    'name-company': 'Company Name', // Not from JMDict
    'name-product': 'Product Name', // Not from JMDict

    'adj-i': 'Adjective', // JMDict: "adjective (keiyoushi)"
    'adj-na': 'な-Adjective', // JMDict: "adjectival nouns or quasi-adjectives (keiyodoshi)"
    'adj-no': 'の-Adjective', // JMDict: "nouns which may take the genitive case particle 'no'"
    'adj-pn': 'Adjectival', // JMDict: "pre-noun adjectival (rentaishi)"
    'adj-nari': 'なり-Adjective (Archaic/Formal)', // JMDict: "archaic/formal form of na-adjective"
    'adj-ku': 'く-Adjective (Archaic)', // JMDict: "'ku' adjective (archaic)"
    'adj-shiku': 'しく-Adjective (Archaic)', // JMDict: "'shiku' adjective (archaic)"
    // 'adj-ix': 'Adjective (いい/よい irregular)', // Not used in jpdb, adj-i instead. JMDict: "adjective (keiyoushi) - yoi/ii class"
    // 'adj-f': '', // Not used in jpdb. JMDict: "noun or verb acting prenominally"
    // 'adj-t': '', // Not used in jpdb. JMDict: "'taru' adjective"
    // 'adj-kari': '', // Not used in jpdb. JMDict: "'kari' adjective (archaic)"

    adv: 'Adverb', // JMDict: "adverb (fukushi)"
    // 'adv-to': '', // Not used in jpdb: adv instead. JMDict: "adverb taking the `to' particle"

    aux: 'Auxiliary', // JMDict: "auxiliary"
    'aux-v': 'Auxiliary Verb', // JMDict: "auxiliary verb"
    'aux-adj': 'Auxiliary Adjective', // JMDict: "auxiliary adjective"
    conj: 'Conjunction', // JMDict: "conjunction"
    cop: 'Copula', // JMDict: "copula"
    ctr: 'Counter', // JMDict: "counter"
    exp: 'Expression', // JMDict: "expressions (phrases, clauses, etc.)"
    int: 'Interjection', // JMDict: "interjection (kandoushi)"
    num: 'Numeric', // JMDict: "numeric"
    prt: 'Particle', // JMDict: "particle"
    // 'cop-da': '',  // Not used in jpdb: cop instead. JMDict: "copula"

    vt: 'Transitive Verb', // JMDict: "transitive verb"
    vi: 'Intransitive Verb', // JMDict: "intransitive verb"

    v1: 'Ichidan Verb', // JMDict: "Ichidan verb"
    'v1-s': 'Ichidan Verb (くれる Irregular)', // JMDict: "Ichidan verb - kureru special class"

    v5: 'Godan Verb', // Not from JMDict
    v5u: 'う Godan Verb', // JMDict: "Godan verb with `u' ending"
    'v5u-s': 'う Godan Verb (Irregular)', // JMDict: "Godan verb with `u' ending (special class)"
    v5k: 'く Godan Verb', // JMDict: "Godan verb with `ku' ending"
    'v5k-s': 'く Godan Verb (いく/ゆく Irregular)', // JMDict: "Godan verb - Iku/Yuku special class"
    v5g: 'ぐ Godan Verb', // JMDict: "Godan verb with `gu' ending"
    v5s: 'す Godan Verb', // JMDict: "Godan verb with `su' ending"
    v5t: 'つ Godan Verb', // JMDict: "Godan verb with `tsu' ending"
    v5n: 'ぬ Godan Verb', // JMDict: "Godan verb with `nu' ending"
    v5b: 'ぶ Godan Verb', // JMDict: "Godan verb with `bu' ending"
    v5m: 'む Godan Verb', // JMDict: "Godan verb with `mu' ending"
    v5r: 'る Godan Verb', // JMDict: "Godan verb with `ru' ending"
    'v5r-i': 'る Godan Verb (Irregular)', // JMDict: "Godan verb with `ru' ending (irregular verb)"
    v5aru: 'る Godan Verb (-ある Irregular)', // JMDict: "Godan verb - -aru special class"
    // 'v5uru': '', // JMDict: "Godan verb - Uru old class verb (old form of Eru)"

    vk: 'Irregular Verb (くる)', // JMDict: "Kuru verb - special class"
    // vn: '', // Not used in jpdb. JMDict: "irregular nu verb"
    // vr: '', // Not used in jpdb. JMDict: "irregular ru verb, plain form ends with -ri"

    vs: 'する Verb', // JMDict: "noun or participle which takes the aux. verb suru"
    vz: 'ずる Verb', // JMDict: "Ichidan verb - zuru verb (alternative form of -jiru verbs)"
    'vs-c': 'す Verb (Archaic)', // JMDict: "su verb - precursor to the modern suru"
    // 'vs-s': '', // Not used in jpdb. JMDict: "suru verb - special class"
    // 'vs-i': '', // JMDict: "suru verb - included"

    // iv: '',  // Not used in jpdb. JMDict: "irregular verb"
    // 'v-unspec': '', // Not used in jpdb. JMDIct: "verb unspecified"

    v2: 'Nidan Verb (Archaic)', // Not from JMDict
    // 'v2a-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb with 'u' ending (archaic)"
    // 'v2b-k': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (upper class) with 'bu' ending (archaic)"
    // 'v2b-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'bu' ending (archaic)"
    // 'v2d-k': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (upper class) with 'dzu' ending (archaic)"
    // 'v2d-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'dzu' ending (archaic)"
    // 'v2g-k': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (upper class) with 'gu' ending (archaic)"
    // 'v2g-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'gu' ending (archaic)"
    // 'v2h-k': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (upper class) with 'hu/fu' ending (archaic)"
    // 'v2h-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'hu/fu' ending (archaic)"
    // 'v2k-k': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (upper class) with 'ku' ending (archaic)"
    // 'v2k-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'ku' ending (archaic)"
    // 'v2m-k': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (upper class) with 'mu' ending (archaic)"
    // 'v2m-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'mu' ending (archaic)"
    // 'v2n-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'nu' ending (archaic)"
    // 'v2r-k': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (upper class) with 'ru' ending (archaic)"
    // 'v2r-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'ru' ending (archaic)"
    // 'v2s-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'su' ending (archaic)"
    // 'v2t-k': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (upper class) with 'tsu' ending (archaic)"
    // 'v2t-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'tsu' ending (archaic)"
    // 'v2w-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'u' ending and 'we' conjugation (archaic)"
    // 'v2y-k': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (upper class) with 'yu' ending (archaic)"
    // 'v2y-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'yu' ending (archaic)"
    // 'v2z-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'zu' ending (archaic)"

    v4: 'Yodan Verb (Archaic)', // Not from JMDict
    v4k: '', // JMDict: "Yodan verb with 'ku' ending (archaic)"
    v4g: '', // JMDict: "Yodan verb with 'gu' ending (archaic)"
    v4s: '', // JMDict: "Yodan verb with 'su' ending (archaic)"
    v4t: '', // JMDict: "Yodan verb with 'tsu' ending (archaic)"
    v4h: '', // JMDict: "Yodan verb with `hu/fu' ending (archaic)"
    v4b: '', // JMDict: "Yodan verb with 'bu' ending (archaic)"
    v4m: '', // JMDict: "Yodan verb with 'mu' ending (archaic)"
    v4r: '', // JMDict: "Yodan verb with 'ru' ending (archaic)"
    // v4n: '', // Not used in jpdb. JMDict: "Yodan verb with 'nu' ending (archaic)"

    va: 'Archaic', // Not from JMDict? TODO Don't understand this one, seems identical to #v4n ?

    // 'unc': '', // Not used in jpdb: empty list instead. JMDict: "unclassified"
};

function getClosestClientRect(elem: HTMLElement, x: number, y: number): DOMRect {
    const rects = elem.getClientRects();

    if (rects.length === 1) return rects[0];

    // Merge client rects that are adjacent
    // This works around a Chrome issue, where sometimes, non-deterministically,
    // inline child elements will get separate client rects, even if they are on the same line.

    const { writingMode } = getComputedStyle(elem);
    const horizontal = writingMode.startsWith('horizontal');

    const mergedRects: DOMRect[] = [];
    for (const rect of rects) {
        if (mergedRects.length === 0) {
            mergedRects.push(rect);
            continue;
        }

        const prevRect = mergedRects[mergedRects.length - 1];

        if (horizontal) {
            if (rect.bottom === prevRect.bottom && rect.left === prevRect.right) {
                mergedRects[mergedRects.length - 1] = new DOMRect(
                    prevRect.x,
                    prevRect.y,
                    rect.right - prevRect.left,
                    prevRect.height,
                );
            } else {
                mergedRects.push(rect);
            }
        } else {
            if (rect.right === prevRect.right && rect.top === prevRect.bottom) {
                mergedRects[mergedRects.length - 1] = new DOMRect(
                    prevRect.x,
                    prevRect.y,
                    prevRect.width,
                    rect.bottom - prevRect.top,
                );
            } else {
                mergedRects.push(rect);
            }
        }
    }

    // Debugging this was a nightmare, so I'm leaving this debug code here

    // console.log(rects);
    // console.log(mergedRects);

    // document.querySelectorAll('Rect').forEach(x => x.parentElement?.removeChild(x));
    // document.body.insertAdjacentHTML(
    //     'beforeend',
    //     mergedRects
    //         .map(
    //             (rect, i) =>
    //                 `<Rect style="position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;background-color:rgba(255,0,0,0.3);box-sizing:border-box;border:solid black 1px;pointer-events:none;">${i}</Rect>`,
    //         )
    //         .join(''),
    // );

    return mergedRects
        .map(rect => ({
            rect,
            distance: Math.max(rect.left - x, 0, x - rect.right) ** 2 + Math.max(rect.top - y, 0, y - rect.bottom) ** 2,
        }))
        .reduce((a, b) => (a.distance <= b.distance ? a : b)).rect;
}

function renderPitch(reading: string, pitch: string) {
    if (reading.length != pitch.length - 1) {
        return <span>Error: invalid pitch</span>;
    }

    try {
        const parts: HTMLSpanElement[] = [];
        let lastBorder = 0;
        const borders = Array.from(pitch.matchAll(/L(?=H)|H(?=L)/g), x => nonNull(x.index) + 1);
        let low = pitch[0] === 'L';

        for (const border of borders) {
            parts.push(<span class={low ? 'low' : 'high'}>{reading.slice(lastBorder, border)}</span>);
            lastBorder = border;
            low = !low;
        }

        if (lastBorder != reading.length) {
            // No switch after last part
            parts.push(<span class={low ? 'low-final' : 'high-final'}>{reading.slice(lastBorder)}</span>);
        }

        return <span class='pitch'>{parts}</span>;
    } catch (error) {
        console.error(error);
        return <span>Error: invalid pitch</span>;
    }
}

export class Popup {
    #demoMode: boolean;
    #element: HTMLElement;
    #customStyle: HTMLElement;
    #outerStyle: CSSStyleDeclaration;
    #vocabSection: HTMLElement;
    #mineButtons: HTMLElement;
    #data: JpdbWordData;

    static #popup: Popup;

    static get(): Popup {
        if (!this.#popup) {
            this.#popup = new this();
            document.body.append(this.#popup.#element);
        }

        return this.#popup;
    }

    static getDemoMode(parent: HTMLElement): Popup {
        const popup = new this(true);
        parent.append(popup.#element);
        return popup;
    }

    constructor(demoMode = false) {
        this.#demoMode = demoMode;

        this.#element = (
            <div
                id='jpdb-popup'
                onmousedown={event => {
                    event.stopPropagation();
                }}
                onclick={event => {
                    event.stopPropagation();
                }}
                onwheel={event => {
                    event.stopPropagation();
                }}
                style={`all:initial;z-index:2147483647;${
                    demoMode ? '' : 'position:absolute;top:0;left:0;opacity:0;visibility:hidden;'
                };`}></div>
        );

        const shadow = this.#element.attachShadow({ mode: 'closed' });

        shadow.append(
            <link rel='stylesheet' href={browser.runtime.getURL('/themes.css')} />,
            <link rel='stylesheet' href={browser.runtime.getURL('/content/popup.css')} />,
            (this.#customStyle = <style></style>),
            <article lang='ja'>
                {(this.#mineButtons = <section id='mine-buttons'></section>)}
                <section id='review-buttons'>
                    <button
                        class='nothing'
                        onclick={
                            demoMode ? undefined : async () => await requestReview(this.#data.token.card, 'nothing')
                        }>
                        Nothing
                    </button>
                    <button
                        class='something'
                        onclick={
                            demoMode ? undefined : async () => await requestReview(this.#data.token.card, 'something')
                        }>
                        Something
                    </button>
                    <button
                        class='hard'
                        onclick={demoMode ? undefined : async () => await requestReview(this.#data.token.card, 'hard')}>
                        Hard
                    </button>
                    <button
                        class='good'
                        onclick={demoMode ? undefined : async () => await requestReview(this.#data.token.card, 'good')}>
                        Good
                    </button>
                    <button
                        class='easy'
                        onclick={demoMode ? undefined : async () => await requestReview(this.#data.token.card, 'easy')}>
                        Easy
                    </button>
                </section>
                {(this.#vocabSection = <section id='vocab-content'></section>)}
            </article>,
        );

        this.#outerStyle = this.#element.style;
    }

    fadeIn() {
        // Necessary because in settings page, config is undefined
        // TODO is this still true? ~hmry(2023-08-08)
        if (config && !config.disableFadeAnimation) {
            this.#outerStyle.transition = 'opacity 60ms ease-in, visibility 60ms';
        }
        this.#outerStyle.opacity = '1';
        this.#outerStyle.visibility = 'visible';
    }

    fadeOut() {
        // Necessary because in settings page, config is undefined
        // TODO is this still true? ~hmry(2023-08-08)
        if (config && !config.disableFadeAnimation) {
            this.#outerStyle.transition = 'opacity 200ms ease-in, visibility 200ms';
        }
        this.#outerStyle.opacity = '0';
        this.#outerStyle.visibility = 'hidden';
    }

    disablePointer() {
        this.#outerStyle.pointerEvents = 'none';
        this.#outerStyle.userSelect = 'none';
    }

    enablePointer() {
        this.#outerStyle.pointerEvents = '';
        this.#outerStyle.userSelect = '';
    }

    render() {
        if (this.#data === undefined) return;

        const card = this.#data.token.card;

        const url = `https://jpdb.io/vocabulary/${card.vid}/${encodeURIComponent(card.spelling)}/${encodeURIComponent(
            card.reading,
        )}`;

        // Group meanings by part of speech
        const groupedMeanings: { partOfSpeech: string[]; glosses: string[][]; startIndex: number }[] = [];
        let lastPOS: string[] = [];
        for (const [index, meaning] of card.meanings.entries()) {
            if (
                // Same part of speech as previous meaning?
                meaning.partOfSpeech.length == lastPOS.length &&
                meaning.partOfSpeech.every((p, i) => p === lastPOS[i])
            ) {
                // Append to previous meaning group
                groupedMeanings[groupedMeanings.length - 1].glosses.push(meaning.glosses);
            } else {
                // Create a new meaning group
                groupedMeanings.push({
                    partOfSpeech: meaning.partOfSpeech,
                    glosses: [meaning.glosses],
                    startIndex: index,
                });
                lastPOS = meaning.partOfSpeech;
            }
        }

        this.#vocabSection.replaceChildren(
            <div id='header'>
                <a lang='ja' href={url} target='_blank'>
                    <span class='spelling'>{card.spelling}</span>
                    <span class='reading'>{card.spelling !== card.reading ? `(${card.reading})` : ''}</span>
                </a>
                <div class='state'>
                    {card.state.map(s => (
                        <span class={s}>{s}</span>
                    ))}
                </div>
            </div>,
            <div class='metainfo'>
                <span class='freq'>{card.frequencyRank ? `Top ${card.frequencyRank}` : ''}</span>
                {card.pitchAccent.map(pitch => renderPitch(card.reading, pitch))}
            </div>,
            ...groupedMeanings.flatMap(meanings => [
                <h2>
                    {meanings.partOfSpeech
                        .map(pos => PARTS_OF_SPEECH[pos] ?? `(Unknown part of speech #${pos}, please report)`)
                        .filter(x => x.length > 0)
                        .join(', ')}
                </h2>,
                <ol start={meanings.startIndex + 1}>
                    {meanings.glosses.map(glosses => (
                        <li>{glosses.join('; ')}</li>
                    ))}
                </ol>,
            ]),
        );

        const blacklisted = card.state.includes('blacklisted');
        const neverForget = card.state.includes('never-forget');

        this.#mineButtons.replaceChildren(
            <button
                class='add'
                onclick={
                    this.#demoMode
                        ? undefined
                        : () =>
                              requestMine(
                                  this.#data.token.card,
                                  config.forqOnMine,
                                  getSentences(this.#data, config.contextWidth).trim() || undefined,
                                  undefined,
                              )
                }>
                Add
            </button>,
            <button
                class='edit-add-review'
                onclick={this.#demoMode ? undefined : () => Dialog.get().showForWord(this.#data)}>
                Edit, Add and Review...
            </button>,
            <button
                class='blacklist'
                onclick={
                    this.#demoMode
                        ? undefined
                        : async () => await requestSetFlag(this.#data.token.card, 'blacklist', !blacklisted)
                }>
                {!blacklisted ? 'Blacklist' : 'Remove from blacklist'}
            </button>,
            <button
                class='never-forget'
                onclick={
                    this.#demoMode
                        ? undefined
                        : async () => await requestSetFlag(this.#data.token.card, 'never-forget', !neverForget)
                }>
                {!neverForget ? 'Never forget' : 'Unmark as never forget'}
            </button>,
        );
    }

    setData(data: JpdbWordData) {
        this.#data = data;
        this.render();
    }

    containsMouse(event: MouseEvent): boolean {
        const targetElement = event.target as HTMLElement;

        if (targetElement) {
            return this.#element.contains(targetElement);
        }

        return false;
    }

    showForWord(word: JpdbWord, mouseX = 0, mouseY = 0) {
        const data = word.jpdbData;

        this.setData(data); // Because we need the dimensions of the popup with the new data

        const bbox = getClosestClientRect(word, mouseX, mouseY);

        const wordLeft = window.scrollX + bbox.left;
        const wordTop = window.scrollY + bbox.top;
        const wordRight = window.scrollX + bbox.right;
        const wordBottom = window.scrollY + bbox.bottom;

        // window.innerWidth/Height technically contains the scrollbar, so it's not 100% accurate
        // Good enough for this though
        const leftSpace = bbox.left;
        const topSpace = bbox.top;
        const rightSpace = window.innerWidth - bbox.right;
        const bottomSpace = window.innerHeight - bbox.bottom;

        const popupHeight = this.#element.offsetHeight;
        const popupWidth = this.#element.offsetWidth;

        const minLeft = window.scrollX;
        const maxLeft = window.scrollX + window.innerWidth - popupWidth;
        const minTop = window.scrollY;
        const maxTop = window.scrollY + window.innerHeight - popupHeight;

        let popupLeft: number;
        let popupTop: number;

        const { writingMode } = getComputedStyle(word);

        if (writingMode.startsWith('horizontal')) {
            popupTop = clamp(bottomSpace > topSpace ? wordBottom : wordTop - popupHeight, minTop, maxTop);
            popupLeft = clamp(rightSpace > leftSpace ? wordLeft : wordRight - popupWidth, minLeft, maxLeft);
        } else {
            popupTop = clamp(bottomSpace > topSpace ? wordTop : wordBottom - popupHeight, minTop, maxTop);
            popupLeft = clamp(rightSpace > leftSpace ? wordRight : wordLeft - popupWidth, minLeft, maxLeft);
        }

        this.#outerStyle.transform = `translate(${popupLeft}px,${popupTop}px)`;

        this.fadeIn();
    }

    updateStyle(newCSS = config.customPopupCSS) {
        this.#customStyle.textContent = newCSS;
    }
}
