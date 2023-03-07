// @ts-nocheck

import { config, port, requestUpdateConfig } from '../content/content.js';
import { Popup } from '../content/popup.js';
import { nonNull, showError } from '../util.js';

function checkConnectionEstablished(message: any, port: browser.runtime.Port) {
    if (message.command === 'updateConfig') {
        try {
            port.onMessage.removeListener(checkConnectionEstablished);
            console.log(config);

            // TODO fix popup fading out on mouseout
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
                    },
                },
            });
            popup.fadeIn();

            for (const [key, value] of Object.entries(config)) {
                const elem = document.querySelector(`[name="${key}"]`);
                if (elem === null) continue;

                if (elem.type === 'checkbox') elem.checked = value;
                else elem.value = value;
            }

            function checkConfigChanges() {
                const changes = {};

                for (const [key, value] of Object.entries(config)) {
                    const elem = document.querySelector(`[name="${key}"]`);
                    if (elem === null) continue;

                    let newValue;
                    if (elem.type === 'checkbox') {
                        newValue = elem.checked;
                    } else if (elem.pattern === '\\d+|forq|blacklist|never-forget') {
                        const i = parseInt(elem.value);
                        newValue = isNaN(i) ? elem.value : i;
                    } else {
                        newValue = elem.value;
                    }

                    if (newValue !== value) {
                        changes[key] = newValue;
                        config[key] = newValue;
                    }
                }

                console.log(changes);
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
