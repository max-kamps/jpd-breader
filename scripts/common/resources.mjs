import fs from 'node:fs/promises';
import path from 'node:path';
import console from 'node:console';
import chokidar from 'chokidar';

async function* walkDirectory(directory) {
    for await (const entry of await fs.opendir(directory)) {
        const childPath = path.join(directory, entry.name);
        if (entry.isFile()) {
            yield childPath;
        } else if (entry.isDirectory()) {
            yield* walkDirectory(childPath);
        }
    }
}

function getDestPath(source) {
    return path.join('build', path.relative('src', source));
}

async function copyFile(source) {
    const destination = getDestPath(source);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
}

export async function copy() {
    for await (const source of walkDirectory('src')) {
        if (source.match(/\.tsx?$/) === null) {
            await copyFile(source);
        }
    }
}

export async function watch() {
    const watcher = chokidar.watch('src', {
        ignored: /\.tsx?$/,
        disableGlobbing: true,
    });

    watcher
        .on('add', async path => {
            console.log(`[resource] File ${path} has been added`);
            await copyFile(path);
        })
        .on('change', async path => {
            console.log(`[resource] File ${path} has been changed`);
            await copyFile(path);
        })
        .on('unlink', async path => {
            console.log(`[resource] File ${path} has been unlinked`);
            await fs.rm(getDestPath(path), { force: true });
        })
        .on('addDir', async path => {
            console.log(`[resource] Dir ${path} has been added`);
        })
        .on('unlinkDir', async path => {
            console.log(`[resource] Dir ${path} has been unlinked`);
            await fs.rm(getDestPath(path), { recursive: true, force: true });
        })
        .on('error', error => {
            console.error('[resource] Error:', error);
        })
        .on('ready', () => {
            console.log('[resource] Initial scan finished');
        });
}
