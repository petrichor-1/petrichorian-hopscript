import { readFileSync, statSync } from "fs"
const {HSParameterType} = require("../../../../core/HSParameterType.js")
const {hopscotchify} = require("../../../../core/hopscotchify.js")
let customRules: any = {}
let customRuleDefinitionCallbacks: any = {}
function onDefinitionOfCustomRuleNamed(name: string, callback: (hsCustomRule: HSCustomRule) => void) {
	if (customRules[name])
		return callback(customRules[name])
	customRuleDefinitionCallbacks[name] = customRuleDefinitionCallbacks[name] || []
	customRuleDefinitionCallbacks[name].push(callback)
}

let customBlocks: any = {}
let customBlockDefinitionCallbacks: any = {}

export function resetSecondPassFunctions() {
	customBlocks = {}
	customRules = {}
}
function nop(){}
function returnEmptyObject(){return {}}
const dummyObject = () => {return {hasRules: false}}, dummyAbility = returnEmptyObject, dummyCustomRule = returnEmptyObject, dummyParameter = returnEmptyObject, dummyVariable = returnEmptyObject, dummyTrait = returnEmptyObject
export const customBlockAbilityFunctions = {
	begin: () => {
		return {}
	},
	addParameter: nop,
	finish: nop /*(customBlockAbility: any, name: string) => {
		customBlockDefinitionCallbacks[name]?.forEach(callback => {
			callback(customBlockAbility)
		})
		customBlockDefinitionCallbacks[name] = null
		customBlocks[name] = true
	}*/
}

export let alreadyParsedPaths: any = {}
export function handleDependency(path: string): any {
	const claimedPath = path
	if (!/\//.test(path))
		path = `${__dirname}/../../../../core/prelude/${path}`
	const fileModifiedTime = statSync(path).mtime
	const existing = alreadyParsedPaths[path]
	if (existing && existing.time == fileModifiedTime)
		return existing.result
	const hspreLikeAndOtherInfo = getHspreLikeFrom(path, alreadyParsedPaths)
	alreadyParsedPaths[path] = {result: hspreLikeAndOtherInfo, time: fileModifiedTime, claimedPath}
	hspreLikeAndOtherInfo.hspreLike.customRules?.forEach((hsCustomRule: any) => {
		const name = hsCustomRule.name
		customRules[name] = true
	})
	hspreLikeAndOtherInfo.hspreLike.abilities?.filter((e:any)=>!!e.name).forEach((hsCustomBlock: any) => {
		const name = hsCustomBlock.name
		customBlocks[name] = true
	})
	return hspreLikeAndOtherInfo
}

export const createHsCommentFrom = returnEmptyObject

export const createCustomBlockReferenceFrom = function(snakeCaseName: string): {block_class: string, type: number} {
	return {
		block_class: "control",
		type: 123 //HSBlockType.Ability
	}
}

export function addHsObjectAndBeforeGameStartsAbility(objectType: any, desiredObjectName: string, objectAttributes: any, validScopes: any[]) {
	validScopes.find(e=>e.path==desiredObjectName).hasBeenDefinedAs({})
	return {
		hsObject: dummyObject(),
		ability: dummyAbility()
	}
}

export function addCustomRuleDefinitionAndReturnParameterly(name: string): {hsCustomRule: HSCustomRule, beforeGameStartsAbility: any, parameterly: (key: string, value: string) => void} {
	const hsCustomRule: HSCustomRule = {
		parameters: []
	}
	customRuleDefinitionCallbacks[name]?.forEach((callback: (hsCustomRule: HSCustomRule) => void) => callback(hsCustomRule))
	customRuleDefinitionCallbacks[name] = null
	customRules[name] = true
	return {
		hsCustomRule,
		beforeGameStartsAbility: dummyAbility(),
		parameterly: (key, value) => hsCustomRule.parameters.push(key)
	}
}

export const createElseAbilityFor = dummyAbility

interface BlockCreationFunctions {
	begin: () => any
	setType: (result: any, hsBlockType: number, description: string, blockClass: string) => void
	createParameter: (defaultValue: string, key: string, type: number) => any
	setParameterValue: (hsParameter: any, value: string) => void
	isObjectParameterType: (hsParameter: any) => boolean
	setParameterVariable: (hsParameter: any, toId: string) => void
	addEventParameter: (hsEventParameter: any) => void
	setParameterDatum: (hsParameter: any, innerBlock: any) => void
	addParameter: (result: any, hsParameter: any) => void
	createOperatorBlockUsing: (createBlockOfClasses: (allowedClasses: string[], blockCreationFunctions: BlockCreationFunctions) => void) => any
	undefinedTypeFunctions: {
		getOrAddObjectVariableNamed: (name: string) => any
		createSelfTrait: (trait: any) => any
		createGameTrait: (trait: any) => any
		createOriginalObjectTrait: (trait: any) => any
		createObjectTrait: (trait: any) => any
		getOrAddGameVariableNamed: (name: string) => any
		createLocalVariableNamed: (name: string) => any
		setObjectTraitObjectToReferTo: (hsTrait: any, hsObject: any) => void
		createObjectVariableReferenceTo: (hsVariable: any) => {objectDefinitionCallback: (hsObject: any) => void, hsDatum: any}
	}
}
function createBlockCreationFunctions(): BlockCreationFunctions {
	return {
		begin: () => {
			return {}
		},
		setType: (result: any, hsBlockType: any, description: string, blockClass: string) => {
			result.type = hsBlockType
			result.description = description
			result.block_class = blockClass
		},
		createParameter(defaultValue, key, type) {
			const parameter = dummyParameter() as any
			parameter.isObjectParameterType = type == HSParameterType.HSObject
		},
		setParameterValue: nop,
		setParameterDatum: nop,
		isObjectParameterType(hsParameter) {
			if (!hsParameter)
				return false
			return hsParameter.isObjectParameterType
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
			createObjectVariableReferenceTo: (()=>{return{objectDefinitionCallback:()=>{}}}) as any,
			createOriginalObjectTrait: dummyTrait,
			createSelfTrait: dummyTrait,
			setObjectTraitObjectToReferTo: nop
		}
	}
}
export function createMethodBlock(createBlockOfClasses: (allowedClasses: string[], blockCreationFunctions: BlockCreationFunctions) => void, ability: any) {
	const hsBlock = createMethodBlockUsing(createBlockOfClasses)
	return hsBlock
}

export function createAbilityAsControlScriptOf(hsBlock: any) {
	const ability = dummyAbility()
	if (hsBlock.type == 123) { //HSBlockType.Ability
		// customBlockDefinitionCallbacks[hsBlock.description]?.forEach(callback => {
		// 	callback(ability)
		// })
		// customBlockDefinitionCallbacks[hsBlock.description] = null
		// customBlocks[hsBlock.description] = ability
		// ability.name = hsBlock.description
	}
	return ability
}

export function createAbilityForRuleFrom(createBlockOfClasses: (allowedClasses: string[], blockCreationFunctions: BlockCreationFunctions) => void, currentObject: any) {
	createOperatorBlockUsing(createBlockOfClasses)
	return dummyAbility()
}

export function rulesCountForObject(object: any) {
	return object.hasRules ? Infinity : 0
}

export function hasUndefinedCustomRules() {
	const undefinedCustomRuleNames = Object.getOwnPropertyNames(customRuleDefinitionCallbacks).filter(e => !!customRuleDefinitionCallbacks[e])
	const hasUndefinedCustomRules = undefinedCustomRuleNames.length > 0
	return hasUndefinedCustomRules
}

export function hasUndefinedCustomBlocks() {
	const undefinedCustomBlockNames = Object.getOwnPropertyNames(customBlockDefinitionCallbacks).filter(e => !!customBlockDefinitionCallbacks[e])
	const hasUndefinedCustomBlocks = undefinedCustomBlockNames.length > 0
	return hasUndefinedCustomBlocks
}

export const returnValue = (e:any) => e

export function handleCustomRule(name: string, hsObjectOrCustomRule: any, hasContainer: boolean, callbackForWhenRuleIsDefined: (hsParameterCount: number, hsKeyForParameter: (index: number) => string, addParameter: (index: number, value: string) => void) => void): {hsCustomRule: any, beforeGameStartsAbility: any} {
	onDefinitionOfCustomRuleNamed(name, (hsCustomRule: HSCustomRule) => {
		callbackForWhenRuleIsDefined(hsCustomRule.parameters.length, (i => hsCustomRule.parameters[i]), nop)
	})
	if (!hasContainer)
		return {hsCustomRule: null, beforeGameStartsAbility: null}
	return addCustomRuleDefinitionAndReturnParameterly(name)
}

export function isThereAlreadyADefinedCustomRuleNamed(name: string) {
	return !!customRules[name]
}

interface HSCustomRule {
	parameters: string[]
}
function createMethodBlockUsing(createBlockOfClasses: (allowedClasses: string[], blockCreationFunctions: BlockCreationFunctions) => void) {
	return createBlockOfClasses(["method", "control", "conditionalControl"], createBlockCreationFunctions())
}

function createOperatorBlockUsing(createBlockOfClasses: (allowedClasses: string[], blockCreationFunctions: BlockCreationFunctions) => void) {
	return createBlockOfClasses(["operator","conditionalOperator"], createBlockCreationFunctions())
}

function getHspreLikeFrom(path: string, alreadyParsedPaths: any): any {
	if (path.endsWith('.hopscotch') || path.endsWith('.hspre'))
		return {hspreLike: JSON.parse(readFileSync(path).toString())}
	//TODO: hsprez
	const {
		hopscotchified,
		objectTypes,
		blockTypes,
		traitTypes,
		binaryOperatorBlockTypes,
		objectNames,
		parameterTypes
	} = hopscotchify(path, {checkParameterLabels: true}, fileFunctions(), prepAlreadyParsedPathsForHopscotchify())
	return {
		hspreLike: hopscotchified,
		objectTypes,
		blockTypes,
		traitTypes,
		binaryOperatorBlockTypes,
		objectNames,
		parameterTypes
	}
}

function prepAlreadyParsedPathsForHopscotchify(): any {
	const result: any = {}
	for (const path in alreadyParsedPaths) {
		if (Object.prototype.hasOwnProperty.call(alreadyParsedPaths, path)) {
			const element = alreadyParsedPaths[path];
			result[element.claimedPath] = element.result
		}
	}
	return result
}

function fileFunctions(): {getHspreLike: (path: string, alreadyParsedPaths: any) => void, read: (path: string) => string} {
	return {
		read: path => readFileSync(path).toString(),
		getHspreLike: getHspreLikeFrom,
	}
}