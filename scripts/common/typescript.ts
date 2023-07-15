import * as path from 'node:path';
import ts from 'typescript';
import { rewriteImportsTransform, removeAnnoyingDefaultExportTransform } from '../transformers/content_script.js';

const transformers = {
    before: [rewriteImportsTransform],
    after: [removeAnnoyingDefaultExportTransform],
};

const sys: ts.System = {
    ...ts.sys,
    writeFile(path, content, bom) {
        console.log(`[typescript] Wrote file ${path}`);
        ts.sys.writeFile(path, content, bom);
    },
};

function reportDiagnostic(diagnostic: ts.Diagnostic) {
    if (diagnostic.file && diagnostic.start) {
        const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        console.log(`[typescript] ${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
    } else {
        console.log(`[typescript] ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
    }
}

function reportDiagnostics(diagnostics: readonly ts.Diagnostic[]) {
    for (const diagnostic of diagnostics) {
        reportDiagnostic(diagnostic);
    }
}

function readConfig(configPath: string): [number, ts.ParsedCommandLine | null] {
    const configJsonResult = ts.readConfigFile(configPath, sys.readFile);
    const configJson = configJsonResult.config;
    if (!configJson) {
        if (configJsonResult.error) {
            reportDiagnostic(configJsonResult.error);
        }

        return [1, null];
    }

    const configResult = ts.parseJsonConfigFileContent(configJson, sys, path.dirname(configPath));
    if (configResult.errors.length > 0) {
        reportDiagnostics(configResult.errors);
    }
    return [configResult.errors.length, configResult];
}

export async function typecheckConfig(configPath: string): Promise<number> {
    try {
        const [configErrors, config] = readConfig(configPath);
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

export async function typecheck(): Promise<number> {
    return (await typecheckConfig('scripts/tsconfig.json')) + (await typecheckConfig('tsconfig.json'));
}

export async function compile(): Promise<boolean> {
    try {
        const [_configErrors, config] = readConfig('tsconfig.json');
        if (!config) {
            return false;
        }

        config.options.noEmitOnError = true;

        const program = ts.createProgram(config.fileNames, config.options);
        const emitResult = program.emit(undefined, undefined, undefined, undefined, transformers);
        const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
        reportDiagnostics(diagnostics);

        return !emitResult.emitSkipped;
    } catch (error) {
        console.error(error);
        return false;
    }
}

function buildProject(builder: ts.SolutionBuilder<ts.EmitAndSemanticDiagnosticsBuilderProgram>) {
    const project = builder.getNextInvalidatedProject();
    if (project) {
        console.log(
            `[typescript] Invalidated project ${project.project}, kind: ${ts.InvalidatedProjectKind[project.kind]}`,
        );
        if (project.kind == ts.InvalidatedProjectKind.Build) {
            const emitResult = project.emit(undefined, undefined, undefined, undefined, transformers);

            if (emitResult) {
                reportDiagnostics(emitResult.diagnostics);
            }
        }
    }
}

export async function watch() {
    const [_configErrors, config] = readConfig('tsconfig.json');
    if (!config) {
        return false;
    }

    config.options.noEmitOnError = false;

    const host = ts.createSolutionBuilderWithWatchHost(
        sys,
        ts.createEmitAndSemanticDiagnosticsBuilderProgram,
        reportDiagnostic,
        reportDiagnostic,
        diagnostic => {
            reportDiagnostic(diagnostic);
            buildProject(builder);
        },
    );

    const builder = ts.createSolutionBuilderWithWatch(host, ['.'], {}, config.watchOptions);

    buildProject(builder);
    builder.build();

    return true;
}
