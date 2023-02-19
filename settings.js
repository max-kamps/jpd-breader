config = await browser.runtime.sendMessage({ command: 'getConfig' });


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

// let config = await browser.runtime.sendMessage({ command: 'getConfig' });
// console.log(config);

// const form = document.querySelector('#config-form');

// for (const elem of Object.values(form.elements)) {
//     const name = elem.name;
//     if (!name)
//         continue;

//     if (elem.type === 'checkbox')
//         elem.checked = config[name];
//     else
//         elem.value = config[name];
// }

// form.addEventListener('submit', (event) => {
//     browser.runtime.sendMessage({
//         command: 'setConfig',
//         config: Object.fromEntries([...form.elements].flatMap(
//             elem => elem.name ? [[elem.name, elem.type == 'checkbox' ? elem.checked : elem.value]] : [])),
//     });
//     event.preventDefault();
// });
