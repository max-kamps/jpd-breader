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
                    if (elem.type === 'checkbox') {
                        elem.checked = !!value;
                    } else {
                        elem.value = value.toString();
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

                        if (elem.type === 'checkbox') {
                            newValue = elem.checked;
                        } else if (elem.pattern === '\\d+|forq|blacklist|never-forget') {
                            // HACK this is a janky way of checking if the input is a deck ID.
                            // Maybe switch to a system where input elements indicate what type the represent,
                            // once we have more than two types
                            const i = parseInt(elem.value);
                            newValue = isNaN(i) ? elem.value : i;
                        } else {
                            newValue = elem.value;
                        }

                        if (newValue !== value) {
                            // Safety: This is not safe...
                            // HACK figure out a better way to typecheck config entries (see hack note above)
                            (config as any)[key] = newValue;
                            changes[key] = newValue;
                        }
                    }
                }

                return changes;
            }

            nonNull(document.querySelector('input[type=submit]')).addEventListener('click', event => {
                requestUpdateConfig(checkConfigChanges());
                event.preventDefault();
            });
        } catch (error) {
            showError(error);
        }
    }
}

port.onMessage.addListener(checkConnectionEstablished);
