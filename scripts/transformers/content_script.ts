import ts from 'typescript';
import * as path from 'node:path';

const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: true,
    omitTrailingSemicolon: true,
});

type Binding = [ts.Identifier, ts.Identifier | undefined];
type Import = { modulePath: string; namespace?: ts.Identifier; bindings: Binding[] };

function parseEsImport(sourceFile: ts.SourceFile, factory: ts.NodeFactory, node: ts.ImportDeclaration): Import {
    const modulePath = path.join(
        '/',
        path.relative(
            'src',
            path.join(path.dirname(sourceFile.fileName), (node.moduleSpecifier as ts.StringLiteral).text),
        ),
    );
    const defaultName = node.importClause?.name;

    const bindings: Binding[] = [];

    if (defaultName) bindings.push([defaultName, factory.createIdentifier('default')]);

    let namespace: ts.Identifier | undefined = undefined;

    const namedBindings = node.importClause?.namedBindings;
    if (namedBindings) {
        if (ts.isNamespaceImport(namedBindings)) {
            namespace = namedBindings.name;
        } else if (ts.isNamedImports(namedBindings)) {
            bindings.push(...namedBindings.elements.map(spec => [spec.name, spec.propertyName] as Binding));
        }
    }

    return { modulePath, namespace, bindings };
}

function createContentScriptImport(
    sourceFile: ts.SourceFile,
    factory: ts.NodeFactory,
    importData: Import,
): ts.Statement {
    const importCall = factory.createAwaitExpression(
        factory.createCallExpression(factory.createIdentifier('$import'), undefined, [
            factory.createStringLiteral(importData.modulePath),
        ]),
    );

    const decls: ts.VariableDeclaration[] = [];

    if (importData.namespace) {
        decls.push(factory.createVariableDeclaration(importData.namespace, undefined, undefined, importCall));
    }

    if (importData.bindings.length) {
        decls.push(
            factory.createVariableDeclaration(
                factory.createObjectBindingPattern(
                    importData.bindings.map(([name, propertyName]) =>
                        factory.createBindingElement(undefined, propertyName, name, undefined),
                    ),
                ),
                undefined,
                undefined,
                importData.namespace ?? importCall,
            ),
        );
    }

    const varDecl = factory.createVariableStatement(
        undefined,
        factory.createVariableDeclarationList(decls, ts.NodeFlags.Const),
    );

    return varDecl;
}

function createWrapper(sourceFile: ts.SourceFile, factory: ts.NodeFactory) {
    // (async () => {
    //     'use strict';
    //     const $browser = globalThis.browser ?? globalThis.chrome,
    //         $import = path => import($browser.runtime.getURL(path));
    //
    //     ... module code here, with all imports replaced with something like ...
    //     const {... imports} = await $import('/module.js');
    // })();

    const useStrict = factory.createExpressionStatement(factory.createStringLiteral('use strict'));
    const browserDecl = factory.createVariableDeclaration(
        factory.createIdentifier('$browser'),
        undefined,
        undefined,
        factory.createBinaryExpression(
            factory.createPropertyAccessExpression(
                factory.createIdentifier('globalThis'),
                factory.createIdentifier('browser'),
            ),
            factory.createToken(ts.SyntaxKind.QuestionQuestionToken),
            factory.createPropertyAccessExpression(
                factory.createIdentifier('globalThis'),
                factory.createIdentifier('chrome'),
            ),
        ),
    );
    const importDecl = factory.createVariableDeclaration(
        factory.createIdentifier('$import'),
        undefined,
        undefined,
        factory.createArrowFunction(
            undefined,
            undefined,
            [
                factory.createParameterDeclaration(
                    undefined,
                    undefined,
                    factory.createIdentifier('path'),
                    undefined,
                    undefined,
                    undefined,
                ),
            ],
            undefined,
            factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            factory.createCallExpression(
                factory.createToken(ts.SyntaxKind.ImportKeyword) as any as ts.Identifier,
                undefined,
                [
                    factory.createCallExpression(
                        factory.createPropertyAccessExpression(
                            factory.createPropertyAccessExpression(
                                factory.createIdentifier('$browser'),
                                factory.createIdentifier('runtime'),
                            ),
                            factory.createIdentifier('getURL'),
                        ),
                        undefined,
                        [factory.createIdentifier('path')],
                    ),
                ],
            ),
        ),
    );

    const decls = factory.createVariableStatement(
        undefined,
        factory.createVariableDeclarationList(
            [browserDecl, importDecl],
            ts.NodeFlags.Const | ts.NodeFlags.AwaitContext | ts.NodeFlags.ContextFlags | ts.NodeFlags.TypeExcludesFlags,
        ),
    );

    const asyncIife = factory.createExpressionStatement(
        factory.createCallExpression(
            factory.createParenthesizedExpression(
                factory.createArrowFunction(
                    [factory.createToken(ts.SyntaxKind.AsyncKeyword)],
                    undefined,
                    [],
                    undefined,
                    factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                    factory.createBlock([useStrict, decls, ...sourceFile.statements], true),
                ),
            ),
            undefined,
            [],
        ),
    );

    return factory.updateSourceFile(sourceFile, [asyncIife]);
}

function isContentScript(sourceFile: ts.SourceFile) {
    const fullText = sourceFile.getFullText();
    const commentRanges = ts.getLeadingCommentRanges(fullText, sourceFile.pos);

    const comments =
        commentRanges?.map(r =>
            fullText.slice(r.pos + 2, r.end - (r.kind === ts.SyntaxKind.SingleLineCommentTrivia ? 0 : 2)).trim(),
        ) ?? [];

    return comments.some(text => text === '@reader content-script');
}

export function rewriteImportsTransform(ctx: ts.TransformationContext) {
    return (sourceFile: ts.SourceFile) => {
        if (isContentScript(sourceFile)) {
            function visitor(node: ts.Node) {
                if (ts.isImportDeclaration(node)) {
                    console.log('  Rewrote', printer.printNode(ts.EmitHint.Unspecified, node, sourceFile));

                    const importData = parseEsImport(sourceFile, ctx.factory, node);

                    const contentImport = createContentScriptImport(sourceFile, ctx.factory, importData);
                    console.log('       to', printer.printNode(ts.EmitHint.Unspecified, contentImport, sourceFile));

                    return contentImport;
                }

                return ts.visitEachChild(node, visitor, ctx);
            }

            console.log('[typescript] Transforming content script', sourceFile.fileName);
            return createWrapper(ts.visitEachChild(sourceFile, visitor, ctx), ctx.factory);
        }

        return sourceFile;
    };
}

export function removeAnnoyingDefaultExportTransform(ctx: ts.TransformationContext) {
    return (sourceFile: ts.SourceFile) => {
        if (isContentScript(sourceFile)) {
            function visitor(node: ts.Node) {
                if (ts.isExportDeclaration(node)) {
                    return;
                }

                return ts.visitEachChild(node, visitor, ctx);
            }

            console.log('[typescript] Transforming content script', sourceFile.fileName);
            return ts.visitEachChild(sourceFile, visitor, ctx);
        }

        return sourceFile;
    };
}
