/* eslint-disable @typescript-eslint/no-unused-vars */
// NOTE This does not implement the entire webextensions API, only those parts I need.
// NOTE This should only include features available in both Firefox and Chrome

type _WebExtEvent<F extends (...args: any) => any> = {
    addListener: (callback: F) => void;
    removeListener: (callback: F) => void;
    hasListener: (callback: F) => boolean;
};

type MaybeOptional<T, Present> = (Present extends true ? T : never) | (Present extends false ? undefined : never);

declare namespace browser.runtime {
    let id: string;
    let lastError: { message?: string };

    type Port<MessageSenderType extends MessageSender = MessageSender> = {
        name: string;
        sender: MessageSenderType; // Docs say this might be undefined outside of onConnect, but it never is for me
        // error: {message: string},  // Firefox-only, use runtime.lastError on Chrome

        disconnect: () => void;
        postMessage: (message: any) => void; // Structured-cloneable on Firefox, JSONifiable on Chrome

        onMessage: _WebExtEvent<(message: any, port: Port) => void>;
        onDisconnect: _WebExtEvent<(port: Port) => void>;
    };

    type ContentScriptPort = browser.runtime.Port<browser.runtime.MessageSender<true, true>>;
    type ExtensionPort = browser.runtime.Port<browser.runtime.MessageSender<true>>;

    type MessageSender<
        IsExtension extends true | false = true | false,
        IsContentScript extends IsExtension | false = IsExtension | false,
    > = {
        id: MaybeOptional<string, IsExtension>;
        tab: MaybeOptional<tabs.Tab, IsContentScript>;
        frameId: MaybeOptional<tabs.Tab, IsContentScript>;
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
    function getManifest(): typeof import('../src/manifest.json');

    const onInstalled: _WebExtEvent<(details: _OnInstalledDetails) => void>;
    const onStartup: _WebExtEvent<() => void>;
    const onSuspend: _WebExtEvent<() => void>;
    const onSuspendCanceled: _WebExtEvent<() => void>;
    const onUpdateAvailable: _WebExtEvent<(details: { version: string }) => void>;
    const onRestartRequired: _WebExtEvent<(reason: OnRestartRequiredReason) => void>;
    const onConnect: _WebExtEvent<(port: Port) => void>;
    // const onConnectExternal: _WebExtEvent<TODO>;
    // const onConnectNative: _WebExtEvent<TODO>;
    // const onMessage: _WebExtEvent<TODO>;
    // const onMessageExternal: _WebExtEvent<TODO>;
}

declare namespace browser.tabs {
    type MutedInfoReason = 'capture' | 'extension' | 'user';
    type MutedInfo = {
        muted: boolean;
        reason?: MutedInfoReason;
        extensionId?: string;
    };

    type Tab = {
        id: number; // can actually be undefined (when using session foreign tabs), but not in our case
        index: number;
        windowId: number;
        sessionId?: string;
        openerTabId?: number;
        status: 'loading' | 'complete';

        active: boolean;
        highlighted: boolean;
        pinned: boolean;
        audible?: boolean;
        mutedInfo: MutedInfo;
        incognito: boolean;
        autoDiscardable?: boolean;
        discarded?: boolean;

        title?: string; // Only available with 'tabs' or host permission
        url?: string; // Only available with 'tabs' or host permission
        favIconUrl?: string; // Only available with 'tabs' or host permission

        width?: number;
        height?: number;
    };

    const TAB_ID_NONE: number;

    type _InjectDetails = {
        allFrames?: boolean;
        frameId?: number;
        matchAboutBlank?: boolean;

        file?: `/${string}`; // Chrome and Firefox handle relative URLs differently, so must start with / to be cross-browser
        code?: string;
    };

    type _ExecuteScriptDetails = _InjectDetails & {
        runAt?: 'document_start' | 'document_end' | 'document_idle';
    };

    type _InsertStyleDetails = _InjectDetails & {
        runAt?: 'document_start' | 'document_end' | 'document_idle';
        cssOrigin?: 'author' | 'user';
    };

    type _RemoveStyleDetails = _InjectDetails & {
        cssOrigin?: 'author' | 'user';
    };

    function executeScript(tabId: number, details: _ExecuteScriptDetails): Promise<any[]>;
    function executeScript(details: _ExecuteScriptDetails): Promise<any[]>;

    function insertCSS(tabId: number | undefined, details: _InsertStyleDetails): Promise<void>;
    function insertCSS(details: _InsertStyleDetails): Promise<void>;

    function removeCSS(tabId: number, details: _RemoveStyleDetails): Promise<void>;
    function removeCSS(details: _RemoveStyleDetails): Promise<void>;
    function query(
        queryInfo: { active?: boolean; currentWindow?: boolean },
        callback: (tabs: Tab[]) => void,
    ): Promise<Tab[]>;
}

declare namespace browser.contextMenus {
    type ContextType =
        | 'all'
        | 'page'
        | 'frame'
        | 'selection'
        | 'link'
        | 'editable'
        | 'image'
        | 'video'
        | 'audio'
        | 'browser_action'
        | 'page_action';

    type _CreateDetails = {
        contexts?: ContextType[];
        documentUrlPatterns?: string[];
        id: string; // Actually optional for persistent V2 pages
        parentId?: string | number;
        enabled?: boolean;
        visible?: boolean;
        type?: 'normal' | 'checkbox' | 'radio' | 'separator';
        title: string;
        checked?: boolean;
        // onclick: ... // Only available for persistent pages
    };

    function create(createProperties: _CreateDetails, callback?: () => void): string | number;

    type OnClickData = {
        menuItemId: string | number;
        parentMenuItemId?: string | number;

        pageUrl?: string;
        frameId?: number;
        frameUrl?: string;

        editable: boolean;
        linkUrl?: string;
        srcUrl?: string;
        mediaType?: 'image' | 'video' | 'audio';
        selectionText?: string;
        checked?: boolean;
        wasChecked?: boolean;
    };

    const onClicked: _WebExtEvent<(info: OnClickData, tab: tabs.Tab) => void>;
}

declare let chrome: typeof browser;
