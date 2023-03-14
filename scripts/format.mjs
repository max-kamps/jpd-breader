import console from 'node:console';
import * as eslint from './common/eslint.mjs';
import * as prettier from './common/prettier.mjs';

console.log('Fixing lints...');
await eslint.fix();
console.log('Formatting...');
await prettier.format();

console.log('Done');
