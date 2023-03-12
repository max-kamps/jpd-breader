import { Config, Grade, Token } from '../types';
import { Satisfies } from '../util';

type RequestCommon = {
    command: string;
    seq: number;
};

export type ErrorResponse = {
    command: 'response';
    seq: number;
    error: { message: string };
};

type ResponseCommon = {
    command: 'response';
    seq: number;
    result: unknown;
};

type NullResponse = ResponseCommon & {
    result: null;
};

export type UpdateConfigRequest = RequestCommon & {
    command: 'updateConfig';
    config: Partial<Config>;
};

export type ParseRequest = RequestCommon & {
    command: 'parse';
    text: string;
};

export type ParseResponse = ResponseCommon & {
    result: Token[];
};

export type SetFlagRequest = RequestCommon & {
    command: 'setFlag';
    vid: number;
    sid: number;
    flag: 'forq' | 'blacklist' | 'never-forget';
    state: boolean;
};

export type ReviewRequest = RequestCommon & {
    command: 'review';
    vid: number;
    sid: number;
    rating: Grade;
};

export type MineRequest = RequestCommon & {
    command: 'mine';
    vid: number;
    sid: number;
    forq: boolean;
    sentence: string | null;
    translation: string | null;
    review: Grade;
};

// NOTE Do not use undefined here, all of these types must be JSON round-trip-able
export type BackgroundRequest = UpdateConfigRequest | ParseRequest | SetFlagRequest | ReviewRequest | MineRequest;
export type BackgroundResponse = ParseResponse | NullResponse;

export type BackgroundResponseMap = Satisfies<
    {
        updateConfig: NullResponse;
        parse: ParseResponse;
        setFlag: NullResponse;
        review: NullResponse;
        mine: NullResponse;
    },
    Record<BackgroundRequest['command'], BackgroundResponse>
>;
