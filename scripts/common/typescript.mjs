import console from 'node:console';
import path from 'node:path';
import ts from 'typescript';

function reportDiagnostic(diagnostic) {
    if (diagnostic.file) {
        let { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
        let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
    } else {
        console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    }
}

function reportDiagnostics(diagnostics) {
    for (const diagnostic of diagnostics) {
        reportDiagnostic(diagnostic);
    }
}

const formatHost = {
    getCanonicalFileName: path => path,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine,
};

function reportWatchStatusChanged(diagnostic) {
    console.info('[typescript]', ts.formatDiagnostic(diagnostic, formatHost).trimEnd());
}

function readConfig(configPath) {
    const configJsonResult = ts.readConfigFile(configPath, ts.sys.readFile);
    const configJson = configJsonResult.config;
    if (!configJson) {
        reportDiagnostics([configJsonResult.error]);
        return [1, null];
    }

    const configResult = ts.parseJsonConfigFileContent(configJson, ts.sys, path.dirname(configPath));
    if (configResult.errors.length > 0) {
        reportDiagnostics(configResult.errors);
    }
    return [configResult.errors.length, configResult];
}

export async function typecheck() {
    try {
        const [configErrors, config] = readConfig('tsconfig.json');
        if (!config) {
            return configErrors;
        }

        config.options.noEmit = true;

        const program = ts.createProgram(config.fileNames, config.options);
        const diagnostics = ts.getPreEmitDiagnostics(program).concat(program.emit().diagnostics);
        reportDiagnostics(diagnostics);

        return configErrors + diagnostics.length;
    } catch (error) {
        console.error(error);
        return 1;
    }
}

export async function compile() {
    try {
        const [configErrors, config] = readConfig('tsconfig.json');
        if (!config) {
            return false;
        }

        config.noEmitOnError = true;

        const program = ts.createProgram(config.fileNames, config.options);
        const emitResult = program.emit();
        const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
        reportDiagnostics(diagnostics);

        return !emitResult.emitSkipped;
    } catch (error) {
        console.error(error);
        return false;
    }
}

export async function watch() {
    const config = readConfig('tsconfig.json');
    if (!config) {
        return false;
    }

    config.noEmitOnError = false;

    const createProgram = ts.createSemanticDiagnosticsBuilderProgram;

    const host = ts.createWatchCompilerHost(
        'tsconfig.json',
        config,
        ts.sys,
        createProgram,
        reportDiagnostic,
        reportWatchStatusChanged,
    );

    //   const origCreateProgram = host.createProgram;
    //   host.createProgram = (rootNames, options, host, oldProgram) => {
    //     console.log("** We're about to create the program! **");
    //     return origCreateProgram(rootNames, options, host, oldProgram);
    //   };
    //   const origPostProgramCreate = host.afterProgramCreate;

    //   host.afterProgramCreate = program => {
    //     console.log("** We finished making the program! **");
    //     origPostProgramCreate!(program);
    //   };

    ts.createWatchProgram(host);
}
