let config = await browser.runtime.sendMessage({ command: 'getConfig' });

const form = document.querySelector('#config-form'),
    fe = form.elements;

fe['api-token'].value = config.apiToken;
fe['word-css'].value = config.wordCSS;
fe['use-scraping'].checked = config.useScraping;

form.addEventListener('submit', (event) => {
    browser.runtime.sendMessage({
        command: 'setConfig', config: {
            apiToken: fe['api-token'].value,
            wordCSS: fe['word-css'].value,
            useScraping: fe['use-scraping'].checked,
        }
    });
    event.preventDefault();
});
