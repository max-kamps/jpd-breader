import * as api from "./backend_api.mjs";
import * as scrape from "./backend_scrape.mjs";
import { sleep } from "../util.mjs";
import { config } from "./background.mjs";


const pendingAPICalls = [];
let callerRunning = false;
async function apiCaller() {
    // If no API calls are pending, stop running
    if (callerRunning || pendingAPICalls.length === 0)
        // Only run one instance of this function at a time
        return;

    callerRunning = true;

    while (pendingAPICalls.length > 0) {
        // Get first call from queue
        const call = pendingAPICalls.shift();
        console.log('Servicing API call:', call);

        try {
            let resultAndWait;

            switch (call.command) {
                case 'parse': {
                    const func = (config.useScraping ? scrape : api).parse;
                    resultAndWait = await func(call.text);
                } break;

                case 'addToDeck': {
                    const func = call.deckId === 'forq' ? scrape.addToForq : api.addToDeck;
                    resultAndWait = await func(call.vid, call.sid, call.deckId);
                } break;

                case 'setSentence': {
                    resultAndWait = await api.setSentence(call.vid, call.sid, call.sentence, call.translation);
                } break;

                case 'review': {
                    resultAndWait = await scrape.review(call.vid, call.sid, call.rating);
                } break;

                default:
                    call.reject('Unknown command');
            }

            const [result, wait] = resultAndWait
            call.resolve(result);
            await sleep(wait);
        }
        catch (error) {
            call.reject(error);
            // TODO implement exponential backoff
            await sleep(1500);
        }
    }

    callerRunning = false;
}

export function apiCall(command, args) {
    return new Promise((resolve, reject) => {
        console.log('Enqueueing API call:', command, args)
        pendingAPICalls.push({ command, ...args, resolve, reject });
        apiCaller();
    });
}