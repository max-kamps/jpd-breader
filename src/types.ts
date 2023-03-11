type DeckId = number | 'blacklist' | 'never-forget' | 'forq';

// Common types shared across both content and background scripts
export type Config = {
    apiToken: string | null;

    miningDeckId: DeckId | null;
    forqDeckId: DeckId | null;
    blacklistDeckId: DeckId | null;
    neverForgetDeckId: DeckId | null;

    customWordCSS: string;
    customPopupCSS: string;

    showPopupKey: string | null;
    blacklistKey: string | null;
    neverForgetKey: string | null;
    nothingKey: string | null;
    somethingKey: string | null;
    hardKey: string | null;
    goodKey: string | null;
    easyKey: string | null;
};

export type Token = {
    offset: number;
    length: number;
    card: Card;
    furigana: null | [string, string | null][];
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
