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
let latestFileMap;
let lineStates = [];
let StateLevels;
function linely(currentState, newStateLevels, line) {
    StateLevels = newStateLevels;
    const lineNumber = unpreludeifyLineNumber(line.location.start.line) - 1;
    if (lineNumber < 0)
        return;
    lineStates[lineNumber] = deepCopy(currentState);
}
function deepCopy(obj) { return JSON.parse(JSON.stringify(obj)); }
function unpreludeifyLineNumber(preludeified) {
    return preludeified - latestFileMap[latestFileMap.length - 1].starts;
}
function log(...args) {
    // console.log(args)
}
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
    latestFileMap = fileMap;
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
        secondPass(htnCode, { checkParameterLabels: true }, { width: 1024, height: 768 }, errorFunc, secondPassFuncs_1.addHsObjectAndBeforeGameStartsAbility, secondPassFuncs_1.addCustomRuleDefinition, log.bind(null, "createCustomBlockAbilityFromDefinition"), log.bind(null, "createElseAbilityFor"), secondPassFuncs_1.createMethodBlock, log.bind(null, "createAbilityAsControlScriptOf"), secondPassFuncs_1.createAbilityForRuleFrom, () => 0, log.bind(null, "addBlockToAbility"), log.bind(null, "hasUndefinedCustomRules"), log.bind(null, "hasUndefinedCustomBlocks"), log.bind(null, "returnValue"), secondPassFuncs_1.handleCustomRule, (e) => { e ? latestParsed = e : null; return e; }, linely);
    }
    catch (error) {
        if (!error.location) {
            log(error);
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
function completionsForEmptyTopLevelLine() {
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
function completionsForTopLevel(line) {
    const words = line.split(/[ \t\n]/g).filter(e => e != '');
    if (words.length <= 1)
        return completionsForEmptyTopLevelLine();
    switch (words[0]) {
        case "custom_block":
        case "custom_rule":
            //This will always be a definition, so assume the user will always not want anything
            return [];
        default:
            console.log("Unknown starting word", words);
            return [];
    }
}
function completionsForEmptyObjectLevelLine(isAllowedToUseSetBlocks) {
    const completions = [
        {
            label: "When ",
            kind: node_1.CompletionItemKind.Keyword,
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            insertText: "When ${1}:"
        },
        {
            label: "custom_rule ",
            kind: node_1.CompletionItemKind.Keyword,
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            insertText: "custom_rule "
        },
        {
            label: "custom_rule <name>:",
            kind: node_1.CompletionItemKind.Keyword,
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            insertText: "custom_rule ${1}:"
        }
    ];
    if (isAllowedToUseSetBlocks)
        completions.push({
            label: "Set",
            kind: node_1.CompletionItemKind.Function,
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            insertText: "${1} = ${2}"
        });
    return completions;
}
function getNameOfFirstUnclosedParenthesisBlockIn(str) {
    const possibilities = str.split("(");
    let open = 0;
    for (let i = 0; i < possibilities.length; i++) {
        const closed = possibilities[i].match(/\)/g)?.length || 0;
        open += 1 - closed;
    }
    const actualTargetIndex = open - 2;
    const actualTarget = possibilities[actualTargetIndex];
    const actualTargetWords = actualTarget.split(/[ \t\n]/).filter(e => e != "");
    const blockName = actualTargetWords[actualTargetWords.length - 1];
    let remainder = "";
    for (let i = actualTargetIndex + 1; i < possibilities.length; i++)
        remainder += "(" + possibilities[i];
    let currentlyOpen = 0;
    const parameters = [];
    let currentParameter = "";
    for (let i = 1; i < remainder.length; i++) {
        const character = remainder[i];
        switch (character) {
            case "(":
                currentlyOpen++;
                currentParameter += character;
                break;
            case ")":
                currentlyOpen--;
                currentParameter += character;
                break;
            case ",":
                if (currentlyOpen) {
                    currentParameter += character;
                    break;
                }
                parameters.push(currentParameter);
                currentParameter = "";
                break;
            default:
                currentParameter += character;
        }
    }
    parameters.push(currentParameter);
    return { blockName: blockName, parameters: parameters };
}
function completionsForInsideParenthesisBlockParentheses(line, cursorCharacter) {
    const beforeCursor = line.substring(0, cursorCharacter);
    const { blockName, parameters } = getNameOfFirstUnclosedParenthesisBlockIn(beforeCursor);
    const maybeBlock = latestParsed.blockTypes[blockName];
    if (!maybeBlock)
        return [];
    if ((maybeBlock.parameters?.length || 0) < parameters.length)
        return [];
    const relevantParameter = maybeBlock.parameters[parameters.length - 1];
    if (relevantParameter.name && !/:/.test(parameters[parameters.length - 1])) {
        let label = relevantParameter.name + ":";
        let insertText = relevantParameter.name + ": ${1}";
        for (let i = parameters.length; i < maybeBlock.parameters.length; i++) {
            const parameter = maybeBlock.parameters[i];
            if (parameter.name) {
                label += " , " + parameter.name + ":";
                insertText += `, ${parameter.name}: \${${i - parameters.length + 2}}`;
            }
        }
        return [{
                label: label,
                kind: node_1.CompletionItemKind.Field, // Not *really* but close enough
                insertTextFormat: node_1.InsertTextFormat.Snippet,
                insertText: insertText
            }];
    }
    return completionsForBlocksOfClasses(["operator", "conditionalOperator"]);
}
function completionsForCustomRules() {
    //TODO: Return all known custom rule names
    return [];
}
function completionsForObjectLevel(line, cursorCharacter, isAllowedToUseSetBlocks) {
    const words = line.split(/[ \t\n]/g).filter(e => e != '');
    if (words.length <= 1)
        return completionsForEmptyObjectLevelLine(isAllowedToUseSetBlocks);
    if (words[words.length - 1].endsWith("):") && /\(/.test(line.substring(0, cursorCharacter)))
        return completionsForInsideParenthesisBlockParentheses(line, cursorCharacter);
    if (words.length == 2 && words[1].endsWith(":") && words[0] == "When")
        return completionsForBlocksOfClasses(["operator", "conditionalOperator"]);
    if (words.length == 2 && words[0] == "custom_rule")
        return completionsForCustomRules();
    console.log(words);
    return [];
}
// This handler provides the initial list of the completion items.
connection.onCompletion((_textDocumentPosition) => {
    if (!latestParsed)
        return [];
    const lineState = lineStates[_textDocumentPosition.position.line];
    const line = latestLines[_textDocumentPosition.position.line];
    switch (lineState.level) {
        case StateLevels.topLevel:
            return completionsForTopLevel(line);
        case StateLevels.inObjectOrCustomRule:
            return completionsForObjectLevel(line, _textDocumentPosition.position.character, !lineState.object.hasRules);
        default:
            console.log(lineState);
            return completionsForBlocksOfClasses(["method"]);
    }
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