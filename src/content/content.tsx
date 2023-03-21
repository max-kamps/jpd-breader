import { showError } from '../util.js';
import { config, requestReview, requestSetFlag } from './background_comms.js';
import { Popup } from './popup.js';
import { JpdbWord } from './types.js';

export let currentHover: [JpdbWord, number, number] | null = null;
let popupKeyHeld = false;

window.addEventListener('keydown', async ({ key }) => {
    if (key === config.showPopupKey) {
        popupKeyHeld = true;

        if (!currentHover) {
            Popup.get().fadeOut();
        }
    }

    if (currentHover) {
        try {
            const [word, x, y] = currentHover;
            const card = word.jpdbData.token.card;

            switch (key) {
                case config.showPopupKey:
                    Popup.get().showForWord(word, x, y);
                    break;
                case config.blacklistKey:
                    await requestSetFlag(card, 'blacklist', !card.state.includes('blacklisted'));
                    break;
                case config.neverForgetKey:
                    await requestSetFlag(card, 'never-forget', !card.state.includes('never-forget'));
                    break;
                case config.nothingKey:
                    await requestReview(card, 'nothing');
                    break;
                case config.somethingKey:
                    await requestReview(card, 'something');
                    break;
                case config.hardKey:
                    await requestReview(card, 'hard');
                    break;
                case config.goodKey:
                    await requestReview(card, 'good');
                    break;
                case config.easyKey:
                    await requestReview(card, 'easy');
                    break;
            }
        } catch (error) {
            showError(error);
        }
    }
});

window.addEventListener('keyup', ({ key }) => {
    if (key === config.showPopupKey) {
        popupKeyHeld = false;
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
