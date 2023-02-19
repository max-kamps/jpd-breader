function checkConnectionEstablished(message, port) {
    if (message.command === 'updateConfig') {
        port.onMessage.removeListener(checkConnectionEstablished);
        console.log(config);

        const popup = getPopup();
        popup.style.position = 'initial';
        document.querySelector('#preview').appendChild(popup);
        popup.setContent({
            'vid': 1386060,
            'sid': 1337383451,
            'spelling': '設定',
            'reading': 'せってい',
            'meanings': [
                'establishment;  creation;  posing (a problem);  setting (movie, novel, etc.);  scene',
                'options setting;  preference settings;  configuration;  setup'
            ],
            'cardState': ['locked', 'new']
        });
        popup.fadeIn();

        for (const [key, value] of Object.entries(config)) {
            const elem = document.querySelector(`[name="${key}"]`)
            if (elem === null)
                continue;

            if (elem.type === 'checkbox')
                elem.checked = value;
            else
                elem.value = value;
        }

        function updateConfig() {
            const changes = {};

            for (const [key, value] of Object.entries(config)) {
                const elem = document.querySelector(`[name="${key}"]`)
                if (elem === null)
                    continue;

                const newValue = (elem.type === 'checkbox') ? elem.checked : elem.value;
                if (newValue !== value) {
                    changes[key] = newValue;
                    config[key] = newValue;
                }
            }

            console.log(changes);
            return changes;
        }

        document.querySelector('input[type=submit]').addEventListener('click', (event) => {
            postMessage({ command: 'updateConfig', config: updateConfig() });
            event.preventDefault();
        });

    }
}

port.onMessage.addListener(checkConnectionEstablished);
