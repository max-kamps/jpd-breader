import { Token } from '../types.js';

export type JpdbWordData = {
    token: Token;
    context: string;
    contextOffset: number;
};

export type JpdbWord = HTMLElement & { jpdbData: JpdbWordData };
