import { defaultConfig } from '../content/background_comms.js';
import { Keybind } from '../types.js';
import { jsxCreateElement } from '../util.js';
import { markUnsavedChanges } from './settings.js';

export class SettingElement extends HTMLElement {
    input: HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement;
    reset: HTMLButtonElement;

    static get observedAttributes() {
        return ['name'];
    }

    constructor() {
        super();

        const label = (
            <label part='label' for='input'>
                <slot></slot>
            </label>
        );

        this.input = this.renderInputElem(this.getAttribute('name') ?? '');

        this.reset = (
            <button
                part='reset-button'
                onclick={() => {
                    this.resetValue();
                    markUnsavedChanges();
                }}>
                Reset
            </button>
        ) as HTMLButtonElement;

        const shadow = this.attachShadow({ mode: 'open' });
        shadow.append(label, this.input, this.reset);
    }

    renderInputElem(_name: string): HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement {
        throw Error('SettingElement subclass must implement render()');
    }

    attributeChangedCallback(name: any, oldValue: string, newValue: string) {
        (this as any)[name] = newValue;
    }

    set name(newValue: string) {
        this.input.name = newValue;
    }

    get name() {
        return this.input.name;
    }

    get value(): unknown {
        throw Error('SettingElement subclass must implement get value()');
    }

    set value(newValue: unknown) {
        throw Error('SettingElement subclass must implement set value(newValue)');
    }

    resetValue() {
        this.value = (defaultConfig as any)[this.name] ?? null;
    }

    valueChanged() {
        console.log('change', defaultConfig !== undefined, this.value, (defaultConfig as any)[this.name] ?? null);
        if (defaultConfig === undefined || this.value !== ((defaultConfig as any)[this.name] ?? null)) {
            this.reset.disabled = false;
            this.reset.innerText = 'Reset';
        } else {
            this.reset.disabled = true;
            this.reset.innerText = 'Default';
        }
    }
}

class SettingNumber extends SettingElement {
    declare input: HTMLInputElement;

    static get observedAttributes() {
        return ['name', 'min', 'max', 'step'];
    }

    renderInputElem(name: string): HTMLInputElement {
        return (
            <input
                part='input'
                type='number'
                name={name}
                oninput={() => {
                    this.valueChanged();
                    markUnsavedChanges();
                }}
            />
        ) as HTMLInputElement;
    }

    get min() {
        return this.input.min;
    }

    set min(newValue) {
        this.input.min = newValue;
    }

    get max() {
        return this.input.max;
    }

    set max(newValue) {
        this.input.max = newValue;
    }

    get step() {
        return this.input.step;
    }

    set step(newValue) {
        this.input.step = newValue;
    }

    get value(): number {
        return this.input.valueAsNumber;
    }

    set value(newValue: number) {
        this.input.valueAsNumber = newValue;
        this.valueChanged();
    }
}

class SettingBoolean extends SettingElement {
    declare input: HTMLInputElement;

    renderInputElem(name: string): HTMLInputElement {
        return (
            <input
                part='input'
                type='checkbox'
                name={name}
                oninput={() => {
                    this.valueChanged();
                    markUnsavedChanges();
                }}
            />
        ) as HTMLInputElement;
    }

    get value(): boolean {
        return this.input.checked;
    }

    set value(newValue: boolean) {
        this.input.checked = newValue;
        this.valueChanged();
    }
}

class SettingToken extends SettingElement {
    declare input: HTMLInputElement;

    renderInputElem(name: string): HTMLInputElement {
        return (
            <input
                part='input'
                type='text'
                name={name}
                oninput={() => {
                    this.valueChanged();
                    markUnsavedChanges();
                }}
            />
        ) as HTMLInputElement;
    }

    get value(): string | null {
        return this.input.value || null;
    }

    set value(newValue: string | null) {
        this.input.value = newValue ?? '';
        this.valueChanged();
    }
}

class SettingDeckId extends SettingElement {
    declare input: HTMLInputElement;

    renderInputElem(name: string): HTMLInputElement {
        return (
            <input
                part='input'
                type='text'
                name={name}
                pattern='\d+|forq|blacklist|never-forget'
                oninput={() => {
                    this.valueChanged();
                    markUnsavedChanges();
                }}
            />
        ) as HTMLInputElement;
    }

    get value(): string | number | null {
        if (this.input.value) {
            const n = parseInt(this.input.value);
            return isNaN(n) ? this.input.value : n;
        }

        return null;
    }

    set value(newValue: string | number | null) {
        this.input.value = newValue ? newValue.toString() : '';
        this.valueChanged();
    }
}

class SettingString extends SettingElement {
    declare input: HTMLTextAreaElement;

    renderInputElem(name: string): HTMLTextAreaElement {
        return (
            <textarea
                part='input'
                name={name}
                oninput={() => {
                    this.valueChanged();
                    markUnsavedChanges();
                }}></textarea>
        ) as HTMLTextAreaElement;
    }

    get value(): string {
        return this.input.value;
    }

    set value(newValue: string) {
        this.input.value = newValue;
        this.valueChanged();
    }
}

const modifiers = ['Control', 'Alt', 'AltGraph', 'Meta', 'Shift'];
function keybindToString(bind: Keybind) {
    return bind === null ? 'None' : `${bind.key} (${[...bind.modifiers, bind.code].join('+')})`;
}

class SettingKeybind extends SettingElement {
    declare input: HTMLButtonElement;
    #value: Keybind = null;
    static active?: [SettingKeybind, (event: KeyboardEvent) => void];

    renderInputElem(name: string): HTMLButtonElement {
        return (
            <button part='input' name={name} onclick={this.chooseKey.bind(this)}>
                Loading...
            </button>
        ) as HTMLButtonElement;
    }

    chooseKey() {
        if (SettingKeybind.active) {
            const [other, listener] = SettingKeybind.active;
            other.input.innerText = keybindToString(other.#value);
            document.removeEventListener('keydown', listener);

            if (other === this) {
                SettingKeybind.active = undefined;
                return;
            }
        }

        const keydownListener = (event: KeyboardEvent) => {
            if (!modifiers.includes(event.key)) {
                SettingKeybind.active = undefined;

                this.#value =
                    event.code === 'Escape'
                        ? null
                        : {
                              key: event.key,
                              code: event.code,
                              modifiers: modifiers.filter(name => event.getModifierState(name)),
                          };

                this.input.innerText = keybindToString(this.#value);
                markUnsavedChanges();
                this.valueChanged();
                event.preventDefault();
                document.removeEventListener('keydown', keydownListener);
                document.removeEventListener('keyup', keyupListener);
            }
        };

        const keyupListener = (event: KeyboardEvent) => {
            SettingKeybind.active = undefined;
            this.#value = {
                key: event.key,
                code: event.code,
                modifiers: modifiers.filter(name => event.key !== name && event.getModifierState(name)),
            };
            this.input.innerText = keybindToString(this.#value);
            markUnsavedChanges();
            this.valueChanged();
            event.preventDefault();
            document.removeEventListener('keydown', keydownListener);
            document.removeEventListener('keyup', keyupListener);
        };

        this.input.innerText = 'Press a key, click to cancel';
        document.addEventListener('keydown', keydownListener);
        document.addEventListener('keyup', keyupListener);
        SettingKeybind.active = [this, keydownListener];
    }

    get value(): Keybind {
        return this.#value;
    }

    set value(newValue: Keybind) {
        this.#value = newValue;
        this.input.innerText = keybindToString(newValue);
        this.valueChanged();
    }
}

export function defineCustomElements() {
    customElements.define('setting-number', SettingNumber);
    customElements.define('setting-boolean', SettingBoolean);
    customElements.define('setting-token', SettingToken);
    customElements.define('setting-deckid', SettingDeckId);
    customElements.define('setting-string', SettingString);
    customElements.define('setting-keybind', SettingKeybind);

    // await Promise.allSettled(
    //     [
    //         'setting-number',
    //         'setting-boolean',
    //         'setting-token',
    //         'setting-deckid',
    //         'setting-string',
    //         'setting-keybind',
    //     ].map(name => customElements.whenDefined(name)),
    // );

    document.body.classList.add('ready');
}
