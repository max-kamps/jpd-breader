import { Keybind } from '../config.js';
import { showError } from '../util.js';
import { config, requestMine, requestReview, requestSetFlag } from './background_comms.js';
import { Dialog } from './dialog.js';
import { Popup } from './popup.js';
import { getSentences, JpdbWord } from './word.js';

export let currentHover: [JpdbWord, number, number] | null = null;
let popupKeyHeld = false;

function matchesHotkey(event: KeyboardEvent | MouseEvent, hotkey: Keybind) {
    const code = event instanceof KeyboardEvent ? event.code : `Mouse${event.button}`;
    return hotkey && code === hotkey.code && hotkey.modifiers.every(name => event.getModifierState(name));
}

async function hotkeyListener(event: KeyboardEvent | MouseEvent) {
    try {
        if (matchesHotkey(event, config.showPopupKey) && !config.showPopupOnHover) {
            event.preventDefault();
            popupKeyHeld = true;

            const popup = Popup.get();
            popup.disablePointer();

            if (!currentHover) {
                popup.fadeOut();
            }
        }

        if (currentHover) {
            const [word, x, y] = currentHover;
            const card = word.jpdbData.token.card;

            if (matchesHotkey(event, config.addKey)) {
                await requestMine(
                    word.jpdbData.token.card,
                    config.forqOnMine,
                    getSentences(word.jpdbData, config.contextWidth).trim() || undefined,
                    undefined,
                );
            }

            if (matchesHotkey(event, config.dialogKey)) {
                Dialog.get().showForWord(word.jpdbData);
            }

            if (matchesHotkey(event, config.showPopupKey)) {
                event.preventDefault();
                Popup.get().showForWord(word, x, y);
            }

            if (matchesHotkey(event, config.blacklistKey)) {
                event.preventDefault();
                await requestSetFlag(card, 'blacklist', !card.state.includes('blacklisted'));
            }

            if (matchesHotkey(event, config.neverForgetKey)) {
                event.preventDefault();
                await requestSetFlag(card, 'never-forget', !card.state.includes('never-forget'));
            }

            if (matchesHotkey(event, config.nothingKey)) {
                event.preventDefault();
                await requestReview(card, 'nothing');
            }

            if (matchesHotkey(event, config.somethingKey)) {
                event.preventDefault();
                await requestReview(card, 'something');
            }

            if (matchesHotkey(event, config.hardKey)) {
                event.preventDefault();
                await requestReview(card, 'hard');
            }

            if (matchesHotkey(event, config.goodKey)) {
                event.preventDefault();
                await requestReview(card, 'good');
            }

            if (matchesHotkey(event, config.easyKey)) {
                event.preventDefault();
                await requestReview(card, 'easy');
            }
        }
    } catch (error) {
        showError(error);
    }
}

window.addEventListener('keydown', hotkeyListener);
window.addEventListener('mousedown', hotkeyListener);

function hidePopupHotkeyListener(event: KeyboardEvent | MouseEvent) {
    if (matchesHotkey(event, config.showPopupKey)) {
        event.preventDefault();
        popupKeyHeld = false;
        Popup.get().enablePointer();
    }
}

window.addEventListener('keyup', hidePopupHotkeyListener);
window.addEventListener('mouseup', hidePopupHotkeyListener);

document.addEventListener('mousedown', e => {
    if (config.touchscreenSupport) {
        // to prevent issues with simultaneous showing and hiding
        // and to allow clicking on the popup without making it disappear.
        if (currentHover == null && !Popup.get().containsMouse(e)) {
            Popup.get().fadeOut();
        }
    } else {
        Popup.get().fadeOut();
    }
});

export function onWordHoverStart({ target, x, y }: MouseEvent) {
    if (target === null) return;
    currentHover = [target as JpdbWord, x, y];
    if (popupKeyHeld || config.showPopupOnHover) {
        // On mobile devices, the position of the popup is occasionally adjusted to ensure
        // it remains on the screen. However, due to the interaction between the 'onmouseenter'
        // event and the popup, there are instances where the popup appears and at the same
        // time a (review) button is being clicked.
        if (config.touchscreenSupport) {
            Popup.get().disablePointer();

            setTimeout(() => {
                Popup.get().enablePointer();
            }, 400);
        }

        Popup.get().showForWord(target as JpdbWord, x, y);
    }
}

export function onWordHoverStop() {
    currentHover = null;
}
