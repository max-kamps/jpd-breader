import { config, defaultConfig, port, requestUpdateConfig } from '../content/background_comms.js';
import { Popup } from '../content/popup.js';
import { Keybind } from '../types.js';
import { jsxCreateElement, nonNull, showError } from '../util.js';

// Custom element definitions

// Common behavior shared for all settings elements
class SettingElement extends HTMLElement {
    input: HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement;
    reset: HTMLButtonElement;

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

    attributeChangedCallback(
        name: (typeof SettingElement.observedAttributes)[number],
        oldValue: string,
        newValue: string,
    ) {
        this[name] = newValue;
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

customElements.define(
    'setting-token',
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
    },
);

customElements.define(
    'setting-deckid',
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
    },
);

customElements.define(
    'setting-string',
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
    },
);

const modifiers = ['Control', 'Alt', 'AltGraph', 'Meta', 'Shift'];
function keybindToString(bind: Keybind) {
    return bind === null ? 'None' : `${bind.key} (${[...bind.modifiers, bind.code].join('+')})`;
}

customElements.define(
    'setting-keybind',
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
    },
);

customElements.define(
    'setting-boolean',
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
                    start: 0,
                    end: 0,
                    length: 0,
                    rubies: [],
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
