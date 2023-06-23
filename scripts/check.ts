import * as eslint from './common/eslint.js';
import * as typescript from './common/typescript.js';
import * as prettier from './common/prettier.js';

console.log('Checking types...');
const typeErrors = await typescript.typecheck();
console.log('Linting...');
const lintErrors = await eslint.lint();
console.log('Checking formatting...');
const formattingErrors = await prettier.check();

const totalErrors = typeErrors + lintErrors + formattingErrors;

console.log(`Results: ${typeErrors} type errors, ${lintErrors} lint errors, ${formattingErrors} formatting errors.`);
console.log(totalErrors === 0 ? 'Check passed!' : 'Check failed!');
process.exit(totalErrors);
