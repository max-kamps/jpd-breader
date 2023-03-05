/* eslint-disable @typescript-eslint/no-unused-vars */
// NOTE This does not implement the entire webextensions API, only those parts I need.

type _WebExtEvent<F extends (...args: any) => any> = {
    addListener: (callback: F) => void;
    removeListener: (callback: F) => void;
    hasListener: (callback: F) => boolean;
};

declare namespace browser.tabs {
    type Tab = {
        // TODO
    };
}

declare namespace browser.runtime {
    let id: string;
    let lastError: { message?: string };

    type HasSender = 'HasSender';
    type Port<
        Kind extends HasSender | never = never,
        SenderKind extends IsContentScript | IsExtension | never = never,
    > = {
        name: string;
        sender: Kind extends HasSender ? MessageSender<SenderKind> : undefined;
        // error: {message: string},  // Firefox-only, use runtime.lastError on Chrome

        disconnect: () => void;
        postMessage: (message: any) => void; // Structured-cloneable on Firefox, JSONifiable on Chrome

        onMessage: _WebExtEvent<(message: any, port: Port) => void>;
        onDisconnect: _WebExtEvent<(port: Port) => void>;
    };

    type IsContentScript = 'IsContentScript';
    type IsExtension = 'IsExtension';
    type MessageSender<Kind extends IsContentScript | IsExtension | never = never> = {
        tab: Kind extends IsContentScript ? tabs.Tab : undefined;
        frameId: Kind extends IsContentScript ? tabs.Tab : undefined;
        id: Kind extends IsExtension ? string : undefined;
        url?: string; // TODO unclear when this can be undefined
        tlsChannelId?: string; // TODO unclear what this is, or when it can be undefined

        // documentId?: string,  // Chrome-only
        // documentLifecycle?: string,  // Chrome-only
        // nativeApplication?: string,  // Chrome-only
        // origin?: string,  // Chrome-only
    };

    type OnInstalledReason = 'install' | 'update' | 'chrome_update' | 'browser_update' | 'shared_module_update';
    type _OnInstalledDetails = {
        reason: OnInstalledReason;
    } & (
        | { reason: 'install' | 'chrome_update' | 'browser_update' }
        | { reason: 'update'; previousVersion: string }
        | { reason: 'shared_module_update'; id: string }
    );

    type OnRestartRequiredReason = 'app_update' | 'os_update' | 'periodic';

    function connect(extensionId?: string, connectInfo?: { name?: string; includeTlsChannelId?: boolean }): Port;
    function getURL(path: string): string;

    const onInstalled: _WebExtEvent<(details: _OnInstalledDetails) => void>;
    const onStartup: _WebExtEvent<() => void>;
    const onSuspend: _WebExtEvent<() => void>;
    const onSuspendCanceled: _WebExtEvent<() => void>;
    const onUpdateAvailable: _WebExtEvent<(details: { version: string }) => void>;
    const onRestartRequired: _WebExtEvent<(reason: OnRestartRequiredReason) => void>;
    const onConnect: _WebExtEvent<(port: Port<HasSender>) => void>;
    // const onConnectExternal: _WebExtEvent<TODO>;
    // const onConnectNative: _WebExtEvent<TODO>;
    // const onMessage: _WebExtEvent<TODO>;
    // const onMessageExternal: _WebExtEvent<TODO>;
}
