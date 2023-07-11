import { BackgroundToContentMessage, ContentToBackgroundMessage, ResponseTypeMap } from '../message_types.js';
import { Card, Grade, Token } from '../types.js';
import { Config } from '../background/config.js';
import { browser, Canceled, isChrome, PromiseHandle } from '../util.js';
import { Paragraph, reverseIndex } from './parse.js';
import { Popup } from './popup.js';
import { showError } from './toast.js';

// Background script communication

export let config: Config;

const waitingPromises = new Map<number, PromiseHandle<unknown>>();
let nextSeq = 0;

function preregisterUnabortableRequest<T>(): [number, Promise<T>] {
    const seq = nextSeq++;
    const promise: any = new Promise((resolve, reject) => {
        waitingPromises.set(seq, { resolve, reject });
    });

    return [seq, promise];
}

function preregisterAbortableRequest<T>(): [number, Promise<T>, AbortController] {
    const seq = nextSeq++;
    const abort = new AbortController();
    const promise: any = new Promise((resolve, reject) => {
        waitingPromises.set(seq, { resolve, reject });
        abort.signal.addEventListener('abort', () => {
            port.postMessage({ type: 'cancel', seq });
        });
    });

    return [seq, promise, abort];
}

// Avoid repetition for most common use case
function requestUnabortable<T extends Omit<ContentToBackgroundMessage, 'seq'>>(message: T) {
    const [seq, promise] = preregisterUnabortableRequest<ResponseTypeMap[T['type']]['result']>();
    port.postMessage({ ...message, seq });
    return promise;
}

export function requestSetFlag(card: Card, flag: 'blacklist' | 'never-forget' | 'forq', state: boolean) {
    return requestUnabortable({ type: 'setFlag', vid: card.vid, sid: card.sid, flag, state });
}

export function requestMine(card: Card, forq: boolean, sentence?: string, translation?: string) {
    return requestUnabortable({ type: 'mine', forq, vid: card.vid, sid: card.sid, sentence, translation });
}

export function requestReview(card: Card, rating: Grade) {
    return requestUnabortable({ type: 'review', rating, vid: card.vid, sid: card.sid });
}

export function requestUpdateConfig() {
    return requestUnabortable({ type: 'updateConfig' });
}

// A ParseBatch represents a single paragraph waiting to be parsed
export type ParseBatch = {
    paragraph: Paragraph;
    promise: Promise<Token[]>;
    abort: AbortController;
    seq: number;
};

export function createParseBatch(paragraph: Paragraph): ParseBatch {
    const [seq, promise, abort] = preregisterAbortableRequest<Token[]>();
    return { paragraph, promise, abort, seq };
}

// Takes multiple ParseBatches to save on communications overhead between content script and background page
export function requestParse(batches: ParseBatch[]) {
    const texts = batches.map(batch => [batch.seq, batch.paragraph.map(fragment => fragment.node.data).join('')]);
    return requestUnabortable({ type: 'parse', texts });
}

// Chrome can't send Error objects over background ports, so we have to serialize and deserialize them...
// (To be specific, Firefox can send any structuredClone-able object, while Chrome can only send JSON-stringify-able objects)
const deserializeError = isChrome
    ? (err: { message: string; stack: string }) => {
          const e = new Error(err.message);
          e.stack = err.stack;
          return e;
      }
    : (err: Error) => err;

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
                    promise.reject(deserializeError(message.error as any));
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
                    promise.reject(new Canceled('Canceled'));
                }
            }
            break;

        case 'updateConfig':
            {
                config = message.config;
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
