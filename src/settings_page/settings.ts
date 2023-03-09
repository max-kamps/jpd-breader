import { config, port, requestUpdateConfig } from '../content/content.js';
import { Popup } from '../content/popup.js';
import { nonNull, showError } from '../util.js';

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

            for (const [key, value] of Object.entries(config)) {
                const elem = document.querySelector(`[name="${key}"]`);

                if (elem === null) {
                    continue;
                } else if (elem instanceof HTMLInputElement) {
                    switch (elem.dataset.type) {
                        case 'boolean':
                            elem.checked = Boolean(value);
                            break;

                        case 'string':
                            elem.value = value?.toString() ?? '';
                            break;

                        case 'deckId':
                            elem.pattern = /\d+|forq|blacklist|never-forget/.source;
                            elem.value = value?.toString() ?? '';
                            break;
                    }
                }
            }

            function checkConfigChanges() {
                const changes: Record<string, any> = {};

                for (const [key, value] of Object.entries(config)) {
                    const elem = document.querySelector(`[name="${key}"]`);
                    if (elem === null) {
                        continue;
                    } else if (elem instanceof HTMLInputElement) {
                        let newValue;

                        switch (elem.dataset.type) {
                            case 'boolean':
                                newValue = elem.checked;
                                break;

                            case 'string':
                                newValue = elem.value;
                                break;

                            case 'deckId':
                                {
                                    const i = parseInt(elem.value);
                                    newValue = isNaN(i) ? elem.value : i;
                                }
                                break;
                        }

                        if (newValue !== value) {
                            // Safety: This is not safe...
                            // HACK figure out a better way to typecheck config entries
                            (config as any)[key] = newValue;
                            changes[key] = newValue;
                        }
                    }
                }

                return changes;
            }

            nonNull(document.querySelector('input[type=submit]')).addEventListener('click', event => {
                const changes = checkConfigChanges();
                console.log('Submitting changes:', changes);
                requestUpdateConfig(changes);
                event.preventDefault();
            });
        } catch (error) {
            showError(error);
        }
    }
}

port.onMessage.addListener(checkConnectionEstablished);
