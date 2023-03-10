export const [browser, isChrome] = (() => {
    if (globalThis.browser !== undefined) {
        return [globalThis.browser, false];
    } else {
        return [chrome, true];
    }
})();

export function assert(condition: boolean, message: string): asserts condition {
    if (!condition) {
        debugger;
        throw Error(`Failed assertion: ${message}`);
    }
}

export function assertNonNull<T>(obj: T): asserts obj is NonNullable<T> {
    if (obj === null || obj === undefined) {
        debugger;
        throw Error(`Failed assertion: expected object to not be null/undefined`);
    }
}

export function nonNull<T>(obj: T): NonNullable<T> {
    if (obj === null || obj === undefined) {
        debugger;
        throw Error(`Failed assertion: expected object to not be null/undefined`);
    }

    return obj as NonNullable<T>;
}

type WrapCallback<Obj, Return> = (
    obj: Obj,
    resolve: (value: Return | PromiseLike<Return>) => void,
    reject: (reason: any) => void,
) => Return | PromiseLike<Return>;

/** Convenient wrapper to turn object-with-callbacks APIs like IndexedDB or XMLHttpRequest into promises. */
export function wrap<Obj, Return>(obj: Obj, func: WrapCallback<Obj, Return>): Promise<Return> {
    return new Promise((resolve, reject) => {
        func(obj, resolve, reject);
    });
}

/** Sleep for the specified number of milliseconds, then resolve */
export function sleep(timeMillis: number): Promise<void> {
    return new Promise((resolve, _reject) => {
        setTimeout(resolve, timeMillis);
    });
}

/** Read from an extension-relative file */
export async function readExtFile(path: string): Promise<string> {
    try {
        const resp = await fetch(browser.runtime.getURL(path));
        return await resp.text();
    } catch (error) {
        throw new Error(`Could not read file ${path}: ${error.message}`, { cause: error });
    }
}

export function snakeToCamel(string: string): string {
    return string.replaceAll(/(?<!^_*)_(.)/g, (m, p1) => p1.toUpperCase());
}

export function truncate(string: string, maxLength: number): string {
    return string.length <= maxLength ? string : string.slice(0, maxLength - 1) + '…';
}

export function jsxCreateElement<Tag extends keyof HTMLElementTagNameMap>(
    name: Tag,
    props: { [id: string]: any } | null,
    ...content: (string | HTMLElement)[]
): HTMLElementTagNameMap[Tag] {
    const elem = document.createElement(name);

    if (props) {
        for (const [key, value] of Object.entries(props)) {
            if (key.startsWith('on')) {
                if (value instanceof Function) {
                    elem.addEventListener(key.replace(/^on/, ''), async (...args: any) => {
                        try {
                            await value(...args);
                        } catch (error) {
                            showError(error);
                        }
                    });
                } else {
                    elem.addEventListener(key.replace(/^on/, ''), value);
                }
            } else if (value !== false) {
                elem.setAttribute(key, value);
            }
        }
    }

    elem.append(...content.flat());

    return elem;
}

export function showError(error: { message: string }) {
    console.error(error);
    alert(`Error: ${error.message}`); // TODO replace with proper toast?
}
