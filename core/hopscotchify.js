const parser = require("./htn.js")
const { randomUUID } = require('crypto')
const { HSParameterType } = require('./HSParameterType.js')

module.exports.hopscotchify = (htnCode, options) => {
	const parsed = parser.parse(htnCode)
	const lines = parsed.lines
	const Types = parsed.tokenTypes

	const validScopes = [{path: "Self", scope: "Self"}, {path: "Original_object", scope: "Original_object"}, {path: "Game", scope: "Game"}, {path: "User", scope: "User"}, {path: "Local", scope: "Local"}]
	for (let i = 0; i < parsed.objectNames.length; i++) {
		const objectName = parsed.objectNames[i]
		if (objectName.type != Types.identifier)
			throw "Should be impossible: Non-identifier object name"
		if (validScopes.map(e=>e.path).includes(objectName.value))
			throw new parser.SyntaxError("Duplicate scope path", null, objectName.value, objectName.location)
		const scope = {
			path: objectName.value,
			scope: "Object",
			_callbacksForWhenDefined: [],
			whenDefined: function(callback) {
				if (this._object)
					return callback(this._object)
				this._callbacksForWhenDefined.push(callback)
			},
			hasBeenDefinedAs: function(object) {
				this._callbacksForWhenDefined.forEach(c=>c(object))
				this._object = object
			}
		}
		validScopes.push(scope)
	}

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

	let indentationType;
	let indentationLevelWhitespaceCount;
	let currentIndendationLevel = 0

	const StateLevels = {
		topLevel: 0,
		inObjectOrCustomRule: 1,
		inAbility: 2,
	}
	let stateStack = [{
		level: StateLevels.topLevel
	}]
	function currentState() {
		return stateStack[stateStack.length-1]
	}
	let latestDiscardedState;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		if (line.type != Types.line) {
			throw "Unknown line type " + line.type
		}
		const indentationWhitespace = line.indentationWhitespace
		if (!indentationType && indentationWhitespace.length > 0) {
			indentationType = indentationWhitespace[0]
			indentationLevelWhitespaceCount = indentationWhitespace.length
		}
		let newIndentationLevel = currentIndendationLevel
		if (indentationLevelWhitespaceCount) {
			let indentationLevelOfLine = indentationWhitespace.length/indentationLevelWhitespaceCount
			if (indentationWhitespace.find(e=>e!=indentationType))
				throw "Mixing whitespace type in indentation"
			if (indentationLevelOfLine - currentIndendationLevel > 1)
				throw "Bad change in indentation level" + JSON.stringify(line)
			newIndentationLevel = indentationLevelOfLine
		}
		for (let i = newIndentationLevel; i < currentIndendationLevel; i++) {
			latestDiscardedState = stateStack.pop()
		}
		switch (currentState().level) {
		case StateLevels.topLevel:
			switch (line.value.type) {
			case Types.object:
				const object = line.value
				const objectTypeIdentifier = object.objectType
				if (objectTypeIdentifier.type != Types.identifier)
					throw "Non-identifier object type"
				const objectTypeName = objectTypeIdentifier.value
				const objectType = parsed.objectTypes[objectTypeName]
				if (!objectType)
					throw "Undefined object type " + objectTypeName
				const hsObject = deepCopy(objectType)
				if (object.name.type != Types.identifier)
					throw "Should be impossible: Invalid object name type"
				hsObject.name = unSnakeCase(object.name.value)
				hsObject.rules = []
				hsObject.objectID = randomUUID()
				hsObject.xPosition = "150"
				hsObject.yPosition = "150"
				const ability = createEmptyAbility()
				project.abilities.push(ability)
				hsObject.abilityID = ability.abilityID
				project.objects.push(hsObject)
				project.scenes[0].objects.push(hsObject.objectID)
				validScopes.find(e=>e.path == object.name.value).hasBeenDefinedAs(hsObject)
				stateStack.push({
					level: StateLevels.inObjectOrCustomRule,
					object: hsObject,
					beforeGameStartsAbility: ability
				})
				break
			case Types.comment:
				// This branch intentionally left blank
				break
			case Types.customRule:
				if (!line.value.doesHaveContainer)
					throw new parser.SyntaxError("Top level custom rules must be definitions", ":", "", line.value.location)
				if (!line.value.value.type == Types.identifier)
					throw new parser.SyntaxError("Should be impossible: Unknown custom rule name type", Types.identifier, line.value.value.type, line.value.value.location)
				addCustomRuleDefinition(customRules, line.value.value.value, line, project, customRuleDefinitionCallbacks, stateStack, StateLevels)
				break
			default:
				throw new parser.SyntaxError("Bad top level type", [Types.comment, Types.object, Types.customRule], line.value.type, line.value.location)
			}
			break
		case StateLevels.inObjectOrCustomRule:
			switch (line.value.type) {
			case Types.parenthesisBlock:
				if (line.value.name.type == Types.identifier && line.value.name.value == "When") {
					if (line.value.parameters.length > 1)
						throw new parser.SyntaxError("Multiple parameters in parenthesised binary operator when block", "", JSON.stringify(line.value.parameters), line.value.location)
					if (line.value.parameters[0].type != Types.parameterValue)
						throw new parser.SyntaxError("Should be impossible: Unknown type for parameter value", Types.parameterValue, line.value.parameters[0].type, line.value.parameters[0].location)
					const block = line.value.parameters[0].value
					if (block.type != Types.binaryOperatorBlock)
						throw new parser.SyntaxError("Bad object-level parenthesised binary operator block", [Types.binaryOperatorBlock], block.type, block.location)
					const whenBlock = {
						type: Types.whenBlock,
						value: block,
						doesHaveContainer: line.value.doesHaveContainer
					}
					handleWhenBlock(whenBlock, Types, parsed, validScopes, project, options, currentState, stateStack, StateLevels)
					break
				}
				if (line.value.name.type != Types.whenBlock)
					throw new parser.SyntaxError("Bad object-level parenthesis block", [Types.whenBlock], line.value.name.type, line.value.name.location)
				const modifiedBlock = deepCopy(line.value)
				modifiedBlock.name = line.value.name.value
				const whenBlock = {
					type: Types.whenBlock,
					value: modifiedBlock,
					doesHaveContainer: modifiedBlock.doesHaveContainer
				}
				handleWhenBlock(whenBlock, Types, parsed, validScopes, project, options, currentState, stateStack, StateLevels)
				break
			case Types.whenBlock:
				handleWhenBlock(line.value, Types, parsed, validScopes, project, options, currentState, stateStack, StateLevels)
				break
			case Types.comment:
				if (currentState().object.rules.length != 0)
					break // Not in the initial before-game-starts ability
				currentState().beforeGameStartsAbility.blocks.push(createHsCommentFrom(line.value))
				break
			case Types.binaryOperatorBlock:
				const leftSide = line.value.leftSide
				if (leftSide && leftSide.name?.type == Types.whenBlock) {
					const whenBlock = {
						type: Types.whenBlock,
						value: deepCopy(line.value),
						location: line.location,
						doesHaveContainer: line.value.doesHaveContainer
					}
					whenBlock.value.leftSide.name = leftSide.name.value
					handleWhenBlock(whenBlock, Types, parsed, validScopes, project, options, currentState, stateStack, StateLevels)
					break
				}
				if (leftSide && leftSide.type == Types.whenBlock) {
					const whenBlock = {
						type: Types.whenBlock,
						value: deepCopy(line.value),
						location: line.location,
						doesHaveContainer: line.value.doesHaveContainer
					}
					whenBlock.value.leftSide = leftSide.value
					handleWhenBlock(whenBlock, Types, parsed, validScopes, project, options, currentState, stateStack, StateLevels)
					break
				}
				if (currentState().object.rules.length != 0)
					throw new parser.SyntaxError("Cannot include blocks after the first rule", [Types.whenBlock, Types.parenthesisBlock, Types.comment], line.value.type, line.location)
				const hsMethodBlock = createMethodBlockFrom(line.value, Types, parsed.blockTypes, parsed.binaryOperatorBlockTypes, parsed.traitTypes, validScopes, project, options)
				currentState().beforeGameStartsAbility.blocks.push(hsMethodBlock)
				break
			case Types.customRule:
				if (line.value.value.type != Types.identifier)
					throw "Should be impossible: Non-identifier custom rules name"
				const nameAsString = line.value.value.value
				const rulesList = currentState().object.rules
				const tempid = "TEMP" + randomUUID()
				rulesList.push(tempid)
				onDefinitionOfCustomRuleNamed(nameAsString, hsCustomRule => {
					const hsCustomRuleInstance = createCustomRuleInstanceFor(hsCustomRule, project)
					project.customRuleInstances.push(hsCustomRuleInstance)
					const index = rulesList.findIndex(e=>e==tempid)
					if (index < 0)
						throw "Should be imposssible: Placeholder rule removed"
					rulesList[index] = hsCustomRuleInstance.id
				})
				if (!line.value.doesHaveContainer)
					break
				addCustomRuleDefinition(customRules, nameAsString, line, project, customRuleDefinitionCallbacks, stateStack, StateLevels)
				break
			default:
				throw new parser.SyntaxError("Bad object-level type", [Types.whenBlock, Types.parenthesisBlock, Types.comment, Types.binaryOperatorBlock], line.value.type, line.value.location)
			}
			break
		case StateLevels.inAbility:
			if (line.value.type == Types.identifier && line.value.value == "else") {
				if (!latestDiscardedState)
					throw new parser.SyntaxError("Should be impossible: Else in a weird place", "", line.value.value, line,value.location)
				const checkIfElseBlock = latestDiscardedState.checkIfElseBlock
				if (!checkIfElseBlock)
					throw new parser.SyntaxError("Else for non-check_if_else block", "", line.value.value, line.value.location)
				if (checkIfElseBlock.controlFalseScript)
					throw new parser.SyntaxError("Multiple else in check if else block", "", line.value.value, line.value.location)
				const elseAbility = createEmptyAbility()
				project.abilities.push(elseAbility)
				checkIfElseBlock.controlFalseScript = {abilityID: elseAbility.abilityID}
				stateStack.push({
					level: StateLevels.inAbility,
					ability: elseAbility
				})
				break
			}
			const hsBlock = createMethodBlockFrom(line.value, Types, parsed.blockTypes, parsed.binaryOperatorBlockTypes, parsed.traitTypes, validScopes, project, options)
			currentState().ability.blocks.push(hsBlock)
			if (hsBlock.type == 123) { //HSBlockType.ability
				onDefinitionOfCustomBlockNamed(hsBlock.description, hsAbility => {
					hsBlock.controlScript.abilityID = hsAbility.abilityID
				})
			}
			if (["control", "conditionalControl"].includes(hsBlock.block_class)) {
				if (!line.value.doesHaveContainer) {
					if (line.value.type == Types.customAbilityReference || line.value.name?.type == Types.customAbilityReference)
						break
					throw new parser.SyntaxError("Empty control block", ":", "", line.value.location)
				}
				const ability = createEmptyAbility()
				project.abilities.push(ability)
				hsBlock.controlScript = {abilityID: ability.abilityID}
				if (hsBlock.type == 123) { //HSBlockType.Ability
					customBlockDefinitionCallbacks[hsBlock.description]?.forEach(callback => {
						callback(ability)
					})
					customBlockDefinitionCallbacks[hsBlock.description] = null
					customBlocks[hsBlock.description] = ability
					ability.name = hsBlock.description
				}
				stateStack.push({
					level: StateLevels.inAbility,
					ability: ability,
					checkIfElseBlock: hsBlock.type == 124 ? //HSBlockType.CheckIfElse
						hsBlock : null
				})
			} else if (line.value.doesHaveContainer) {
				throw "Container on non-control block"
			}
			break
		default:
			throw "Unknown state"
		}
		currentIndendationLevel = newIndentationLevel
	}
	const undefinedCustomRuleNames = Object.getOwnPropertyNames(customRuleDefinitionCallbacks).filter(e=>!!customRuleDefinitionCallbacks[e])
	if (undefinedCustomRuleNames.length > 0)
		throw new parser.SyntaxError("Undefined custom rule", undefinedCustomRuleNames, "")
	const undefinedCustomBlockNames = Object.getOwnPropertyNames(customBlockDefinitionCallbacks).filter(e=>!!customBlockDefinitionCallbacks[e])
	if (undefinedCustomBlockNames.length > 0)
		throw new parser.SyntaxError("Undefined custom Block", undefinedCustomBlockNames, "")
	return project
}

function addCustomRuleDefinition(customRules, nameAsString, line, project, customRuleDefinitionCallbacks, stateStack, StateLevels) {
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
	project.customRules.push(hsCustomRule)
	customRuleDefinitionCallbacks[nameAsString]?.forEach(callback => callback(hsCustomRule))
	customRuleDefinitionCallbacks[nameAsString] = null
	customRules[nameAsString] = hsCustomRule
	stateStack.push({
		level: StateLevels.inObjectOrCustomRule,
		object: hsCustomRule,
		beforeGameStartsAbility: beforeGameStartsAbility
	})
}

function handleWhenBlock(whenBlock, Types, parsed, validScopes, project, options, currentState, stateStack, StateLevels) {
	if (!whenBlock.doesHaveContainer)
		throw new parser.SyntaxError("Empty rule", ":", "", whenBlock.location)
	const hsBlock = createOperatorBlockFrom(whenBlock.value, Types, parsed.blockTypes, parsed.binaryOperatorBlockTypes, parsed.traitTypes, validScopes, project, options)
	const rule = createRuleWith(hsBlock)
	currentState().object.rules.push(rule.id)
	project.rules.push(rule)
	const ability = createEmptyAbility()
	rule.abilityID = ability.abilityID
	project.abilities.push(ability)
	stateStack.push({
		level: StateLevels.inAbility,
		ability: ability
	})
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

function createCustomRuleInstanceFor(hsCustomRule) {
	return {
		id: randomUUID(),
		customRuleID: hsCustomRule.id,
		parameters: []
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
			throw "Unknown block name type " + block.name.type
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
	if (!allowedBlockClasses.includes(blockType.class))
		throw "Invalid block class"
	result.type = blockType.type
	result.description = blockType.description
	result.block_class = blockType.class
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

function parenthesisificateBinaryOperatorBlock(binaryOperatorBlock, Types, allowedBlockClasses, BinaryOperatorBlockTypes) {
	const actualBlockName = BinaryOperatorBlockTypes[binaryOperatorBlock.operatorKeyword]
	if (!actualBlockName) {
		if (binaryOperatorBlock.operatorKeyword == "=") {
			if (allowedBlockClasses.includes("method")) {
				const rightSide = deepCopy(binaryOperatorBlock.rightSide[0])
				rightSide.pretendLabelIsValidEvenIfItIsnt = true
				// TODO: Allow tri-angle style assignment syntax for *shudders* non-set/equals blocks
				return {
					type: Types.parenthesisBlock,
					location: binaryOperatorBlock.location,
					name: {type: Types.identifier, value:"set"},
					parameters: [wrapInInfallibleParameterValue(binaryOperatorBlock.leftSide, Types), rightSide]
				}
			}
		}
		throw new parser.SyntaxError("Undefined binary operator", Object.getOwnPropertyNames(BinaryOperatorBlockTypes), binaryOperatorBlock.operatorKeyword, binaryOperatorBlock.location)
	}

	let leftSide = {
		type: Types.parameterValue,
		location: binaryOperatorBlock.leftSide.location,
		value: binaryOperatorBlock.leftSide,
		pretendLabelIsValidEvenIfItIsnt: true
	}
	const leftSideOperationPriority = binaryOperatorPriority(binaryOperatorBlock.operatorKeyword)
	if (binaryOperatorBlock.rightSide.length != 1)
		throw "TODO: Multiple parameters for binary operator blocks"
	let rightSide = binaryOperatorBlock.rightSide[0]
	if (rightSide.type != Types.parameterValue)
		throw "Should be impossible: Unknown parameter value type in binary operator block"
	let listOfOperandsAndOperators = [binaryOperatorBlock.leftSide,{type: "TEMPOPERATOR", value:binaryOperatorBlock.operatorKeyword, priority: binaryOperatorPriority(binaryOperatorBlock.operatorKeyword)}]
	let currentRightSide = binaryOperatorBlock.rightSide[0].value
	while (currentRightSide.type == Types.binaryOperatorBlock) {
		listOfOperandsAndOperators.push(currentRightSide.leftSide,{type: "TEMPOPERATOR", value:currentRightSide.operatorKeyword, priority: binaryOperatorPriority(currentRightSide.operatorKeyword)})
		if (currentRightSide.rightSide.length != 1)
			throw "TODO: Multiple parameters for binary operator blocks (2)"
		currentRightSide = currentRightSide.rightSide[0].value
	}
	listOfOperandsAndOperators.push(currentRightSide)
	let maxPriority = listOfOperandsAndOperators.reduce((c,i)=>Math.max(c,i.priority !== undefined ? i.priority : c),-1)
	while (maxPriority > -1) {
		for (let i = 0; i < listOfOperandsAndOperators.length; i++) {
			const item = listOfOperandsAndOperators[i]
			if (item.type != "TEMPOPERATOR")
				continue
			if (item.priority < maxPriority)
				continue
			const actualName = BinaryOperatorBlockTypes[item.value]
			if (!actualName)
				throw new parser.SyntaxError("Undefined binary operator block", Object.getOwnPropertyNames(BinaryOperatorBlockTypes),item.value, listOfOperandsAndOperators[i-1].location) // Location is approximate
			const newItem = {
				type: Types.parenthesisBlock,
				location: listOfOperandsAndOperators[i-1].location, // Approximation
				name: {type: Types.identifier, value:actualName},
				parameters: [wrapInInfallibleParameterValue(listOfOperandsAndOperators[i-1], Types), wrapInInfallibleParameterValue(listOfOperandsAndOperators[i+1], Types)]
			}
			listOfOperandsAndOperators.splice(i-1,2)
			listOfOperandsAndOperators.fill(newItem,i-1,i)
			i--
		}
		maxPriority = listOfOperandsAndOperators.reduce((c,i)=>Math.max(c,i.priority !== undefined ? i.priority : c),-1)
	}
	if (listOfOperandsAndOperators.length != 1)
		throw "Something ent wrong lol"
	return listOfOperandsAndOperators[0]
}

function wrapInInfallibleParameterValue(e, Types) {
	return {
		type: Types.parameterValue,
		value: e,
		pretendLabelIsValidEvenIfItIsnt: true
	}
}

function findIndicesInArray(array, predicate) {
	let result = []
	for (let i = 0; i < array.length; i++) {
		if (predicate(array[i]))
			result.push(i)
	}
	return result
}

function binaryOperatorPriority(operator) {
	switch (operator) {
	case "and":
	case "or":
	case "not":
		return 0
	case "<":
	case "<=":
	case ">":
	case ">=":
	case "!=":
	case "==":
	case "=":
	case "MATCHES":
		return 1
	case "-":
	case "+":
		return 2
	case "/":
	case "*":
		return 3
	case "^":
		return 4
	default:
		throw `Should be impossible: Unknown binary operator keyword '${operator}'`
	}
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

function createEmptyAbility() {
	const timeBetween1970And2001 = 978307200000
	return {
		blocks: [],
		abilityID: randomUUID(),
		createdAt: (Date.now() - timeBetween1970And2001) / 1000,
	}
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