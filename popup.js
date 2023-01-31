let config = await browser.runtime.sendMessage({ command: 'getConfig' });

const form = document.querySelector('#config-form'),
    fe = form.elements;

fe['word-css'].value = config.wordCSS;

form.addEventListener('submit', (event) => {
    browser.runtime.sendMessage({
        command: 'setConfig', config: {
            wordCSS: fe['word-css'].value,
        }
    });
    event.preventDefault();
});
