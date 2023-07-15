import * as console from 'node:console';
import { ESLint } from 'eslint';

export async function lint() {
    try {
        const eslint = new ESLint();
        const formatter = await eslint.loadFormatter('stylish');

        const lintResults = await eslint.lintFiles('src');

        console.log(formatter.format(lintResults));

        return lintResults.reduce((count, result) => count + result.errorCount + result.warningCount, 0);
    } catch (error) {
        console.error(error);
        return 1;
    }
}

export async function fix() {
    try {
        const eslint = new ESLint();
        const formatter = await eslint.loadFormatter('stylish');

        const lintResults = await eslint.lintFiles('src');
        await ESLint.outputFixes(lintResults);

        console.log(formatter.format(lintResults));

        return lintResults.reduce((count, result) => count + result.errorCount + result.warningCount, 0);
    } catch (error) {
        console.error(error);
        return 1;
    }
}
