import { assertNonNull, browser, jsxCreateElement } from '../util.js';
import { config, requestMine, requestReview } from './background_comms.js';
import { getSentences, JpdbWordData } from './word.js';

export class Dialog {
    #element: HTMLElement;
    #header: HTMLElement;
    #sentence: HTMLElement;

    #clickStartedOutside: boolean;
    #data: JpdbWordData;
    #contextWidth: number;

    static #dialog: Dialog;

    static get() {
        if (!this.#dialog) {
            this.#dialog = new this();
            document.body.appendChild(this.#dialog.#element);
        }

        return this.#dialog;
    }

    constructor() {
        this.#element = (
            <div
                id='jpdb-dialog'
                style='all:initial;display:none'
                onclick={event => {
                    event.stopPropagation();
                }}></div>
        );

        const add = async (rating?: 'nothing' | 'something' | 'hard' | 'good' | 'easy' | 'fail' | 'pass') => {
            assertNonNull(this.#data);

            await requestMine(
                this.#data.token.card,
                addToForq.checked,
                this.#sentence.innerText.trim() || undefined,
                translation.innerText.trim() || undefined,
            );

            if (rating) {
                await requestReview(this.#data.token.card, rating);
            }

            this.closeModal();
        };

        const shadow = this.#element.attachShadow({ mode: 'closed' });

        let addToForq: HTMLInputElement;
        let translation: HTMLElement;
        shadow.append(
            <link rel='stylesheet' href={browser.runtime.getURL('/content/dialog.css')} />,
            <div
                id='modal-wrapper'
                // We can't use click because then mousedown inside the content and mouseup outside would count as a click
                // That means users might accidentally close the modal while dragging to select the sentence or translation.
                onmousedown={({ target, currentTarget }) => {
                    this.#clickStartedOutside = target === currentTarget;
                }}
                onmouseup={({ target, currentTarget }) => {
                    if (this.#clickStartedOutside && target === currentTarget) {
                        this.closeModal();
                    }
                    this.#clickStartedOutside = false;
                }}>
                <article lang='ja'>
                    {(this.#header = <div id='header'></div>)}
                    <div>
                        <label for='sentence'>Sentence:</label>
                        {(this.#sentence = <div id='sentence' role='textbox' contenteditable></div>)}
                        <button
                            id='add-context'
                            onclick={() => {
                                this.#contextWidth++;
                                this.#sentence.innerText = getSentences(this.#data, this.#contextWidth);
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
                            {
                                (addToForq = (
                                    <input type='checkbox' id='add-to-forq' checked={config.forqOnMine} />
                                ) as HTMLInputElement)
                            }
                        </label>
                    </div>
                    <div>
                        <button class='cancel' onclick={() => this.closeModal()}>
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
                </article>
            </div>,
        );
    }

    render() {
        if (this.#data === undefined) throw Error("Can't render Dialog without data");

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

        this.#sentence.innerText = getSentences(this.#data, this.#contextWidth);
    }

    showModal() {
        this.#element.style.display = 'initial';
    }

    closeModal() {
        this.#element.style.display = 'none';
    }

    setData(data: JpdbWordData) {
        this.#data = data;
        this.#contextWidth = config.contextWidth;
        this.render();
    }

    showForWord(data: JpdbWordData) {
        this.setData(data);
        this.showModal();
    }
}
