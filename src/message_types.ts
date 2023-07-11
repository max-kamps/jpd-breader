import { CardState, Grade, Token } from './types.js';
import { Config } from './background/config.js';
import { Satisfies } from './util.js';

// NOTE All of these types must be JSON round-trip-able.
// That also means you cannot use undefined or ? optional fields

export type ContentToBackgroundMessage =
    | CancelCommand
    | UpdateConfigRequest
    | ParseRequest
    | SetFlagRequest
    | ReviewRequest
    | MineRequest;

export type BackgroundToContentMessage =
    | UpdateConfigCommand
    | UpdateWordStateCommand
    | ParseResponse
    | NullResponse
    | ErrorResponse
    | CanceledResponse;

export type ResponseTypeMap = Satisfies<
    {
        updateConfig: NullResponse;
        parse: ParseResponse;
        setFlag: NullResponse;
        review: NullResponse;
        mine: NullResponse;
        cancel: never;
    },
    Record<ContentToBackgroundMessage['type'], BackgroundToContentMessage | never>
>;

export type CancelCommand = {
    type: 'cancel';
    seq: number;
};

export type UpdateConfigRequest = {
    type: 'updateConfig';
    seq: number;
};

export type ParseRequest = {
    type: 'parse';
    texts: [number, string][];
};

export type SetFlagRequest = {
    type: 'setFlag';
    seq: number;
    vid: number;
    sid: number;
    flag: 'forq' | 'blacklist' | 'never-forget';
    state: boolean;
};

export type ReviewRequest = {
    type: 'review';
    seq: number;
    vid: number;
    sid: number;
    rating: Grade;
};

export type MineRequest = {
    type: 'mine';
    seq: number;
    vid: number;
    sid: number;
    forq: boolean;
    sentence: string | null;
    translation: string | null;
    review: Grade;
};

type ResponseCommon = {
    type: string;
    seq: number;
};

export type ErrorResponse = ResponseCommon & {
    type: 'error';
    error: Error | { message: string; stack: string | undefined };
};

export type CanceledResponse = ResponseCommon & {
    type: 'canceled';
};

export type NullResponse = ResponseCommon & {
    type: 'success';
    result: null;
};

export type ParseResponse = ResponseCommon & {
    type: 'success';
    result: Token[];
};

export type UpdateConfigCommand = {
    type: 'updateConfig';
    config: Config;
};

export type UpdateWordStateCommand = {
    type: 'updateWordState';
    words: [number, number, CardState][];
};
