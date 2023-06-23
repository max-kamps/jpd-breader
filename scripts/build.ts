import { createWriteStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import archiver from 'archiver';
import * as eslint from './common/eslint.js';
import * as typescript from './common/typescript.js';
import * as prettier from './common/prettier.js';
import * as resources from './common/resources.js';

const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
const packageName = packageJson.name;
const packageVersion = packageJson.version;
const manifestVersion = JSON.parse(await fs.readFile('src/manifest.json', 'utf-8')).version;

if (packageVersion !== manifestVersion) {
    console.log(`Versions in package.json (${packageVersion}) and src/manifest.json (${manifestVersion}) don't match!`);
    process.exit(1);
}

console.log(`Building version ${manifestVersion}`);
console.log('Cleaning existing build files...');
await fs.rm('build', { recursive: true, force: true });
await fs.rm('dist', { recursive: true, force: true });
console.log('Formatting...');
const formatSuccessful = await prettier.format();
console.log('Fixing lint errors...');
const lintErrors = (await eslint.fix()) && 0;
console.log('Compiling typescript...');
const compileSuccessful = await typescript.compile();
console.log('Copying resources...');
await resources.copy();

const success = formatSuccessful && lintErrors === 0 && compileSuccessful;
if (!success) {
    console.log('\nCompilation failed! Reasons:');
    if (!formatSuccessful) console.log('- Could not format source code');
    if (lintErrors !== 0) console.log('- Unfixable lint errors are present');
    if (!compileSuccessful) console.log('- Type errors are present');

    process.exit(1);
} else {
    console.log('Compilation successful!');
}

await fs.mkdir('dist');

console.log('Creating output zip...');
const outputArchiveStream = createWriteStream(`dist/${packageName}_${packageVersion}.zip`);
const outputArchive = archiver('zip', { zlib: { level: 9 } });
outputArchive.pipe(outputArchiveStream);
outputArchive.directory('build', '');
outputArchive.finalize();

console.log('Creating source zip...');
const sourceArchiveStream = createWriteStream(`dist/source_${packageVersion}.zip`);
const sourceArchive = archiver('zip', { zlib: { level: 9 } });
sourceArchive.pipe(sourceArchiveStream);
sourceArchive.directory('dev_types', 'dev_types');
sourceArchive.directory('scripts', 'scripts');
sourceArchive.directory('src', 'src');
sourceArchive.glob('*.md');
sourceArchive.glob('package*.json');
sourceArchive.glob('.*ignore');
sourceArchive.glob('.*rc.json');
sourceArchive.file('tsconfig.json', { name: 'tsconfig.json' });
sourceArchive.finalize();
