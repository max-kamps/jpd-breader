'use strict';
(async () => {
    const browser = (globalThis as any).browser ?? (globalThis as any).chrome;
    const mod: typeof import('./contextmenu.js') = await import(browser.runtime.getURL('/content/contextmenu.js'));
    await mod.parseSelection();
})();
