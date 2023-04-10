import { config, port, requestUpdateConfig } from '../content/background_comms.js';
import { Popup } from '../content/popup.js';
import { BackgroundToContentMessage } from '../message_types.js';
import { nonNull, showError } from '../util.js';
import { defineCustomElements, SettingElement } from './elements.js';

// Custom element definitions

// Common behavior shared for all settings elements

defineCustomElements();

export function markUnsavedChanges() {
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
function checkConnectionEstablished(message: BackgroundToContentMessage, port: browser.runtime.Port) {
    if (message.type === 'updateConfig') {
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
                        pitchAccent: ['LHHHH'],
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
