import { jsxCreateElement } from '../util.js';
import { config, requestAddToSpecial, requestMine, requestReview } from './content.js';
import { Dialog } from './dialog.js';
import { JpdbWordData } from './types.js';

export class Popup {
    #element: HTMLElement;
    #style: CSSStyleDeclaration;
    #vocabSection: HTMLElement;
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
        this.#element = (
            <div
                id='jpdb-popup'
                onmouseenter={demoMode ? undefined : () => this.fadeIn()}
                onmouseleave={demoMode ? undefined : () => this.fadeOut()}
                style={`all:initial;z-index:1000;${
                    demoMode ? '' : 'position:absolute;top:0;left:0;opacity:0;visibility:hidden;'
                };`}></div>
        );

        this.#style = this.#element.style;

        const shadow = this.#element.attachShadow({ mode: 'closed' });

        this.#vocabSection = <section id='vocab-content'></section>;
        shadow.append(
            <style>{config.popupCSS}</style>,
            <article lang='ja'>
                <section class='mine-buttons'>
                    Mine:
                    <button class='add' onclick={demoMode ? undefined : () => Dialog.get().showForWord(this.#data)}>
                        Add to deck...
                    </button>
                    <button
                        class='blacklist'
                        onclick={demoMode ? undefined : () => requestAddToSpecial(this.#data.token.card, 'blacklist')}>
                        Blacklist
                    </button>
                    <button
                        class='never-forget'
                        onclick={
                            demoMode ? undefined : () => requestAddToSpecial(this.#data.token.card, 'never-forget')
                        }>
                        Never Forget
                    </button>
                </section>
                <section class='mine-buttons'>
                    Review:
                    <button
                        class='nothing'
                        onclick={demoMode ? undefined : () => requestReview(this.#data.token.card, 'nothing')}>
                        Nothing
                    </button>
                    <button
                        class='something'
                        onclick={demoMode ? undefined : () => requestReview(this.#data.token.card, 'something')}>
                        Something
                    </button>
                    <button
                        class='hard'
                        onclick={demoMode ? undefined : () => requestReview(this.#data.token.card, 'hard')}>
                        Hard
                    </button>
                    <button
                        class='good'
                        onclick={demoMode ? undefined : () => requestReview(this.#data.token.card, 'good')}>
                        Good
                    </button>
                    <button
                        class='easy'
                        onclick={demoMode ? undefined : () => requestReview(this.#data.token.card, 'easy')}>
                        Easy
                    </button>
                </section>
                {this.#vocabSection}
            </article>,
        );
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
            <small>
                id: {card.vid} / {card.sid} / {card.rid}
            </small>,
            <ol>
                {card.meanings.map(gloss => (
                    <li>{gloss}</li>
                ))}
            </ol>,
        );
    }

    setData(data: JpdbWordData) {
        this.#data = data;
        this.render();
    }

    showForWord(word: HTMLElement) {
        const data = (word as HTMLElement & { jpdbData?: JpdbWordData }).jpdbData;
        if (data === undefined) return;

        const box = word.getBoundingClientRect();
        const { writingMode } = getComputedStyle(word);

        const rightSpace = window.innerWidth - box.left - box.width,
            bottomSpace = window.innerHeight - box.top - box.height;

        if (writingMode.startsWith('horizontal')) {
            this.#style.left = `${box.left + window.scrollX}px`;
            this.#style.removeProperty('right');

            if (box.top < bottomSpace) {
                this.#style.top = `${box.bottom + window.scrollY}px`;
                this.#style.removeProperty('bottom');
            } else {
                this.#style.bottom = `${window.innerHeight - box.top + window.scrollY}px`;
                this.#style.removeProperty('top');
            }
        } else {
            this.#style.top = `${box.top + window.scrollY}px`;
            this.#style.removeProperty('bottom');

            if (box.left < rightSpace) {
                this.#style.left = `${box.right + window.scrollX}px`;
                this.#style.removeProperty('right');
            } else {
                this.#style.right = `${window.innerWidth - box.left + window.scrollX}px`;
                this.#style.removeProperty('left');
            }
        }

        this.setData(data);
        this.fadeIn();
    }
}
