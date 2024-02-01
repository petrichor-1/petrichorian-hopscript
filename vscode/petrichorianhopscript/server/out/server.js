"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
const node_1 = require("vscode-languageserver/node");
const { secondPass } = require("../../../../core/secondPass.js");
const preludeify = require("../../../../core/preludeify.js");
const secondPassFuncs_1 = require("./secondPassFuncs");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
let latestParsed;
let latestLines;
// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
// Create a simple text document manager.
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
connection.onInitialize((params) => {
    const result = {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true
            }
        }
    };
    return result;
});
connection.onDidChangeConfiguration(change => {
    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});
// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});
async function validateTextDocument(textDocument) {
    // The validator creates diagnostics for all uppercase words length 2 and more
    const text = textDocument.getText();
    latestLines = text.split("\n");
    const { htnCode, fileMap } = preludeify(text, textDocument.uri);
    const diagnostics = [];
    try { //FIXME: rulesCountForObject is currently just `()=>0` which is wrong
        function errorFunc(error) {
            const expected = error.expected.filter ? error.expected : [error.expected];
            const diagnostic = {
                severity: node_1.DiagnosticSeverity.Error,
                range: {
                    start: textDocument.positionAt(error.location.start.offset - fileMap[fileMap.length - 1].offset - 1),
                    end: textDocument.positionAt(error.location.end.offset - fileMap[fileMap.length - 1].offset - 1)
                },
                message: `Syntax error: ${error.message ? error.message : ""} \n\tExpected '${expected.filter((e) => e.startsWith ? !e.startsWith("[internal]") : true).join("', '")}', found '${error.found}'`,
                source: "phs"
            };
            diagnostics.push(diagnostic);
        }
        (0, secondPassFuncs_1.resetSecondPassFunctions)(errorFunc);
        latestParsed = secondPass(htnCode, { checkParameterLabels: true }, { width: 1024, height: 768 }, errorFunc, secondPassFuncs_1.addHsObjectAndBeforeGameStartsAbility, secondPassFuncs_1.addCustomRuleDefinition, console.log.bind(null, "createCustomBlockAbilityFromDefinition"), console.log.bind(null, "createElseAbilityFor"), secondPassFuncs_1.createMethodBlock, console.log.bind(null, "createAbilityAsControlScriptOf"), console.log.bind(null, "createAbilityForRuleFrom"), () => 0, console.log.bind(null, "addBlockToAbility"), console.log.bind(null, "hasUndefinedCustomRules"), console.log.bind(null, "hasUndefinedCustomBlocks"), console.log.bind(null, "returnValue"), secondPassFuncs_1.handleCustomRule, (e) => { latestParsed = e; return e; });
    }
    catch (error) {
        if (!error.location) {
            console.log(error);
        }
        else {
            const expected = error.expected.filter ? error.expected : [error.expected];
            const diagnostic = {
                severity: node_1.DiagnosticSeverity.Error,
                range: {
                    start: textDocument.positionAt(error.location.start.offset - fileMap[fileMap.length - 1].offset - 1),
                    end: textDocument.positionAt(error.location.end.offset - fileMap[fileMap.length - 1].offset - 1)
                },
                message: `Syntax error: ${error.message ? error.message : ""} \n\tExpected '${expected.filter((e) => e.startsWith ? !e.startsWith("[internal]") : true).join("', '")}', found '${error.found}'`,
                source: "phs"
            };
            diagnostics.push(diagnostic);
        }
    }
    // Send the computed diagnostics to VSCode.
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}
function completionsForEmptyLine() {
    const completions = [
        {
            label: "custom_block ",
            kind: node_1.CompletionItemKind.Keyword,
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            insertText: "custom_block ${1}:"
        },
        {
            label: "custom_rule ",
            kind: node_1.CompletionItemKind.Keyword,
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            insertText: "custom_rule ${1}:"
        }
    ];
    if (!latestParsed)
        return completions;
    for (const name in latestParsed.objectTypes) {
        if (Object.prototype.hasOwnProperty.call(latestParsed.objectTypes, name)) {
            const objectType = latestParsed.objectTypes[name];
            completions.push({
                label: name + ` ${name}:`,
                kind: node_1.CompletionItemKind.Class,
                insertTextFormat: node_1.InsertTextFormat.Snippet,
                insertText: name + " ${1}:"
            });
            completions.push({
                label: name + ` ${name}(x_position: 200, y_position: 200):`,
                kind: node_1.CompletionItemKind.Class,
                insertTextFormat: node_1.InsertTextFormat.Snippet,
                insertText: name + ` \${1}(x_position: \${2}, y_position: \${3}${objectType.type == 1 ? ", text: ${4}" : ""}):`
            });
        }
    }
    return completions;
}
// This handler provides the initial list of the completion items.
connection.onCompletion((_textDocumentPosition) => {
    if (!latestParsed)
        return [];
    const line = latestLines[_textDocumentPosition.position.line];
    if (/#/.test(line.substring(0, _textDocumentPosition.position.character)))
        return [];
    if (!line.startsWith("\t"))
        return completionsForEmptyLine();
    return completionsForBlocksOfClasses(["method"]);
});
// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item) => {
    switch (item.data?.type) {
        case "block":
            item.detail = `${item.data.name}`;
        // item.documentation = JSON.stringify(item.data.blockType);
    }
    return item;
});
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
// Listen on the connection
connection.listen();
function completionsForBlocksOfClasses(classes) {
    const completions = [];
    for (const name in latestParsed.blockTypes) {
        if (Object.prototype.hasOwnProperty.call(latestParsed.blockTypes, name)) {
            const blockType = latestParsed.blockTypes[name];
            if (!classes.includes(blockType.class.class))
                continue;
            let label = name;
            let snippet = name;
            const maybeBinaryOperator = name == "set" ? "=" : Object.getOwnPropertyNames(latestParsed.binaryOperatorBlockTypes).find((e) => latestParsed.binaryOperatorBlockTypes[e] == name);
            if (maybeBinaryOperator) {
                snippet = `\${1} ${maybeBinaryOperator} \${2}`;
            }
            else {
                if (blockType.parameters.length > 0) {
                    label += "(";
                    snippet += "(";
                    if (blockType.parameters[0].name) {
                        label += blockType.parameters[0].name;
                        snippet += blockType.parameters[0].name;
                        label += ": ";
                        snippet += ": ";
                    }
                    label += '"' + blockType.parameters[0].defaultValue + '"';
                    snippet += '${1}';
                    for (let i = 1; i < blockType.parameters.length; i++) {
                        label += ", ";
                        snippet += ", ";
                        if (blockType.parameters[i].name) {
                            label += blockType.parameters[i].name;
                            snippet += blockType.parameters[i].name;
                            label += ": ";
                            snippet += ": ";
                        }
                        label += '"' + blockType.parameters[i].defaultValue + '"';
                        snippet += `\${${i + 1}}`;
                    }
                    label += ")";
                    snippet += ")";
                }
            }
            if (["control", "conditionalControl"].includes(blockType.class))
                snippet += ":";
            completions.push({
                label: label,
                kind: node_1.CompletionItemKind.Function,
                data: { type: "block", name: name, blockType: blockType },
                insertTextFormat: node_1.InsertTextFormat.Snippet,
                insertText: snippet
            });
        }
    }
    return completions;
}
//# sourceMappingURL=server.js.map