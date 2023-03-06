'use strict';
(async () => {
    await import((browser ?? chrome).runtime.getURL('/content/contextmenu.js'));
})();
