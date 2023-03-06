'use strict';
(async () => {
    const browser = (globalThis as any).browser ?? (globalThis as any).chrome;
    const mod: typeof import('./ttu.js') = await import(browser.runtime.getURL('/content/ttu.js'));
    await mod.startParsingVisible();
})();
