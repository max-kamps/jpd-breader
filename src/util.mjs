/**
 * @param {boolean} condition 
 * @param {string} message 
 * @returns {asserts condition}
 */
export function assert(condition, message) {
    if (!condition) {
        debugger;
        throw Error(`Failed assertion: ${message}`);
    }
}

/**
 * Convenient wrapper to turn object-with-callbacks APIs like IndexedDB or XMLHttpRequest into promises.
 * 
 * @template Obj, Return
 * @param {Obj} obj 
 * @param {(obj: Obj, resolve: (value: Return|PromiseLike<Return>) => void, reject: (reason: any) => void) => Return|PromiseLike<Return>} func 
 * @returns {Promise<Return>}
 */
export function wrap(obj, func) {
    return new Promise((resolve, reject) => { func(obj, resolve, reject) });
}

/**
 * Sleep for the specified number of milliseconds, then resolve
 * 
 * @param {number} timeMillis 
 * @returns {Promise<void>}
 */
export function sleep(timeMillis) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, timeMillis);
    })
}

/**
 * Convert snake_case to camelCase
 * 
 * @param {string} string 
 * @returns {string}
 */
export function snakeToCamel(string) {
    return string.replaceAll(/(?<!^_*)_(.)/g, (m, p1) => p1.toUpperCase())
}

/**
 * Read from an extension-relative file
 * 
 * @param {string} path 
 * @returns {Promise<string>}
 */
export async function readExtFile(path) {
    try {
        const resp = await fetch(browser.runtime.getURL(path));
        return await resp.text();
    }
    catch (error) {
        throw new Error(`Could not read file: ${error.message}`, { cause: error })
    }
}

/**
 * Template tag for creating an html element from a string
 * 
 * @param {{raw: readonly string[] | ArrayLike<string>}} strings 
 * @param  {...any} substitutions 
 * @returns {Element}
 */
export function html(strings, ...substitutions) {
    var template = document.createElement('template');
    template.innerHTML = String.raw(strings, ...substitutions).trim();
    assert(template.children.length === 1, 'html`...` must only contain one element');
    return template.children[0];
}
