import { jsxCreateElement, nonNull, showError } from '../util.js';
import { config, requestMine, requestReview } from './content.js';
import { JpdbWordData } from './types.js';

export class Dialog {
    #element: HTMLDialogElement;
    #header: HTMLElement;
    #sentence: HTMLElement;

    #clickStartedOutside: boolean;
    #data?: JpdbWordData & {
        contextWidth: number;
        sentenceBoundaries?: number[];
        sentenceIndex?: number;
    };

    static #dialog: Dialog;

    static get() {
        if (!this.#dialog) {
            this.#dialog = new this();
            document.body.appendChild(this.#dialog.#element);
        }

        return this.#dialog;
    }

    constructor() {
        const shadowContainer = <div style='all:initial;'></div>;
        this.#element = (
            <dialog
                id='jpdb-dialog'
                style='all:revert;padding:0;margin:auto;border:none;background-color:transparent;'
                // We can't use click because then mousedown inside the content and mouseup outside would count as a click
                onmousedown={({ target }) => {
                    // Click on the dialog, but not on any children
                    // That must mean the user clicked on the background outside of the dialog
                    this.#clickStartedOutside = target === this.#element;
                }}
                onmouseup={({ target }) => {
                    if (this.#clickStartedOutside && target === this.#element) this.#element.close();

                    this.#clickStartedOutside = false;
                }}>
                {shadowContainer}
            </dialog>
        ) as HTMLDialogElement;

        const add = async (rating?: 'nothing' | 'something' | 'hard' | 'good' | 'easy' | 'fail' | 'pass') => {
            await requestMine(
                this.#data!.token.card,
                addToForq.checked,
                this.#sentence.innerText.trim() || undefined,
                translation.innerText.trim() || undefined,
            );
            if (rating) await requestReview(this.#data!.token.card, rating);
            this.#element.close();
        };

        const shadow = shadowContainer.attachShadow({ mode: 'closed' });

        let addToForq: HTMLInputElement;
        let translation: HTMLElement;
        shadow.append(
            <style>{config.dialogCSS}</style>,
            <article lang='ja'>
                {(this.#header = <div id='header'></div>)}
                <div>
                    <label for='sentence'>Sentence:</label>
                    {(this.#sentence = <div id='sentence' role='textbox' contenteditable></div>)}
                    <button
                        id='add-context'
                        onclick={() => {
                            this.#data && this.#data.contextWidth++;
                            this.render();
                        }}>
                        Add surrounding sentences
                    </button>
                </div>
                <div>
                    <label for='translation'>Translation:</label>
                    {(translation = <div id='translation' role='textbox' contenteditable></div>)}
                </div>
                <div>
                    <label>
                        Also add to FORQ:{' '}
                        {(addToForq = (<input type='checkbox' id='add-to-forq' />) as HTMLInputElement)}
                    </label>
                </div>
                <div>
                    <button class='cancel' onclick={() => this.#element.close()}>
                        Cancel
                    </button>
                    <button class='add' onclick={async () => await add()}>
                        Add
                    </button>
                </div>
                <div>
                    Add and review
                    <button class='nothing' onclick={async () => await add('nothing')}>
                        Nothing
                    </button>
                    <button class='something' onclick={async () => await add('something')}>
                        Something
                    </button>
                    <button class='hard' onclick={async () => await add('hard')}>
                        Hard
                    </button>
                    <button class='good' onclick={async () => await add('good')}>
                        Good
                    </button>
                    <button class='easy' onclick={async () => await add('easy')}>
                        Easy
                    </button>
                </div>
            </article>,
        );
    }

    render() {
        if (this.#data === undefined) throw Error("Can't render Dialog without data");

        const data = this.#data;
        const card = this.#data.token.card;

        const url = `https://jpdb.io/vocabulary/${card.vid}/${encodeURIComponent(card.spelling)}/${encodeURIComponent(
            card.reading,
        )}`;

        // FIXME(Security) not escaped
        this.#header.replaceChildren(
            <a href={url} target='_blank'>
                <span class='spelling'>{card.spelling}</span>
                <span class='reading'>{card.spelling !== card.reading ? card.reading : ''}</span>
            </a>,
        );

        if (data.sentenceBoundaries === undefined || data.sentenceIndex === undefined) {
            const boundaries = [
                -1,
                ...Array.from(data.context.matchAll(/[。！？]/g), match => nonNull(match.index)),
                data.context.length,
            ];

            // Bisect_right to find the array index of the enders to the left and right of our token
            let left = 0,
                right = boundaries.length;

            while (left < right) {
                const middle = (left + right) >> 1;
                if (boundaries[middle] <= data.contextOffset) {
                    left = middle + 1;
                } else {
                    right = middle;
                }
            }

            data.sentenceIndex = left;
            data.sentenceBoundaries = boundaries;
        }

        const start = data.sentenceBoundaries[Math.max(data.sentenceIndex - 1 - data.contextWidth, 0)] + 1;
        const end =
            data.sentenceBoundaries[
                Math.min(data.sentenceIndex + data.contextWidth, data.sentenceBoundaries.length - 1)
            ] + 1;

        this.#sentence.innerText = data.context.slice(start, end).trim();
    }

    setData(data: JpdbWordData) {
        this.#data = { ...data, contextWidth: 0 };
        this.render();
    }

    showForWord(data: JpdbWordData) {
        this.setData(data);
        this.#element.showModal();
    }
}
