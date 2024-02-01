const { randomUUID } = require('crypto')
const {secondPass} = require('./secondPass.js')
const {HSParameterType} = require('./HSParameterType.js')
const { parenthesisificateBinaryOperatorBlock } = require('./parenthesisificateBinaryOperatorBlock.js')

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
	return secondPass(htnCode, options, project.stageSize, (e)=>{throw e},addHsObjectAndBeforeGameStartsAbility, addCustomRuleDefinition, createCustomBlockAbilityFromDefinition, createElseAbilityFor, createMethodBlock, createAbilityAsControlScriptOf, createAbilityForRuleFrom, o=>o.rules.length, addBlockToAbility, hasUndefinedCustomRules, hasUndefinedCustomBlocks, ()=>project, handleCustomRule, e=>e)
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
	function createMethodBlock(line, Types, parsed, validScopes, options, currentState) {
		const hsBlock = createMethodBlockFrom(line.value, Types, parsed.blockTypes, parsed.binaryOperatorBlockTypes, parsed.traitTypes, validScopes, project, options)
		currentState().ability.blocks.push(hsBlock)
		if (hsBlock.type == 123) { //HSBlockType.ability
			onDefinitionOfCustomBlockNamed(hsBlock.description, hsAbility => {
				hsBlock.controlScript.abilityID = hsAbility.abilityID
			})
		}
		return hsBlock
	}
	function handleCustomRule(customRule, line, Types, object, nextStateIfContainer) {
		if (customRule.value.type != Types.identifier)
			throw "Should be impossible: Non-identifier custom rules name"
		const nameAsString = customRule.value.value
		const rulesList = object.rules
		const tempid = "TEMP" + randomUUID()
		rulesList.push(tempid)
		onDefinitionOfCustomRuleNamed(nameAsString, hsCustomRule => {
			const hsCustomRuleInstance = createCustomRuleInstanceFor(hsCustomRule, customRule.parameters, customRule.location, Types, options)
			project.customRuleInstances.push(hsCustomRuleInstance)
			const index = rulesList.findIndex(e => e == tempid)
			if (index < 0)
				throw "Should be imposssible: Placeholder rule removed"
			rulesList[index] = hsCustomRuleInstance.id
		})
		if (!customRule.doesHaveContainer)
			return
		addCustomRuleDefinition(nameAsString, line, Types, line.value.parameters, nextStateIfContainer)
	}
	function addHsObjectAndBeforeGameStartsAbility(objectType, object, objectAttributes, error, validScopes) {
		const hsObject = deepCopy(objectType)
		hsObject.name = unSnakeCase(object.name.value)
		hsObject.rules = []
		hsObject.objectID = randomUUID()
		hsObject.xPosition = objectAttributes.xPosition.toString()
		hsObject.yPosition = objectAttributes.yPosition.toString()
		hsObject.resizeScale = objectAttributes.resizeScale.toString()
		hsObject.rotation = objectAttributes.rotation.toString()
		if (objectAttributes.text) {
			if (hsObject.type != 1) //HSObjectType.Text
				error(new parser.SyntaxError("Only text objects can have text", "", "text:", object.attributes[0].location)) // location is approximate
			hsObject.text = objectAttributes.text
		}
		const ability = createEmptyAbility()
		project.abilities.push(ability)
		hsObject.abilityID = ability.abilityID
		project.objects.push(hsObject)
		project.scenes[0].objects.push(hsObject.objectID)
		validScopes.find(e => e.path == object.name.value).hasBeenDefinedAs(hsObject)
		return { hsObject, ability }
	}
	function addBlockToAbility(line, Types, parsed, validScopes, options, ability) {
		const hsMethodBlock = createMethodBlockFrom(line.value, Types, parsed.blockTypes, parsed.binaryOperatorBlockTypes, parsed.traitTypes, validScopes, project, options)
		ability.blocks.push(hsMethodBlock)
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
	function addCustomRuleDefinition(nameAsString, line, Types, maybeParameters, transitionStateWith) {
		if (customRules[nameAsString])
			throw new parser.SyntaxError("Duplicate custom rule definition", "", nameAsString, line.location)
		const beforeGameStartsAbility = createEmptyAbility()
		project.abilities.push(beforeGameStartsAbility)
		const hsCustomRule = {
			id: randomUUID(),
			abilityID: beforeGameStartsAbility.abilityID,
			name: unSnakeCase(nameAsString),
			parameters: [], //TODO
			rules: []
		}
		maybeParameters?.forEach(parameterValue => {
			const parameter = {}
			if (parameterValue.type != Types.parameterValue)
				throw new parser.SyntaxError("Should be impossible: Unknow parameter value type", Types.parameterValue, parameterValue.type, parameterValue.location)
			if (parameterValue.label.type != Types.identifier)
				throw new parser.SyntaxError("Should be impossible: Unknown parameter label type", Types.identifier, parameterValue.label.type, parameterValue.label.location)
			parameter.key = unSnakeCase(parameterValue.label.value)
			switch (parameterValue.value.type) {
			case Types.string:
			case Types.number:
				parameter.defaultValue = parameterValue.value.value
				parameter.value = parameterValue.value.value
				break
			default:
				throw new parser.SyntaxError("Should be impossible: Unknown parameer value value type", [Types.string, Types.number], parameterValue.value.type, parameterValue.value.location)
			}
			hsCustomRule.parameters.push(parameter)
		})
		project.customRules.push(hsCustomRule)
		customRuleDefinitionCallbacks[nameAsString]?.forEach(callback => callback(hsCustomRule))
		customRuleDefinitionCallbacks[nameAsString] = null
		customRules[nameAsString] = hsCustomRule
		transitionStateWith(hsCustomRule, beforeGameStartsAbility)
	}

	function createAbilityForRuleFrom(whenBlock, Types, parsed, validScopes, options, currentObject) {
		const hsBlock = createOperatorBlockFrom(whenBlock.value, Types, parsed.blockTypes, parsed.binaryOperatorBlockTypes, parsed.traitTypes, validScopes, project, options)
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

function arrayStartsWith(big, small) {
	if (big.length < small.length)
		return false
	for (let i = 0; i < small.length; i++) {
		if (big[i] != small[i])
			return false
	}
	return true
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

function createOperatorBlockFrom(block, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, validScopes, project, options) {
	return createBlockOfClasses(["operator","conditionalOperator"], "params", block, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, validScopes, project, options)
}

function createMethodBlockFrom(block, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, validScopes, project, options) {
	return createBlockOfClasses(["method", "control", "conditionalControl"], "parameters", block, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, validScopes, project, options)
}

function createBlockOfClasses(allowedBlockClasses, parametersKey, block, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, validScopes, project, options) {
	const {checkParameterLabels} = options
	if (block.type == Types.binaryOperatorBlock)
		block = parenthesisificateBinaryOperatorBlock(block, Types, allowedBlockClasses, BinaryOperatorBlockTypes)

	let result = {}
	result[parametersKey] = []
	let blockName
	let blockParameters
	switch (block.type) {
	case Types.identifier:
		blockName = block.value
		blockParameters = []
		break
	case Types.parenthesisBlock:
		switch (block.name.type) {
		case Types.identifier:
			blockName = block.name.value
			blockParameters = block.parameters
			break
		case Types.customAbilityReference:
			blockName = block.name.value
			if (blockName.type != Types.identifier)
				throw new parser.SyntaxError("Unknown block name type", Types.identifier, blockName.type, blockName.location)
			const newBlock = deepCopy(block)
			newBlock.value = blockName
			return createCustomBlockReferenceFrom(newBlock, Types)
		default:
			throw new parser.SyntaxError("Unknown block name type " + block.name.type, [Types.identifier, Types.customAbilityReference], block.name.type, block.name.location)
		}
		break
	case Types.comment:
		return createHsCommentFrom(block)
	case Types.binaryOperatorBlock:
		throw new parser.SyntaxError("Should be impossible: Unconverted binary operator block", [], "", block.location)
	case Types.customAbilityReference:
		return createCustomBlockReferenceFrom(block, Types)
	default:
		throw new parser.SyntaxError("Should be impossible: Unknown block form", [Types.comment, Types.identifier, Types.comment], block.type, block.location)
	}
	const blockType = BlockTypes[blockName]
	if (!blockType)
		return createBlockFromUndefinedTypeOfClasses(allowedBlockClasses, parametersKey, block, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, project, validScopes, options)
	if (!allowedBlockClasses.includes(blockType.class.class))
		throw new parser.SyntaxError("Invalid block class", allowedBlockClasses, blockType.class.class, block.location)
	result.type = blockType.type
	result.description = blockType.description
	result.block_class = blockType.class.class
	for (let i = 0; i < blockType.parameters.length; i++) {
		const parameterSchema = blockType.parameters[i]
		if (blockParameters.length <= i)
			throw "Not enough parameters"
		const parameterValue = blockParameters[i]
		if (!parameterValue.pretendLabelIsValidEvenIfItIsnt && checkParameterLabels && !(!parameterSchema.name && !parameterValue.label)) {
			const parameterLabel = parameterValue.label
			if (parameterSchema.name && !parameterLabel)
				throw new parser.SyntaxError("Missing parameter label", parameterSchema.name, "", parameterValue.location)
			if (!parameterSchema.name && parameterLabel)
				throw new parser.SyntaxError("Extra parameter label", "", parameterLabel.value, parameterLabel.location)
			if (parameterLabel.type != Types.identifier)
				throw "Unknown parameter label type"
			if (parameterLabel.value != parameterSchema.name)
				throw new parser.SyntaxError("Incorrect parameter label", parameterSchema.name, parameterLabel.value, parameterLabel.location)
		}
		const hsParameter = {
			defaultValue: parameterSchema.defaultValue,
			key: parameterSchema.key,
			type: parameterSchema.type
		}
		if (parameterValue.type != Types.parameterValue)
			throw "Invalid parameter value type" + parameterValue.type
		switch (parameterValue.value.type) {
		case Types.number:
		case Types.string:
			hsParameter.value = parameterValue.value.value
			break
		case Types.identifier:
			if (hsParameter.type == HSParameterType.HSObject) {
				const eventParameterPrototype = eventParameterPrototypeForIdentifier(parameterValue.value)
				if (!eventParameterPrototype)
					throw new parser.SyntaxError("Cannot make eventParameter from this", ["Screen", "Self"], parameterValue.value.value, parameterValue.location)
				const hsEventParameter = createEventParameterUsing(eventParameterPrototype)
				hsParameter.variable = hsEventParameter.id
				project.eventParameters.push(hsEventParameter)
				break
			}
		case Types.binaryOperatorBlock:
		case Types.parenthesisBlock:
			hsParameter.datum = createOperatorBlockFrom(parameterValue.value, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, validScopes, project, options)
			break
		default:
			throw new parser.SyntaxError("Should be impossible: Unknown parameter value type", [Types.number, Types.string, Types.identifier, Types.binaryOperatorBlock, Types.parenthesisBlock], parameterValue.value.type, parameterValue.location)
		}
		result[parametersKey].push(hsParameter)
	}
	return result
}

function createCustomBlockReferenceFrom(block, Types) {
	if (block.value.type != Types.identifier)
		throw new parser.SyntaxError("Should be impossible: Unknown custom block name form", Types.identifier, block.value.type, block.value.location)
	const name = unSnakeCase(block.value.value)
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

function eventParameterPrototypeForIdentifier(identifier) {
	// THis gets mutated so return a fresh one
	switch (identifier.value) {
	case "Screen":
		return {
			blockType: 8003,
			description: "📱 My iPad"
		}
	case "Self":
		return {
			blockType: 8004,
			description: "Self"
		}
	default:
		return null
	}
}

function createEventParameterUsing(prototype) {
	// MUTATES PROTOTYPE
	prototype.id = randomUUID()
	return prototype
}

function findIndicesInArray(array, predicate) {
	let result = []
	for (let i = 0; i < array.length; i++) {
		if (predicate(array[i]))
			result.push(i)
	}
	return result
}

function createBlockFromUndefinedTypeOfClasses(allowedBlockClasses, parametersKey, block, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, project, validScopes, options) {
	switch (block.type) {
	case Types.identifier:
		const variableDescription = getVariableDescriptionFromPath(block.value, validScopes)
		if (!variableDescription)
			throw new parser.SyntaxError("Undefined symbol", ["Block", "Variable"], JSON.stringify(block), block.location)
		const maybeTraits = TraitTypes[variableDescription.name]
		switch (variableDescription.scope) {
		case "Original_object":
			if (maybeTraits) {
				const trait = maybeTraits["Object"]
				if (trait)
					return createOriginalObjectTrait(trait)
			}
			const ooHsVariable = getOrAddObjectVariableNamed(variableDescription.name, project)
			return {
				type: 8005, //HSBlockType.OriginalObject
				variable: ooHsVariable.objectIdString,
				description: "Variable" // Correct
			}
		case "Self":
			if (maybeTraits) {
				const trait = maybeTraits["Object"]
				if (trait)
					return createSelfTrait(trait)
			}
			const hsVariable = getOrAddObjectVariableNamed(variableDescription.name, project)
			return {
				type: 8004, //HSBlockType.Self
				variable: hsVariable.objectIdString,
				description: "Variable" // Correct
			}
		case "Game":
			if (maybeTraits) {
				const trait = maybeTraits["Game"]
				if (trait)
					return createGameTrait(trait)
			}
			const gameHsVariable = getOrAddGameVariableNamed(variableDescription.name, project)
			return {
				type: 8003, //HSBlockType.Game
				variable: gameHsVariable.objectIdString,
				description: "Variable", // Correct
			}
		case "Local":
			return createLocalVariableFrom(block)
		case "Object":
			if (maybeTraits) {
				const trait = maybeTraits["Object"]
				if (trait) {
					const hsTrait = createObjectTrait(trait)
					variableDescription.fullScopeObject.whenDefined(hsObject => {
						hsTrait.HSTraitObjectIDKey = hsObject.objectID
					})
					return hsTrait
				}
			}
			const objectHsVariable = getOrAddObjectVariableNamed(variableDescription.name, project)
			const hsDatum = {
				type: 8000, //HSBlockType.Object
				variable: objectHsVariable.objectIdString,
				description: "Variable", // Correct
				object: "PETRICHOR__TEMPOBJECTIDFOR" + variableDescription.path
			}
			variableDescription.fullScopeObject.whenDefined(hsObject => {hsDatum.object = hsObject.objectID})
			return hsDatum
		default:
			throw new parser.SyntaxError("Should be impossible: Unknown variable scope", validScopes.map(e=>e.path), variableDescription.scope, block.location)
		}
		break
	case Types.parenthesisBlock:
		let blockName = block.name.value
		//Intentionally fall through
	default:
		blockName = blockName ?? JSON.stringify(block)
		throw new parser.SyntaxError("Undefined block", Object.getOwnPropertyNames(BlockTypes), blockName, block.location)
	}
}

function getVariableDescriptionFromPath(variablePath, validScopes) {
	const fullVariablePath = variablePath.split('.')
	if (fullVariablePath.length == 1)
		return {scope: "Local", name:fullVariablePath[0]}
	// Determine which scope this refers to
	for (let i = 0; i < validScopes.length; i++) {
		const objectPath = validScopes[i].path.split('.')
		if (arrayStartsWith(fullVariablePath, objectPath))
			return {scope: validScopes[i].scope, name: fullVariablePath.slice(objectPath.length).join('.'), fullScopeObject: validScopes[i]}
	}
	return null
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

function createLocalVariableFrom(block) {
	const name = unSnakeCase(block.value)
	return {
		name: name,
		type: 8009, //HSBlockType.Local
		description: "Local Variable" //Constant
	}
}

function getOrAddObjectVariableNamed(name, project) {
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

function getOrAddGameVariableNamed(name, project) {
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

function createHsCommentFrom(comment) {
	return {
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
}

function createCustomRuleInstanceFor(hsCustomRule, parameters, location, Types, options) {
	const {checkParameterLabels} = options
	const result = {
		id: randomUUID(),
		customRuleID: hsCustomRule.id,
		parameters: []
	}
	if (hsCustomRule.parameters.length > 0) {
		if (hsCustomRule.parameters.length != (parameters?.length || 0))
			throw new parser.SyntaxError("Wrong amount of parameters", hsCustomRule.parameters.length, parameters?.length || 0, location)
		for (let i = 0; i < hsCustomRule.parameters.length; i++) {
			const hsParameter = hsCustomRule.parameters[i]
			const parameter = parameters[i]
			if (parameter.type != Types.parameterValue)
				throw new parser.SyntaxError("Should be impossible: Unknown parameyer type", Types.parameterValue, parameter.type, parameter.location)
			if (checkParameterLabels) {
				const label = parameter.label
				if (label.type != Types.identifier)
					throw new parser.SyntaxError("Should be impossible: Non-identifier parameter label for custom rule instance", Types.identifier, label.type, label.location)
				if (unSnakeCase(label.value) != hsParameter.key)
					throw new parser.SyntaxError("Incorrect parameter label", hsParameter.key, unSnakeCase(label.value), label.location)
			}
			const newHsParameter = deepCopy(hsParameter)
			switch (parameter.value.type) {
			case Types.string:
			case Types.number:
				newHsParameter.value = parameter.value.value
				break
			default:
				throw new parser.SyntaxError("Should be impossible; Unknown custom rule parameter value type", [Types.string, Types.number], parameter.value.type, parameter.value.location)
			}
			result.parameters.push(newHsParameter)
		}
	}
	return result
}