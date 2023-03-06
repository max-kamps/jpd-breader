'use strict';
(async () => {
    await import(((globalThis as any).browser ?? (globalThis as any).chrome).runtime.getURL('/content/contextmenu.js'));
})();
