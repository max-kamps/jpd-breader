export type Grade = 'nothing' | 'something' | 'hard' | 'good' | 'easy' | 'pass' | 'fail' | 'known' | 'unknown';

export type DeckId = number | 'blacklist' | 'never-forget' | 'forq';

export type Keybind = { key: string; code: string; modifiers: string[] } | null;

// Common types shared across both content and background scripts
export type Config = {
    apiToken: string | null;

    miningDeckId: DeckId | null;
    forqDeckId: DeckId | null;
    blacklistDeckId: DeckId | null;
    neverForgetDeckId: DeckId | null;

    contextWidth: number;
    forqOnMine: boolean;

    customWordCSS: string;
    customPopupCSS: string;

    showPopupKey: Keybind;
    addKey: Keybind;
    dialogKey: Keybind;
    blacklistKey: Keybind;
    neverForgetKey: Keybind;
    nothingKey: Keybind;
    somethingKey: Keybind;
    hardKey: Keybind;
    goodKey: Keybind;
    easyKey: Keybind;
};

export type Ruby = {
    text: string | null;
    start: number;
    end: number;
    length: number;
};

export type Token = {
    start: number;
    end: number;
    length: number;
    card: Card;
    rubies: Ruby[];
};

export type CardState = string[] &
    (
        | ['new' | 'learning' | 'known' | 'never-forget' | 'due' | 'failed' | 'suspended' | 'blacklisted']
        | ['redundant', 'learning' | 'known' | 'never-forget' | 'due' | 'failed' | 'suspended']
        | ['locked', 'new' | 'due' | 'failed']
        | ['redundant', 'locked'] // Weird outlier, might either be due or failed
        | ['not-in-deck']
    );

export type Card = {
    vid: number;
    sid: number;
    rid: number;
    state: CardState;
    spelling: string;
    reading: string;
    frequencyRank: number | null;
    meanings: string[];
};
