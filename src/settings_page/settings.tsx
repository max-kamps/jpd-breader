import { config, defaultConfig, port, requestUpdateConfig } from '../content/content.js';
import { Popup } from '../content/popup.js';
import { jsxCreateElement, nonNull, showError } from '../util.js';

// Custom element definitions

// Common behavior shared for all settings elements
class SettingElement extends HTMLElement {
    _input: HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement;
    _reset: HTMLButtonElement;

    static get observedAttributes() {
        return ['name'] as const;
    }

    constructor() {
        super();

        const label = (
            <label part='label' for='input'>
                <slot></slot>
            </label>
        );

        this._input = this.renderInputElem(this.getAttribute('name') ?? '');

        this._reset = (
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
        shadow.append(label, this._input, this._reset);
    }

    renderInputElem(_name: string): HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement {
        throw Error('SettingElement subclass must implement render()');
    }

    attributeChangedCallback(
        name: (typeof SettingElement.observedAttributes)[number],
        oldValue: string,
        newValue: string,
    ) {
        this[name] = newValue;
    }

    set name(newValue: string) {
        this._input.name = newValue;
    }

    get name() {
        return this._input.name;
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
            this._reset.disabled = false;
            this._reset.innerText = 'Reset';
        } else {
            this._reset.disabled = true;
            this._reset.innerText = 'Default';
        }
    }
}

customElements.define(
    'setting-token',
    class SettingToken extends SettingElement {
        declare _input: HTMLInputElement;

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
            return this._input.value || null;
        }

        set value(newValue: string | null) {
            this._input.value = newValue ?? '';
            this.valueChanged();
        }
    },
);

customElements.define(
    'setting-deckid',
    class SettingDeckId extends SettingElement {
        declare _input: HTMLInputElement;

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
            if (this._input.value) {
                const n = parseInt(this._input.value);
                return isNaN(n) ? this._input.value : n;
            }

            return null;
        }

        set value(newValue: string | number | null) {
            this._input.value = newValue ? newValue.toString() : '';
            this.valueChanged();
        }
    },
);

customElements.define(
    'setting-string',
    class SettingString extends SettingElement {
        declare _input: HTMLTextAreaElement;

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
            return this._input.value;
        }

        set value(newValue: string) {
            this._input.value = newValue;
            this.valueChanged();
        }
    },
);

customElements.define(
    'setting-keybind',
    class SettingKeybind extends SettingElement {
        declare _input: HTMLButtonElement;
        _value: string | null = null;
        static _active?: [SettingKeybind, (event: KeyboardEvent) => void];

        renderInputElem(name: string): HTMLButtonElement {
            return (
                <button part='input' name={name} onclick={this.chooseKey.bind(this)}>
                    {this._value ?? 'Click to set'}
                </button>
            ) as HTMLButtonElement;
        }

        chooseKey() {
            if (SettingKeybind._active) {
                const [other, listener] = SettingKeybind._active;
                other._input.innerText = other._value ?? 'Click to set';
                document.removeEventListener('keydown', listener);

                if (other === this) {
                    SettingKeybind._active = undefined;
                    return;
                }
            }

            const keydownListener = (event: KeyboardEvent) => {
                SettingKeybind._active = undefined;
                this._value = event.key;
                this._input.innerText = this._value ?? 'Click to set';
                markUnsavedChanges();
                this.valueChanged();
            };

            this._input.innerText = 'Press a key, click to cancel';
            document.addEventListener('keydown', keydownListener, { once: true });
            SettingKeybind._active = [this, keydownListener];
        }

        get value(): string | null {
            return this._value;
        }

        set value(newValue: string | null) {
            this._value = newValue;
            this._input.innerText = this._value ?? 'Click to set';
            this.valueChanged();
        }
    },
);

customElements.define(
    'setting-boolean',
    class SettingBoolean extends SettingElement {
        declare _input: HTMLInputElement;

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
            return this._input.checked;
        }

        set value(newValue: boolean) {
            this._input.checked = newValue;
            this.valueChanged();
        }
    },
);

function markUnsavedChanges() {
    document.querySelector('input[type=submit]')?.classList.add('has-unsaved-changes');
}

addEventListener(
    'beforeunload',
    event => {
        if (document.querySelector('input[type=submit]')?.classList.contains('has-unsaved-changes')) {
            event.preventDefault();
            event.returnValue = '';
        }
    },
    { capture: true },
);

// Wait until the background script connection has been established,
// so we can access the config that it sends.
function checkConnectionEstablished(message: any, port: browser.runtime.Port) {
    if (message.command === 'updateConfig') {
        // The connection has been established, we can now read the config
        try {
            port.onMessage.removeListener(checkConnectionEstablished);

            const popup = Popup.getDemoMode(nonNull(document.querySelector('#preview')));
            popup.setData({
                context: '',
                contextOffset: 0,
                token: {
                    offset: 0,
                    length: 0,
                    furigana: [],
                    card: {
                        vid: 1386060,
                        sid: 1337383451,
                        rid: 0,
                        spelling: '設定',
                        reading: 'せってい',
                        meanings: [
                            'establishment;  creation;  posing (a problem);  setting (movie, novel, etc.);  scene',
                            'options setting;  preference settings;  configuration;  setup',
                        ],
                        state: ['locked', 'new'],
                        frequencyRank: 2400,
                    },
                },
            });
            popup.fadeIn();

            for (const elem of document.querySelectorAll('[name]')) {
                (elem as any).value = (config as any)[(elem as any).name] ?? null;
            }

            function checkConfigChanges() {
                const changes: Record<string, any> = {};

                for (const [key, value] of Object.entries(config)) {
                    const elem = document.querySelector(`[name="${key}"]`);
                    if (elem !== null) {
                        const newValue = (elem as SettingElement).value;
                        if (newValue !== value) {
                            (config as any)[key] = newValue;
                            changes[key] = newValue;
                        }
                    }
                }

                return changes;
            }

            const saveButton = nonNull(document.querySelector('input[type=submit]'));
            saveButton.addEventListener('click', async event => {
                event.preventDefault();
                try {
                    const changes = checkConfigChanges();
                    console.log('Submitting changes:', changes);
                    await requestUpdateConfig(changes);
                    saveButton.classList.remove('has-unsaved-changes');
                } catch (error) {
                    showError(error);
                }
            });
        } catch (error) {
            showError(error);
        }
    }
}

port.onMessage.addListener(checkConnectionEstablished);
