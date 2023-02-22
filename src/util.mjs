export function wrap(obj, func) {
    return new Promise((resolve, reject) => { func(obj, resolve, reject) });
}

export function sleep(timeMillis) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, timeMillis);
    })
}

export function snakeToCamel(string) {
    return string.replaceAll(/(?<!^_*)_(.)/g, (m, p1) => p1.toUpperCase())
}

export async function readExtFile(path) {
    const resp = await fetch(browser.runtime.getURL(path));
    return await resp.text();
}

export function html(strings, ...substitutions) {
    var template = document.createElement('template');
    template.innerHTML = String.raw(strings, ...substitutions).trim();
    return template.content.firstElementChild;
}
