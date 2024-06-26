"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isThereAlreadyADefinedCustomRuleNamed = exports.handleCustomRule = exports.returnValue = exports.hasUndefinedCustomBlocks = exports.hasUndefinedCustomRules = exports.rulesCountForObject = exports.createAbilityForRuleFrom = exports.createAbilityAsControlScriptOf = exports.createMethodBlock = exports.createElseAbilityFor = exports.addCustomRuleDefinitionAndReturnParameterly = exports.addHsObjectAndBeforeGameStartsAbility = exports.createCustomBlockReferenceFrom = exports.createHsCommentFrom = exports.handleDependency = exports.alreadyParsedPaths = exports.customBlockAbilityFunctions = exports.resetSecondPassFunctions = void 0;
const fs_1 = require("fs");
const { HSParameterType } = require("../../../../core/HSParameterType.js");
const { hopscotchify } = require("../../../../core/hopscotchify.js");
let customRules = {};
let customRuleDefinitionCallbacks = {};
function onDefinitionOfCustomRuleNamed(name, callback) {
    if (customRules[name])
        return callback(customRules[name]);
    customRuleDefinitionCallbacks[name] = customRuleDefinitionCallbacks[name] || [];
    customRuleDefinitionCallbacks[name].push(callback);
}
let customBlocks = {};
let customBlockDefinitionCallbacks = {};
function resetSecondPassFunctions() {
    customBlocks = {};
    customRules = {};
}
exports.resetSecondPassFunctions = resetSecondPassFunctions;
function nop() { }
function returnEmptyObject() { return {}; }
const dummyObject = () => { return { hasRules: false }; }, dummyAbility = returnEmptyObject, dummyCustomRule = returnEmptyObject, dummyParameter = returnEmptyObject, dummyVariable = returnEmptyObject, dummyTrait = returnEmptyObject;
exports.customBlockAbilityFunctions = {
    begin: () => {
        return {};
    },
    addParameter: nop,
    finish: nop /*(customBlockAbility: any, name: string) => {
        customBlockDefinitionCallbacks[name]?.forEach(callback => {
            callback(customBlockAbility)
        })
        customBlockDefinitionCallbacks[name] = null
        customBlocks[name] = true
    }*/
};
exports.alreadyParsedPaths = {};
function handleDependency(path) {
    const claimedPath = path;
    if (!/\//.test(path))
        path = `${__dirname}/../../../../core/prelude/${path}`;
    const fileModifiedTime = (0, fs_1.statSync)(path).mtime;
    const existing = exports.alreadyParsedPaths[path];
    if (existing && existing.time == fileModifiedTime)
        return existing.result;
    const hspreLikeAndOtherInfo = getHspreLikeFrom(path, exports.alreadyParsedPaths);
    exports.alreadyParsedPaths[path] = { result: hspreLikeAndOtherInfo, time: fileModifiedTime, claimedPath };
    hspreLikeAndOtherInfo.hspreLike.customRules?.forEach((hsCustomRule) => {
        const name = hsCustomRule.name;
        customRules[name] = true;
    });
    hspreLikeAndOtherInfo.hspreLike.abilities?.filter((e) => !!e.name).forEach((hsCustomBlock) => {
        const name = hsCustomBlock.name;
        customBlocks[name] = true;
    });
    return hspreLikeAndOtherInfo;
}
exports.handleDependency = handleDependency;
exports.createHsCommentFrom = returnEmptyObject;
const createCustomBlockReferenceFrom = function (snakeCaseName) {
    return {
        block_class: "control",
        type: 123 //HSBlockType.Ability
    };
};
exports.createCustomBlockReferenceFrom = createCustomBlockReferenceFrom;
function addHsObjectAndBeforeGameStartsAbility(objectType, desiredObjectName, objectAttributes, validScopes) {
    validScopes.find(e => e.path == desiredObjectName).hasBeenDefinedAs({});
    return {
        hsObject: dummyObject(),
        ability: dummyAbility()
    };
}
exports.addHsObjectAndBeforeGameStartsAbility = addHsObjectAndBeforeGameStartsAbility;
function addCustomRuleDefinitionAndReturnParameterly(name) {
    const hsCustomRule = {
        parameters: []
    };
    customRuleDefinitionCallbacks[name]?.forEach((callback) => callback(hsCustomRule));
    customRuleDefinitionCallbacks[name] = null;
    customRules[name] = true;
    return {
        hsCustomRule,
        beforeGameStartsAbility: dummyAbility(),
        parameterly: (key, value) => hsCustomRule.parameters.push(key)
    };
}
exports.addCustomRuleDefinitionAndReturnParameterly = addCustomRuleDefinitionAndReturnParameterly;
exports.createElseAbilityFor = dummyAbility;
function createBlockCreationFunctions() {
    return {
        begin: () => {
            return {};
        },
        setType: (result, hsBlockType, description, blockClass) => {
            result.type = hsBlockType;
            result.description = description;
            result.block_class = blockClass;
        },
        createParameter(defaultValue, key, type) {
            const parameter = dummyParameter();
            parameter.isObjectParameterType = type == HSParameterType.HSObject;
        },
        setParameterValue: nop,
        setParameterDatum: nop,
        isObjectParameterType(hsParameter) {
            if (!hsParameter)
                return false;
            return hsParameter.isObjectParameterType;
        },
        setParameterVariable: nop,
        addEventParameter: nop,
        addParameter: nop,
        createOperatorBlockUsing: createOperatorBlockUsing,
        undefinedTypeFunctions: {
            getOrAddGameVariableNamed: dummyVariable,
            getOrAddObjectVariableNamed: dummyVariable,
            createGameTrait: dummyTrait,
            createLocalVariableNamed: dummyVariable,
            createObjectTrait: dummyTrait,
            createObjectVariableReferenceTo: (() => { return { objectDefinitionCallback: () => { } }; }),
            createOriginalObjectTrait: dummyTrait,
            createSelfTrait: dummyTrait,
            setObjectTraitObjectToReferTo: nop
        }
    };
}
function createMethodBlock(createBlockOfClasses, ability) {
    const hsBlock = createMethodBlockUsing(createBlockOfClasses);
    return hsBlock;
}
exports.createMethodBlock = createMethodBlock;
function createAbilityAsControlScriptOf(hsBlock) {
    const ability = dummyAbility();
    if (hsBlock.type == 123) { //HSBlockType.Ability
        // customBlockDefinitionCallbacks[hsBlock.description]?.forEach(callback => {
        // 	callback(ability)
        // })
        // customBlockDefinitionCallbacks[hsBlock.description] = null
        // customBlocks[hsBlock.description] = ability
        // ability.name = hsBlock.description
    }
    return ability;
}
exports.createAbilityAsControlScriptOf = createAbilityAsControlScriptOf;
function createAbilityForRuleFrom(createBlockOfClasses, currentObject) {
    createOperatorBlockUsing(createBlockOfClasses);
    return dummyAbility();
}
exports.createAbilityForRuleFrom = createAbilityForRuleFrom;
function rulesCountForObject(object) {
    return object.hasRules ? Infinity : 0;
}
exports.rulesCountForObject = rulesCountForObject;
function hasUndefinedCustomRules() {
    const undefinedCustomRuleNames = Object.getOwnPropertyNames(customRuleDefinitionCallbacks).filter(e => !!customRuleDefinitionCallbacks[e]);
    const hasUndefinedCustomRules = undefinedCustomRuleNames.length > 0;
    return hasUndefinedCustomRules;
}
exports.hasUndefinedCustomRules = hasUndefinedCustomRules;
function hasUndefinedCustomBlocks() {
    const undefinedCustomBlockNames = Object.getOwnPropertyNames(customBlockDefinitionCallbacks).filter(e => !!customBlockDefinitionCallbacks[e]);
    const hasUndefinedCustomBlocks = undefinedCustomBlockNames.length > 0;
    return hasUndefinedCustomBlocks;
}
exports.hasUndefinedCustomBlocks = hasUndefinedCustomBlocks;
const returnValue = (e) => e;
exports.returnValue = returnValue;
function handleCustomRule(name, hsObjectOrCustomRule, hasContainer, callbackForWhenRuleIsDefined) {
    onDefinitionOfCustomRuleNamed(name, (hsCustomRule) => {
        callbackForWhenRuleIsDefined(hsCustomRule.parameters.length, (i => hsCustomRule.parameters[i]), nop);
    });
    if (!hasContainer)
        return { hsCustomRule: null, beforeGameStartsAbility: null };
    return addCustomRuleDefinitionAndReturnParameterly(name);
}
exports.handleCustomRule = handleCustomRule;
function isThereAlreadyADefinedCustomRuleNamed(name) {
    return !!customRules[name];
}
exports.isThereAlreadyADefinedCustomRuleNamed = isThereAlreadyADefinedCustomRuleNamed;
function createMethodBlockUsing(createBlockOfClasses) {
    return createBlockOfClasses(["method", "control", "conditionalControl"], createBlockCreationFunctions());
}
function createOperatorBlockUsing(createBlockOfClasses) {
    return createBlockOfClasses(["operator", "conditionalOperator"], createBlockCreationFunctions());
}
function getHspreLikeFrom(path, alreadyParsedPaths) {
    if (path.endsWith('.hopscotch') || path.endsWith('.hspre'))
        return { hspreLike: JSON.parse((0, fs_1.readFileSync)(path).toString()) };
    //TODO: hsprez
    const { hopscotchified, objectTypes, blockTypes, traitTypes, binaryOperatorBlockTypes, objectNames, parameterTypes } = hopscotchify(path, { checkParameterLabels: true }, fileFunctions(), prepAlreadyParsedPathsForHopscotchify());
    return {
        hspreLike: hopscotchified,
        objectTypes,
        blockTypes,
        traitTypes,
        binaryOperatorBlockTypes,
        objectNames,
        parameterTypes
    };
}
function prepAlreadyParsedPathsForHopscotchify() {
    const result = {};
    for (const path in exports.alreadyParsedPaths) {
        if (Object.prototype.hasOwnProperty.call(exports.alreadyParsedPaths, path)) {
            const element = exports.alreadyParsedPaths[path];
            result[element.claimedPath] = element.result;
        }
    }
    return result;
}
function fileFunctions() {
    return {
        read: path => (0, fs_1.readFileSync)(path).toString(),
        stat: path => (0, fs_1.statSync)(path),
        getHspreLike: getHspreLikeFrom,
    };
}
//# sourceMappingURL=secondPassFuncs.js.map