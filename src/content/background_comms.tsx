import { BackgroundResponseMap } from '../background/command_types.js';
import { Card, Config, Grade, Token } from '../types.js';
import { browser } from '../util.js';
import { Paragraph, reverseIndex } from './parse.js';
import { Popup } from './popup.js';

// Background script communication

export let config: Config;
export let defaultConfig: Config;

const waitingPromises = new Map();
let nextSeq = 0;
function postRequest<Command extends keyof BackgroundResponseMap>(
    command: Command,
    args: object,
): Promise<BackgroundResponseMap[Command]['result']> {
    const seq = nextSeq++;
    return new Promise((resolve, reject) => {
        waitingPromises.set(seq, { resolve, reject });
        port.postMessage({ command, seq, ...args });
    });
}

export async function requestParse(paragraphs: Paragraph[]) {
    return (await postRequest('parse', {
        text: paragraphs.map(fragments => fragments.map(fragment => fragment.node.data).join('')),
    })) as Token[][];
}

export async function requestSetFlag(card: Card, flag: 'blacklist' | 'never-forget' | 'forq', state: boolean) {
    return await postRequest('setFlag', { vid: card.vid, sid: card.sid, flag, state });
}

export async function requestMine(card: Card, forq: boolean, sentence?: string, translation?: string) {
    return await postRequest('mine', { forq, vid: card.vid, sid: card.sid, sentence, translation });
}

export async function requestReview(card: Card, rating: Grade) {
    return await postRequest('review', { rating, vid: card.vid, sid: card.sid });
}

export async function requestUpdateConfig(changes: Partial<Config>) {
    return await postRequest('updateConfig', { config: changes });
}

export const port = browser.runtime.connect();
port.onDisconnect.addListener(() => {
    console.error('disconnect:', port);
});
port.onMessage.addListener((message, port) => {
    console.log('message:', message, port);

    switch (message.command) {
        case 'response':
            {
                const promise = waitingPromises.get(message.seq);
                waitingPromises.delete(message.seq);
                if (message.error !== undefined) {
                    console.error(message.error);

                    if (promise !== undefined) {
                        promise.reject(message.error);
                    } else {
                        throw Error(message.error.message, { cause: message.error });
                    }
                } else {
                    promise.resolve(message.result);
                }
            }
            break;

        case 'updateConfig':
            {
                config = message.config;
                defaultConfig = message.defaultConfig;
            }
            break;

        case 'updateWordState':
            {
                for (const [vid, sid, state] of message.words) {
                    const idx = reverseIndex.get(`${vid}/${sid}`);
                    if (idx === undefined) continue;

                    const className = `jpdb-word ${state.join(' ')}`;
                    if (idx.className === className) continue;

                    for (const element of idx.elements) {
                        element.className = className;
                        element.jpdbData.token.card.state = state;
                    }

                    idx.className = className;
                }

                Popup.get().render();
            }
            break;

        default:
            console.error('Unknown command');
    }
});
