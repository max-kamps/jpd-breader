import * as eslint from './common/eslint.js';
import * as prettier from './common/prettier.js';

console.log('Fixing lints...');
await eslint.fix();
console.log('Formatting...');
await prettier.format();

console.log('Done');
