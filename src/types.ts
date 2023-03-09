type DeckId = number | 'blacklist' | 'never-forget' | 'forq';

// Common types shared across both content and background scripts
export type Config = {
    apiToken: string;

    miningDeckId: DeckId;
    forqDeckId: DeckId;
    blacklistDeckId: DeckId;
    neverForgetDeckId: DeckId;

    customWordCSS: string;
    customPopupCSS: string;
    wordCSS: string;
    popupCSS: string;
    dialogCSS: string;
};

export type Token = {
    offset: number;
    length: number;
    card: Card;
    furigana: null | [string, string | undefined][];
};

export type CardState =
    | ['new' | 'learning' | 'known' | 'never-forget' | 'due' | 'failed' | 'suspended' | 'blacklisted']
    | ['redundant', 'learning' | 'known' | 'never-forget' | 'due' | 'failed' | 'suspended']
    | ['locked', 'new' | 'due' | 'failed']
    | ['redundant', 'locked'] // Weird outlier, might either be due or failed
    | ['not-in-deck'];

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
