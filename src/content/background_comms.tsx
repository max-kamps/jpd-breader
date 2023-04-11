import { BackgroundToContentMessage, ContentToBackgroundMessage, ResponseTypeMap } from '../message_types.js';
import { Card, Config, Grade, Token } from '../types.js';
import { browser, CANCELED, CancellablePromise, CancellablePromiseHandle, showError } from '../util.js';
import { Paragraph, reverseIndex } from './parse.js';
import { Popup } from './popup.js';

// Background script communication

export let config: Config;
export let defaultConfig: Config;

const waitingPromises = new Map<number, CancellablePromiseHandle<unknown>>();
let nextSeq = 0;
function registerRequest<T>(): [number, CancellablePromise<T>] {
    const seq = nextSeq++;
    const promise: any = new Promise((resolve, reject) => {
        waitingPromises.set(seq, { resolve, reject });
    });

    promise.cancel = () => {
        port.postMessage({ type: 'cancel', seq });
    };

    return [seq, promise];
}

function post<T extends Omit<ContentToBackgroundMessage, 'seq'>>(message: T) {
    const [seq, promise] = registerRequest<ResponseTypeMap[T['type']]['result']>();
    port.postMessage({ ...message, seq });
    return promise;
}

export type ParseBatch = {
    entries: {
        paragraph: Paragraph;
        promise: CancellablePromise<Token[]>;
    }[];
    texts: [number, string][];
};

export function createParseBatch(paragraphs: Paragraph[]): ParseBatch {
    const texts: [number, string][] = [];
    const entries: ParseBatch['entries'] = [];

    for (const paragraph of paragraphs) {
        const text = paragraph.map(fragment => fragment.node.data).join('');
        const [seq, promise] = registerRequest<Token[]>();
        texts.push([seq, text]);
        entries.push({ paragraph, promise });
    }

    return { entries, texts };
}

export function requestParse(batches: ParseBatch[]) {
    post({ type: 'parse', texts: batches.flatMap(batch => batch.texts) });
}

export function requestSetFlag(card: Card, flag: 'blacklist' | 'never-forget' | 'forq', state: boolean) {
    return post({ type: 'setFlag', vid: card.vid, sid: card.sid, flag, state });
}

export function requestMine(card: Card, forq: boolean, sentence?: string, translation?: string) {
    return post({ type: 'mine', forq, vid: card.vid, sid: card.sid, sentence, translation });
}

export function requestReview(card: Card, rating: Grade) {
    return post({ type: 'review', rating, vid: card.vid, sid: card.sid });
}

export function requestUpdateConfig(changes: Partial<Config>) {
    return post({ type: 'updateConfig', config: changes });
}

export const port = browser.runtime.connect();
port.onDisconnect.addListener(() => {
    console.error('disconnect:', port);
});
port.onMessage.addListener((message: BackgroundToContentMessage, port) => {
    console.log('message:', message, port);

    switch (message.type) {
        case 'success':
            {
                const promise = waitingPromises.get(message.seq);
                waitingPromises.delete(message.seq);
                if (promise) {
                    promise.resolve(message.result);
                } else {
                    console.warn(`No promise with seq ${message.seq}, result dropped`);
                }
            }
            break;

        case 'error':
            {
                const promise = waitingPromises.get(message.seq);
                waitingPromises.delete(message.seq);
                if (promise) {
                    promise.reject(message.error);
                } else {
                    showError(message.error);
                }
            }
            break;

        case 'canceled':
            {
                const promise = waitingPromises.get(message.seq);
                waitingPromises.delete(message.seq);
                if (promise) {
                    promise.reject(CANCELED);
                }
            }
            break;

        case 'updateConfig':
            {
                config = message.config;
                defaultConfig = message.defaultConfig;
                Popup.get().updateStyle();
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
    }
});
