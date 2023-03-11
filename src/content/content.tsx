import { Card, Config, Token } from '../types.js';
import { browser, assertNonNull, jsxCreateElement, showError } from '../util.js';
import { Popup } from './popup.js';
import { JpdbWord } from './types.js';

let currentHover: [JpdbWord, number, number] | null = null;
let popupKeyHeld = false;

window.addEventListener('keydown', async ({ key }) => {
    if (key === config.showPopupKey) {
        popupKeyHeld = true;
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

document.addEventListener('click', () => Popup.get().fadeOut());

// Parsing-related functions

type Fragment = {
    text: string;
    length: number;
    offset: number;
} & ({ node: Text } | { node: HTMLElement; furi: [string, string][] });

export function textFragments(nodes: (HTMLElement | Text)[]): Fragment[] {
    // Get a list of fragments (text nodes along with metainfo) contained in the given nodes
    const fragments: Fragment[] = [];
    let offset = 0;

    for (const node of nodes) {
        switch (node.nodeName) {
            case '#text':
                {
                    const text = (node as Text).data;
                    const length = text.length;
                    fragments.push({ node: node as Text, text, length, offset });
                    offset += length;
                }
                break;

            case 'RUBY':
                {
                    const bases: string[] = [];
                    const rubies: string[] = [];

                    for (const rubyChild of node.childNodes) {
                        switch (rubyChild.nodeName) {
                            case '#text':
                                bases.push((rubyChild as Text).data);
                                break;

                            case 'RB':
                                bases.push((rubyChild as HTMLElement).textContent ?? '');
                                break;

                            case 'RT':
                                rubies.push((rubyChild as HTMLElement).textContent ?? '');
                                break;
                        }
                    }

                    const text = bases.join('');
                    const length = text.length;
                    const furi = bases.map((base, i) => [base, rubies[i]] as [string, string]);

                    fragments.push({ node: node as HTMLElement, text, length, offset, furi });
                    offset += length;
                }
                break;

            default:
                throw Error(`Can't get fragment of node with name ${node.nodeName}`);
        }
    }

    return fragments;
}

function furiganaToRuby(parts: [string, string | null][]): (HTMLElement | string)[] {
    return parts.map(x =>
        !x[1] ? (
            x[0]
        ) : (
            <ruby>
                {x[0]}
                <rt>{x[1]}</rt>
            </ruby>
        ),
    );
}

function replaceNode(original: Node, replacement: HTMLElement, keepOriginal = false) {
    // console.log('Replacing:', original, 'with', replacement);

    assertNonNull(original.parentNode);

    if (!keepOriginal) {
        original.parentNode.replaceChild(replacement, original);
    } else {
        replacement.style.position = 'relative';
        original.parentNode.replaceChild(replacement, original);

        const wrapper = (
            <span class='jpdb-ttu-wrapper' style='position:absolute;top:0;right:0;visibility:hidden'></span>
        );

        wrapper.append(original);
        replacement.append(wrapper);
    }
}

const reverseIndex = new Map<string, { className: string; elements: JpdbWord[] }>();

export function applyParseResult(fragments: Fragment[], tokens: Token[], keepTextNodes = false) {
    // keep_text_nodes is a workaround for a ttu issue.
    //   Ttu returns to your bookmarked position at load time.
    //   To do that, it scrolls to a specific text node.
    //   If we delete those nodes, it will crash on load when a bookmark exists.
    //   Instead, we keep the existing elements by making them invisible,
    //   and positioning them at the top right corner of our new element.
    // TODO position at top left for horizontal writing
    // console.log('Applying results:', fragments, tokens);
    let tokenIndex = 0;
    let fragmentIndex = 0;
    let curOffset = 0;
    let replacement = <span class='jpdb-parsed'></span>;
    const text = fragments.map(x => x.text).join('');

    while (true) {
        if (tokenIndex >= tokens.length || fragmentIndex >= fragments.length) {
            break;
        }

        const fragment = fragments[fragmentIndex];
        const token = tokens[tokenIndex];

        // console.log('Fragment', fragment.text, `at ${fragment.offset}:${fragment.offset + fragment.length}`, fragment);
        // const spelling = token.furigana.map(p => (typeof p === 'string' ? p : p[0])).join('');
        // const reading = token.furigana.map(p => (typeof p === 'string' ? p : p[1])).join('');
        // console.log('Token', `${reading}（${spelling}）`, `at ${token.positionUtf16}:${token.positionUtf16 + token.lengthUtf16}`, token);

        if (curOffset >= fragment.offset + fragment.length) {
            replaceNode(fragment.node, replacement, keepTextNodes);
            replacement = <span class='jpdb-parsed'></span>;
            fragmentIndex++;
            // console.log('Got to end of fragment, next fragment');
            continue;
        }

        if (curOffset >= token.offset + token.length) {
            tokenIndex++;
            // console.log('Got to end of token, next token');
            continue;
        }

        // curOffset is now guaranteed to be inside a fragment, and either before or inside of a token
        if (curOffset < token.offset) {
            // There are no tokens at the current offset - emit the start of the fragment unparsed
            const headString = fragment.text.slice(curOffset - fragment.offset, token.offset - fragment.offset);
            // FIXME(Security) Not escaped
            replacement.append(<span class='jpdb-word unparsed'>{headString}</span>);
            curOffset += headString.length;
            // console.log('Emitted unparsed string', headString);
            continue;
        }

        {
            // There is a guaranteed token at the current offset
            // TODO maybe add sanity checks here to make sure the parse is plausible?
            // TODO take into account fragment furigana
            // TODO Token might overlap end of fragment... Figure out this edge case later

            const className = `jpdb-word ${token.card.state.join(' ')}`;

            const furi = token.furigana ?? [
                [fragment.text.slice(curOffset - fragment.offset, curOffset - fragment.offset + token.length), null],
            ];

            // FIXME(Security) Not escaped
            const elem = (
                <span
                    class={className}
                    onmouseenter={({ target, x, y }) => {
                        if (target === null) return;

                        currentHover = [target as JpdbWord, x, y];
                        if (popupKeyHeld) {
                            Popup.get().showForWord(target as JpdbWord, x, y);
                        }
                    }}
                    onmouseleave={() => {
                        currentHover = null;
                    }}>
                    {furiganaToRuby(furi)}
                </span>
            ) as JpdbWord;

            const idx = reverseIndex.get(`${token.card.vid}/${token.card.sid}`);
            if (idx === undefined) {
                reverseIndex.set(`${token.card.vid}/${token.card.sid}`, { className, elements: [elem] });
            } else {
                idx.elements.push(elem);
            }

            elem.jpdbData = {
                token,
                context: text,
                contextOffset: curOffset,
            };
            replacement.append(elem);
            curOffset += token.length;
            // console.log('Emitted token');
            continue;
        }
    }

    // There might be trailing text not part of any tokens - emit it unparsed
    if (fragmentIndex < fragments.length) {
        const fragment = fragments[fragmentIndex];
        if (curOffset < fragment.offset + fragment.length) {
            const tailString = fragment.text.slice(curOffset - fragment.offset);

            // FIXME(Security) Not escaped
            replacement.append(<span class='jpdb-word unparsed'>{tailString}</span>);
            // console.log('Emitted unparsed tail', tailString);
            replaceNode(fragment.node, replacement, keepTextNodes);
        }
    }
}

// Background script communication

export let config: Config;
export let defaultConfig: Config;

const waitingPromises = new Map();
let nextSeq = 0;

function postRequest(command: string, args: object) {
    const seq = nextSeq++;
    return new Promise((resolve, reject) => {
        waitingPromises.set(seq, { resolve, reject });
        port.postMessage({ command, seq, ...args });
    });
}

export async function requestParse(text: string): Promise<Token[]> {
    return (await postRequest('parse', { text })) as Token[];
}

export async function requestSetFlag(
    card: Card,
    flag: 'blacklist' | 'never-forget' | 'forq',
    state: boolean,
): Promise<unknown> {
    return await postRequest('setFlag', { vid: card.vid, sid: card.sid, flag, state });
}

export async function requestMine(
    card: Card,
    forq: boolean,
    sentence?: string,
    translation?: string,
): Promise<unknown> {
    return await postRequest('mine', { forq, vid: card.vid, sid: card.sid, sentence, translation });
}

export async function requestReview(
    card: Card,
    rating: 'nothing' | 'something' | 'hard' | 'good' | 'easy' | 'fail' | 'pass',
): Promise<unknown> {
    return await postRequest('review', { rating, vid: card.vid, sid: card.sid });
}

export async function requestUpdateConfig(changes: Partial<Config>): Promise<null> {
    return (await postRequest('updateConfig', { config: changes })) as null;
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
