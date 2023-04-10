import { Keybind } from '../types.js';
import { showError } from '../util.js';
import { config, requestMine, requestReview, requestSetFlag } from './background_comms.js';
import { Dialog } from './dialog.js';
import { Popup } from './popup.js';
import { getSentences, JpdbWord } from './word.js';

export let currentHover: [JpdbWord, number, number] | null = null;
let popupKeyHeld = false;

function matchesHotkey(
    keyEvent: { key: string; code: string; getModifierState(key: string): boolean },
    hotkey: Keybind,
) {
    return hotkey && keyEvent.code === hotkey.code && hotkey.modifiers.every(name => keyEvent.getModifierState(name));
}

window.addEventListener('keydown', async event => {
    try {
        if (matchesHotkey(event, config.showPopupKey)) {
            event.preventDefault();
            popupKeyHeld = true;

            const popup = Popup.get();
            popup.disablePointer();

            if (!currentHover) {
                popup.fadeOut();
            }
        }

        if (currentHover && matchesHotkey(event, config.addKey)) {
            const word = currentHover[0];
            await requestMine(
                word.jpdbData.token.card,
                config.forqOnMine,
                getSentences(word.jpdbData, config.contextWidth).trim() || undefined,
                undefined,
            );
        }

        if (currentHover && matchesHotkey(event, config.dialogKey)) {
            const word = currentHover[0];
            Dialog.get().showForWord(word.jpdbData);
        }

        if (currentHover) {
            const [word, x, y] = currentHover;
            const card = word.jpdbData.token.card;

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
});

window.addEventListener('keyup', event => {
    if (matchesHotkey(event, config.showPopupKey)) {
        event.preventDefault();
        popupKeyHeld = false;
        Popup.get().enablePointer();
    }
});

document.addEventListener('mousedown', () => Popup.get().fadeOut());

export function onWordHoverStart({ target, x, y }: MouseEvent) {
    if (target === null) return;
    currentHover = [target as JpdbWord, x, y];
    if (popupKeyHeld) {
        Popup.get().showForWord(target as JpdbWord, x, y);
    }
}

export function onWordHoverStop() {
    currentHover = null;
}
