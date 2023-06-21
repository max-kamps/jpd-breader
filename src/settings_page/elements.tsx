import { defaultConfig, Keybind } from '../config.js';
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
        console.log('changed', this.name, 'to', this.value, '(default', (defaultConfig as any)[this.name] ?? null, ')');
        if (this.value !== ((defaultConfig as any)[this.name] ?? null)) {
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
        return this.input.value ?? '';
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
        const n = parseInt(this.input.value);
        return isNaN(n) ? this.input.value || null : n;
    }

    set value(newValue: string | number | null) {
        this.input.value = newValue === null ? '' : newValue.toString();
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
                rows={8}
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

    valueChanged(): void {
        super.valueChanged();

        // Resize to fit all rows
        this.input.rows = this.input.value.split(/\n/g).length;
    }
}

const MODIFIERS = ['Control', 'Alt', 'AltGraph', 'Meta', 'Shift'];
const MOUSE_BUTTONS = ['Left Mouse Button', 'Middle Mouse Button', 'Right Mouse Button'];
function keybindToString(bind: Keybind) {
    return bind === null ? 'None' : `${bind.key} (${[...bind.modifiers, bind.code].join('+')})`;
}

class SettingKeybind extends SettingElement {
    declare input: HTMLButtonElement;
    #value: Keybind = null;
    static active?: [SettingKeybind, (event: KeyboardEvent) => void];

    renderInputElem(name: string): HTMLButtonElement {
        return (
            <button
                part='input'
                name={name}
                onmousedown={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.chooseKey();
                }}>
                Loading...
            </button>
        ) as HTMLButtonElement;
    }

    chooseKey() {
        if (SettingKeybind.active) {
            // If there's currently another SettingKeybind waiting for input, stop it
            const [other, listener] = SettingKeybind.active;
            other.input.innerText = keybindToString(other.#value);
            document.removeEventListener('keydown', listener);
            document.removeEventListener('keyup', listener);
            document.removeEventListener('mousedown', listener);

            if (other === this) {
                SettingKeybind.active = undefined;
                return;
            }
        }

        const keyListener = (event: KeyboardEvent | MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();

            // We ignore the keydown event for modifiers, and only register them on keyup.
            // This allows pressing and holding modifiers before pressing the main hotkey.
            if (event.type === 'keydown' && MODIFIERS.includes((event as KeyboardEvent).key)) {
                return;
            }

            // .code: Layout-independent key identifier (usually equal to whatever that key means in qwerty)
            // .key: Key character in the current layout (respecting modifiers like shift or altgr)
            // .button: Mouse button number
            const code = event instanceof KeyboardEvent ? event.code : `Mouse${event.button}`;
            const key = event instanceof KeyboardEvent ? event.key : MOUSE_BUTTONS[event.button] ?? code;
            const modifiers = MODIFIERS.filter(name => name !== key && event.getModifierState(name));

            this.#value = code === 'Escape' ? null : { key, code, modifiers };
            this.input.innerText = keybindToString(this.#value);
            markUnsavedChanges();
            this.valueChanged();
            SettingKeybind.active = undefined;

            document.removeEventListener('keydown', keyListener);
            document.removeEventListener('keyup', keyListener);
            document.removeEventListener('mousedown', keyListener);
        };

        this.input.innerText = 'Press a key, click to cancel';
        document.addEventListener('keydown', keyListener);
        document.addEventListener('keyup', keyListener);
        document.addEventListener('mousedown', keyListener);
        SettingKeybind.active = [this, keyListener];
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
    customElements.define('setting-deck-id', SettingDeckId);
    customElements.define('setting-string', SettingString);
    customElements.define('setting-keybind', SettingKeybind);

    document.body.classList.add('ready');
}
