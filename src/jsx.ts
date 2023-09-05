import { showError } from './content/toast.js';

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
