const { randomUUID } = require('crypto')
const {secondPass} = require('./secondPass.js')
const {HSParameterType} = require('./HSParameterType.js')

const BREAKPOINT_POSITION_KEY = "PETRICHOR_BREAKPOINT_POSITION"

module.exports.hopscotchify = (htnCode, options) => {
	let project = {
		stageSize: {
			width: 1024,
			height: 768,
		},
		playerVersion: "3.0.0",
		version: 34,
		abilities: [],
		customObjects: [],
		scenes: [],
		fontSize: 80,
		customRules: [],
		objects: [],
		variables: [],
		customRuleInstances: [],
		rules: [],
		eventParameters: [],
		scenes: [
			{
				name: "Scene 1",
				objects: [],
			},
		],
	}

	let customRules = {}
	let customRuleDefinitionCallbacks = {}
	function onDefinitionOfCustomRuleNamed(name, callback) {
		if (customRules[name])
			return callback(customRules[name])
		customRuleDefinitionCallbacks[name] = customRuleDefinitionCallbacks[name] || []
		customRuleDefinitionCallbacks[name].push(callback)
	}

	let customBlocks = {}
	let customBlockDefinitionCallbacks = {}
	function onDefinitionOfCustomBlockNamed(name, callback) {
		if (customBlocks[name])
			return callback(customBlocks[name])
		customBlockDefinitionCallbacks[name] = customBlockDefinitionCallbacks[name] || []
		customBlockDefinitionCallbacks[name].push(callback)
	}
	return secondPass(htnCode, options, project.stageSize, {createHsCommentFrom: createHsCommentFrom, createCustomBlockReferenceFrom: createCustomBlockReferenceFrom, error: (e)=>{throw e},addHsObjectAndBeforeGameStartsAbility: addHsObjectAndBeforeGameStartsAbility, addCustomRuleDefinitionAndReturnParameterly: addCustomRuleDefinitionAndReturnParameterly,createCustomBlockAbilityFromDefinition: createCustomBlockAbilityFromDefinition,createElseAbilityFor: createElseAbilityFor,createMethodBlock: createMethodBlock,createAbilityAsControlScriptOf: createAbilityAsControlScriptOf,createAbilityForRuleFrom: createAbilityForRuleFrom,rulesCountForObject: o=>o.rules.length,hasUndefinedCustomRules: hasUndefinedCustomRules,hasUndefinedCustomBlocks: hasUndefinedCustomBlocks,returnValue: ()=>project,handleCustomRule: handleCustomRule,transformParsed: e=>e,linely:  ()=>{}, isThereAlreadyADefinedCustomRuleNamed: isThereAlreadyADefinedCustomRuleNamed})
	function createCustomBlockAbilityFromDefinition(definition, Types) {
		const name = unSnakeCase(definition.value.value)
		const customBlockAbility = createEmptyAbility()
		customBlockAbility.parameters = []
		if ((definition.parameters?.length || 0) > 0) {
			for (let i = 0; i < definition.parameters.length; i++) {
				const parameter = definition.parameters[i]
				const parameterValue = function () {
					switch (parameter.value.type) {
						case Types.string:
						case Types.number:
							return parameter.value.value
						default:
							throw "Should be impossible: Unknown default value for custom block type" + parameter.value.type
					}
				} ()
				if (parameter.label.type != Types.identifier)
					throw "Should be impossible; INvalid parameter label type in custom block definition"
				const hsParameter = {
					type: 57, //constant
					defaultValue: parameterValue,
					value: parameterValue,
					key: unSnakeCase(parameter.label.value)
				}
				customBlockAbility.parameters.push(hsParameter)
			}
		}
		project.abilities.push(customBlockAbility)
		customBlockDefinitionCallbacks[name]?.forEach(callback => {
			callback(customBlockAbility)
		})
		customBlockDefinitionCallbacks[name] = null
		customBlocks[name] = customBlockAbility
		customBlockAbility.name = name
		return customBlockAbility
	}
	function createElseAbilityFor(checkIfElseBlock) {
		const elseAbility = createEmptyAbility()
		project.abilities.push(elseAbility)
		checkIfElseBlock.controlFalseScript = { abilityID: elseAbility.abilityID }
		return elseAbility
	}
	function createMethodBlock(createBlockOfClasses, ability) {
		// const hsBlock = createMethodBlockFrom(line.value, Types, parsed.blockTypes, parsed.binaryOperatorBlockTypes, parsed.traitTypes, validScopes, project)
		const hsBlock = createMethodBlockFrom(project, createBlockOfClasses)
		ability.blocks.push(hsBlock)
		if (hsBlock.type == 123) { //HSBlockType.ability
			onDefinitionOfCustomBlockNamed(hsBlock.description, hsAbility => {
				hsBlock.controlScript.abilityID = hsAbility.abilityID
			})
		}
		return hsBlock
	}
	// Returns hsCustomRule, beforeGameStartsAbility
	function handleCustomRule(nameAsString, hsObjectOrCustomRule, hasContainer, callbackForWhenRuleIsDefined) {
		const rulesList = hsObjectOrCustomRule.rules
		const tempid = "TEMP" + randomUUID()
		rulesList.push(tempid)
		onDefinitionOfCustomRuleNamed(nameAsString, hsCustomRule => {
			const hsCustomRuleInstance = createCustomRuleInstanceFor(hsCustomRule, callbackForWhenRuleIsDefined)
			project.customRuleInstances.push(hsCustomRuleInstance)
			const index = rulesList.findIndex(e => e == tempid)
			if (index < 0)
				throw "Should be imposssible: Placeholder rule removed"
			rulesList[index] = hsCustomRuleInstance.id
		})
		if (!hasContainer)
			return {hsCustomRule: null, beforeGameStartsAbility: null}
		return addCustomRuleDefinitionAndReturnParameterly(nameAsString)
	}
	function addHsObjectAndBeforeGameStartsAbility(objectType, desiredObjectName, objectAttributes, validScopes) {
		const hsObject = deepCopy(objectType)
		hsObject.name = unSnakeCase(desiredObjectName)
		hsObject.rules = []
		hsObject.objectID = randomUUID()
		hsObject.xPosition = objectAttributes.xPosition.toString()
		hsObject.yPosition = objectAttributes.yPosition.toString()
		hsObject.resizeScale = objectAttributes.resizeScale.toString()
		hsObject.rotation = objectAttributes.rotation.toString()
		hsObject.text = "" //NEEDED
		if (objectAttributes.text) {
			hsObject.text = objectAttributes.text
		}
		const ability = createEmptyAbility()
		project.abilities.push(ability)
		hsObject.abilityID = ability.abilityID
		project.objects.push(hsObject)
		project.scenes[0].objects.push(hsObject.objectID)
		validScopes.find(e => e.path == desiredObjectName).hasBeenDefinedAs(hsObject)
		return { hsObject, ability }
	}
	function hasUndefinedCustomBlocks() {
		const undefinedCustomBlockNames = Object.getOwnPropertyNames(customBlockDefinitionCallbacks).filter(e => !!customBlockDefinitionCallbacks[e])
		const hasUndefinedCustomBlocks = undefinedCustomBlockNames.length > 0
		return hasUndefinedCustomBlocks
	}
	
	function hasUndefinedCustomRules() {
		const undefinedCustomRuleNames = Object.getOwnPropertyNames(customRuleDefinitionCallbacks).filter(e => !!customRuleDefinitionCallbacks[e])
		const hasUndefinedCustomRules = undefinedCustomRuleNames.length > 0
		return hasUndefinedCustomRules
	}
	function isThereAlreadyADefinedCustomRuleNamed(nameAsString) {
		return !!customRules[nameAsString]
	}
	function addCustomRuleDefinitionAndReturnParameterly(nameAsString) {
		const beforeGameStartsAbility = createEmptyAbility()
		project.abilities.push(beforeGameStartsAbility)
		const hsCustomRule = {
			id: randomUUID(),
			abilityID: beforeGameStartsAbility.abilityID,
			name: unSnakeCase(nameAsString),
			parameters: [], //TODO
			rules: []
		}
		project.customRules.push(hsCustomRule)
		customRuleDefinitionCallbacks[nameAsString]?.forEach(callback => callback(hsCustomRule))
		customRuleDefinitionCallbacks[nameAsString] = null
		customRules[nameAsString] = hsCustomRule
		return {
			parameterly: (key, parameterValue) => {
				const parameter = {}
				parameter.key = unSnakeCase(key)
				parameter.defaultValue = parameterValue
				parameter.value = parameterValue
				hsCustomRule.parameters.push(parameter)
			},
			hsCustomRule: hsCustomRule,
			beforeGameStartsAbility: beforeGameStartsAbility
		}
	}

	function createAbilityForRuleFrom(createBlockOfClasses, currentObject) {
		const hsBlock = createOperatorBlockFrom(project,createBlockOfClasses)
		const rule = createRuleWith(hsBlock)
		currentObject.rules.push(rule.id)
		project.rules.push(rule)
		const ability = createEmptyAbility()
		rule.abilityID = ability.abilityID
		project.abilities.push(ability)
		return ability
	}

	function createAbilityAsControlScriptOf(hsBlock) {
		const ability = createEmptyAbility()
		project.abilities.push(ability)
		hsBlock.controlScript = { abilityID: ability.abilityID }
		if (hsBlock.type == 123) { //HSBlockType.Ability
			customBlockDefinitionCallbacks[hsBlock.description]?.forEach(callback => {
				callback(ability)
			})
			customBlockDefinitionCallbacks[hsBlock.description] = null
			customBlocks[hsBlock.description] = ability
			ability.name = hsBlock.description
		}
		return ability
	}
}

function deepCopy(object) {
	return JSON.parse(JSON.stringify(object))
}

function unSnakeCase(snakeCaseString) {
	const words = snakeCaseString.split("_")
		.map(e=>e[0].toUpperCase()+e.substring(1,e.length))
	return words.join(" ")
}

function createEmptyAbility() {
	const timeBetween1970And2001 = 978307200000
	return {
		blocks: [],
		abilityID: randomUUID(),
		createdAt: (Date.now() - timeBetween1970And2001) / 1000,
	}
}

function createBlockCreationFunctionsFor(project, parametersKey) {
	return {
		begin: (parametersKey => {
			const result = {}
			result[parametersKey] = []
			return result
		}).bind(null,parametersKey),
		setType: (result, hsBlockType, description, blockClass) => {
			result.type = hsBlockType
			result.description = description
			result.block_class = blockClass
		},
		createParameter: (defaultValue, key, type) => {
			return {
				defaultValue: defaultValue,
				key: key,
				type: type
			}
		},
		setParameterValue: (hsParameter, value) => {
			hsParameter.value = value
		},
		isObjectParameterType: (hsParameter => hsParameter.type == HSParameterType.HSObject),
		setParameterVariable: ((hsParameter, toId) => hsParameter.variable = toId),
		addEventParameter: ((project, hsEventParameter) => project.eventParameters.push(hsEventParameter)).bind(null, project),
		setParameterDatum: ((hsParameter, innerBlock) => hsParameter.datum = innerBlock),
		addParameter: ((parametersKey, result, hsParameter) => result[parametersKey].push(hsParameter)).bind(null, parametersKey),
		createOperatorBlockUsing: createOperatorBlockFrom.bind(null,project),
		undefinedTypeFunctions: {
			getOrAddObjectVariableNamed: getOrAddObjectVariableNamed.bind(null,project),
			createSelfTrait: createSelfTrait,
			createGameTrait: createGameTrait,
			getOrAddGameVariableNamed: getOrAddGameVariableNamed.bind(null,project),
			createLocalVariableNamed: createLocalVariableNamed,
			createOriginalObjectTrait: createOriginalObjectTrait,
			createObjectTrait: createObjectTrait,
			setObjectTraitObjectToReferTo: ((hsTrait, hsObject) => hsTrait.HSTraitObjectIDKey = hsObject.objectID),
			createObjectVariableReferenceTo: (hsVariable => {
				const hsDatum = {
					type: 8000, //HSBlockType.Object
					variable: hsVariable.objectIdString,
					description: "Variable", // Correct
					object: "PETRICHOR__TEMPOBJECTID"
				}
				return hsObject => {hsDatum.object = hsObject.objectID}
			})
		}
	}
}

function createOperatorBlockFrom(project, createBlockOfClasses, guard) {
	if (guard)
		throw "TODO: Change call to `createOperatorBlockFrom"
	const blockCreationFunctions = createBlockCreationFunctionsFor(project, "params")
	return createBlockOfClasses(["operator","conditionalOperator"], blockCreationFunctions)
	// return createBlockOfClasses(, "params", block, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, validScopes, project)
}

function createMethodBlockFrom(project, createBlockOfClasses, guard) {
	if (guard)
		throw "TODO: Change call to `createMethodBlockFrom"
	const blockCreationFunctions = createBlockCreationFunctionsFor(project, "parameters")
	return createBlockOfClasses(["method", "control", "conditionalControl"], blockCreationFunctions)
	// return createBlockOfClasses(["method", "control", "conditionalControl"], "parameters", block, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, validScopes, project)
}

function createCustomBlockReferenceFrom(snakeCaseName) {
	const name = unSnakeCase(snakeCaseName)
	const hsBlock = {
		block_class: "control",
		type: 123, //HSBlockType.Ability
		description: name,
		controlScript: {
			abilityID: "PETRICHOR__TEMP"
		}
	}
	return hsBlock
}

function createOriginalObjectTrait(trait) {
	return {
		HSTraitObjectParameterTypeKey: 8005, //HSBlockType.OriginalObject
		HSTraitTypeKey: trait.type,
		description: trait.description,
		HSTraitIDKey: randomUUID(),
	}
}

function createSelfTrait(trait) {
	return {
		HSTraitObjectParameterTypeKey: 8004, //HSBlockType.Self
		HSTraitTypeKey: trait.type,
		description: trait.description,
		HSTraitIDKey: randomUUID(),
	}
}

function createGameTrait(trait) {
	return {
		HSTraitObjectParameterTypeKey: 8003, //HSBlockType.Game
		HSTraitTypeKey: trait.type,
		description: trait.description,
		HSTraitIDKey: randomUUID(),
	}
}

function createObjectTrait(trait) {
	return {
		HSTraitObjectParameterTypeKey: 8000, //HSBlockType.Object
		HSTraitTypeKey: trait.type,
		description: trait.description,
		HSTraitIDKey: randomUUID(),
	}
}

function createLocalVariableNamed(snakeCaseName) {
	const name = unSnakeCase(snakeCaseName)
	return {
		name: name,
		type: 8009, //HSBlockType.Local
		description: "Local Variable" //Constant
	}
}

function getOrAddObjectVariableNamed(project, name) {
	const hsName = unSnakeCase(name)
	const maybeExistingVariable = project.variables.find(variable=>variable.name == hsName)
	if (maybeExistingVariable)
		return maybeExistingVariable
	const hsVariable = {
		name: hsName,
		type: 8000, //HSBlockType.Object
		objectIdString: randomUUID()
	}
	project.variables.push(hsVariable)
	return hsVariable
}

function getOrAddGameVariableNamed(project, name) {
	const hsName = unSnakeCase(name)
	const maybeExistingVariable = project.variables.find(variable=>variable.name == hsName)
	if (maybeExistingVariable)
		return maybeExistingVariable
	const hsVariable = {
		name: hsName,
		type: 8003, //HSBlockType.Game
		objectIdString: randomUUID()
	}
	project.variables.push(hsVariable)
	return hsVariable
}

function createRuleWith(hsBlock) {
	if (!["operator", "conditionalOperator"].includes(hsBlock.block_class))
		throw "Invalid block class for rules"
	const result = {
		id: randomUUID(),
		ruleBlockType: 6000,
		objectID: ""
	}
	result.parameters = [
		{
			defaultValue: "",
			value: "",
			key: "",
			datum: hsBlock,
			type: 52
		}
	]
	return result
}

function createHsCommentFrom(comment, addBreakpointLines) {
	const result = {
		"parameters":[
			{
				"defaultValue":"",
				"value":comment.value,
				"key":"",
				"type":55
			}
		],
		"type":69,
		"description":"#",
		"block_class":"method"
	}
	if (addBreakpointLines)
		result[BREAKPOINT_POSITION_KEY] = comment.location.start
	return result
}

function createCustomRuleInstanceFor(hsCustomRule, callbackForWhenRuleIsDefined) {
	const result = {
		id: randomUUID(),
		customRuleID: hsCustomRule.id,
		parameters: []
	}
	callbackForWhenRuleIsDefined(hsCustomRule.parameters.length, (i) => {
		const hsParameter = hsCustomRule.parameters[i]
		return hsParameter.key
	}, (i, value) => {
		const hsParameter = hsCustomRule.parameters[i]
		const newHsParameter = deepCopy(hsParameter)
		newHsParameter.value = value
		result.parameters.push(newHsParameter)
	})
	return result
}