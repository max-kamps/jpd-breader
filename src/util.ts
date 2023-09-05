export const [browser, isChrome] = (() => {
    if (globalThis.browser !== undefined) {
        return [globalThis.browser, false];
    } else {
        return [chrome, true];
    }
})();

export type Satisfies<T extends U, U> = T;

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
) => void;

/** Convenient wrapper to turn object-with-callbacks APIs like IndexedDB or XMLHttpRequest into promises. */
export function wrap<Obj, Return>(obj: Obj, func: WrapCallback<Obj, Return>): Promise<Return> {
    return new Promise((resolve, reject) => {
        func(obj, resolve, reject);
    });
}

/** Sleep for the specified number of milliseconds, then resolve */
export function sleep(timeMs: number): Promise<void> {
    return new Promise((resolve, _reject) => {
        setTimeout(resolve, timeMs);
    });
}

export function clamp(num: number, min: number, max: number) {
    return Math.min(Math.max(num, min), max);
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

export type PromiseHandle<T> = {
    resolve(value: T): void;
    reject(reason: { message: string }): void;
};

export class Canceled extends Error {}
