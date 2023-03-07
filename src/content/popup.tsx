import { jsxCreateElement } from '../util.js';
import { config, requestReview, requestSetFlag } from './content.js';
import { Dialog } from './dialog.js';
import { JpdbWordData } from './types.js';

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

export class Popup {
    #demoMode: boolean;
    #element: HTMLElement;
    #style: CSSStyleDeclaration;
    #coverStyle: CSSStyleDeclaration;
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
                onmouseenter={demoMode ? undefined : () => this.fadeIn()}
                onmouseleave={demoMode ? undefined : () => this.fadeOut()}
                style={`all:initial;z-index:2147483647;${
                    demoMode ? '' : 'position:absolute;top:0;left:0;opacity:0;visibility:hidden;'
                };`}></div>
        );

        const shadow = this.#element.attachShadow({ mode: 'closed' });

        let cover: HTMLElement;
        shadow.append(
            <style>{config.popupCSS}</style>,
            (cover = <div id='transition-cover'></div>),
            <article lang='ja'>
                {(this.#mineButtons = <section class='mine-buttons'></section>)}
                <section class='mine-buttons'>
                    Review:
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

        this.#style = this.#element.style;
        this.#coverStyle = cover.style;
    }

    fadeIn() {
        this.#style.transition = 'opacity 60ms ease-in, visibility 60ms';
        this.#style.opacity = '1';
        this.#style.visibility = 'visible';
    }

    fadeOut() {
        this.#style.transition = 'opacity 200ms ease-in, visibility 200ms';
        this.#style.opacity = '0';
        this.#style.visibility = 'hidden';
    }

    render() {
        if (this.#data === undefined) return;

        const card = this.#data.token.card;

        const url = `https://jpdb.io/vocabulary/${card.vid}/${encodeURIComponent(card.spelling)}/${encodeURIComponent(
            card.reading,
        )}`;

        this.#vocabSection.replaceChildren(
            <div id='header'>
                <a href={url} target='_blank'>
                    <span class='spelling'>{card.spelling}</span>
                    <span class='reading'>{card.spelling !== card.reading ? `(${card.reading})` : ''}</span>
                </a>
                <div class='state'>
                    {card.state.map(s => (
                        <span class={s}>{s}</span>
                    ))}
                </div>
            </div>,
            <span class='freq'>{card.frequency_rank ? `Top ${card.frequency_rank}` : ''}</span>,
            <ol>
                {card.meanings.map(gloss => (
                    <li>{gloss}</li>
                ))}
            </ol>,
        );

        const blacklisted = (card.state as string[]).includes('blacklisted');
        const neverForget = (card.state as string[]).includes('never-forget');

        this.#mineButtons.replaceChildren(
            'Mine:',
            <button class='add' onclick={this.#demoMode ? undefined : () => Dialog.get().showForWord(this.#data)}>
                Add to deck...
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

    showForWord(word: HTMLElement, mouseX = 0, mouseY = 0) {
        const data = (word as HTMLElement & { jpdbData?: JpdbWordData }).jpdbData;
        if (data === undefined) return;

        this.setData(data); // Because we need the dimensions of the popup with the new data

        const bbox = getClosestClientRect(word, mouseX, mouseY);

        const wordWidth = bbox.width;
        const wordHeight = bbox.height;
        const wordLeft = window.scrollX + bbox.left;
        const wordTop = window.scrollY + bbox.top;
        const wordRight = window.scrollX + bbox.right;
        const wordBottom = window.scrollY + bbox.bottom;

        // window.inner... technically contains the scrollbar, so it's not 100% accurate
        // Good enough though
        const leftSpace = bbox.left;
        const topSpace = bbox.top;
        const rightSpace = window.innerWidth - bbox.right;
        const bottomSpace = window.innerHeight - bbox.bottom;

        const popupHeight = this.#element.offsetHeight;
        const popupWidth = this.#element.offsetWidth;

        let popupLeft: number;
        let popupTop: number;
        let coverWidth: number;
        let coverHeight: number;
        let coverLeft: number;
        let coverTop: number;
        let coverClipPath: string;

        const { writingMode } = getComputedStyle(word);

        const hdir = Math.sign(rightSpace - leftSpace);
        const vdir = Math.sign(bottomSpace - topSpace);

        if (writingMode.startsWith('horizontal')) {
            popupTop = topSpace < bottomSpace ? wordBottom : wordTop - popupHeight;
            popupLeft = rightSpace > leftSpace ? wordLeft : wordRight - popupWidth;

            coverHeight = wordHeight;
            coverWidth = wordWidth + wordHeight;
            coverTop = wordTop;
            coverLeft = rightSpace > leftSpace ? wordLeft : wordRight - coverWidth;

            coverClipPath = `path('\
                M ${hdir == 1 ? 0 : coverWidth} ${vdir == 1 ? 0 : coverHeight} \
                h ${hdir * wordWidth} \
                c 0                          ${vdir * 0.3 * wordHeight} \
                  ${hdir * 0.3 * wordHeight} ${vdir * wordHeight} \
                  ${hdir * wordHeight}       ${vdir * wordHeight} \
                h ${-hdir * coverWidth} \
                Z')`;
        } else {
            popupTop = topSpace < bottomSpace ? wordTop : wordBottom - popupHeight;
            popupLeft = leftSpace < rightSpace ? wordRight : wordLeft - popupWidth;

            coverWidth = wordWidth;
            coverHeight = wordHeight + wordWidth;
            coverLeft = wordLeft;
            coverTop = bottomSpace > topSpace ? wordTop : wordBottom - coverHeight;

            coverClipPath = `path('\
                M ${hdir == 1 ? 0 : coverWidth} ${vdir == 1 ? 0 : coverHeight} \
                v ${vdir * wordHeight} \
                c ${hdir * 0.3 * wordWidth} 0 \
                  ${hdir * wordWidth} ${vdir * 0.3 * wordWidth}\
                  ${hdir * wordWidth} ${vdir * wordWidth}\
                v ${-vdir * coverHeight} \
                Z')`;
        }

        this.#style.transform = `translate(${popupLeft}px,${popupTop}px)`;

        // Cover is positioned relative to the popup
        this.#coverStyle.transform = `translate(${coverLeft - popupLeft}px,${coverTop - popupTop}px)`;
        this.#coverStyle.width = `${coverWidth}px`;
        this.#coverStyle.height = `${coverHeight}px`;
        this.#coverStyle.clipPath = coverClipPath;

        this.fadeIn();
    }
}
