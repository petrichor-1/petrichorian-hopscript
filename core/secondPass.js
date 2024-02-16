const { randomUUID } = require('crypto')
const parser = require("./htn.js")
const { parenthesisificateBinaryOperatorBlock } = require('./parenthesisificateBinaryOperatorBlock.js')
const { eventParameterPrototypeForIdentifier } = require('./eventParameterPrototypeForIdentifier.js')

module.exports.secondPass = (htnCode, options, stageSize, externalCallbacks) => {
	const parsed = externalCallbacks.transformParsed(parser.parse(htnCode))
	const lines = parsed.lines
	const Types = parsed.tokenTypes

	const validScopes = [{path: "Self", scope: "Self"}, {path: "Original_object", scope: "Original_object"}, {path: "Game", scope: "Game"}, {path: "User", scope: "User"}, {path: "Local", scope: "Local"}]
	parsed.objectNames.forEach(objectName => {
		if (objectName.type != Types.identifier)
			externalCallbacks.error("Should be impossible: Non-identifier object name")
		if (validScopes.map(e=>e.path).includes(objectName.value))
			externalCallbacks.error(new parser.SyntaxError("Duplicate scope path", null, objectName.value, objectName.location))
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
	})

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
	lines.forEach(line=> {
		if (line.type != Types.line) {
			externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown line type " + line.type, Types.line, line.type, line.location))
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
				externalCallbacks.error(new parser.SyntaxError("Mixing whitespace type in indentation", indentationType, undefined, line.location))
			if (indentationLevelOfLine - currentIndendationLevel > 1)
				externalCallbacks.error(new parser.SyntaxError("Multiple indentation levels", null, null, line.location))
			newIndentationLevel = indentationLevelOfLine
		}
		for (let i = newIndentationLevel; i < currentIndendationLevel; i++) {
			latestDiscardedState = stateStack.pop()
		}
		externalCallbacks.linely(currentState(), StateLevels, line)
		switch (currentState().level) {
		case StateLevels.topLevel:
			switch (line.value.type) {
			case Types.object:
				const object = line.value
				const objectTypeIdentifier = object.objectType
				if (objectTypeIdentifier.type != Types.identifier)
					externalCallbacks.error(new parser.SyntaxError("Should be impossible: Non-identifier object type", Types.identifier, objectTypeIdentifier.type, objectTypeIdentifier.location))
				const objectTypeName = objectTypeIdentifier.value
				const objectType = parsed.objectTypes[objectTypeName]
				if (!objectType)
					externalCallbacks.error(new parser.SyntaxError("Undefined object type " + objectTypeName, Object.getOwnPropertyNames(parsed.objectTypes), objectTypeName, objectTypeIdentifier.location))
				const objectAttributes = function(){
					const result = {
						xPosition: Math.random() * stageSize.width,
						yPosition: Math.random() * stageSize.height,
						resizeScale: 1,
						rotation: 0
					}
					object.attributes?.forEach(attribute => {
						if (attribute.name.type != Types.identifier)
							externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown sttribute name type", Types.identifier, attribute.name.type, attribute.name.location))
						const attributeName = attribute.name.value
						switch (attributeName) {
						case "text":
							if (attribute.value.type != Types.string)
								externalCallbacks.error(new parser.SyntaxError("Object text must be a string", Types.string, attribute.value.type, attribute.value.location))
							result.text = attribute.value.value
							break
						case "x_position":
							if (attribute.value.type != Types.number)
								externalCallbacks.error(new parser.SyntaxError("Object positions must be numbers", Types.number, attribute.value.type, attribute.value.location))
							result.xPosition = parseFloat(attribute.value.value)
							break
						case "y_position":
							if (attribute.value.type != Types.number)
								externalCallbacks.error(new parser.SyntaxError("Object positions must be numbers", Types.number, attribute.value.type, attribute.value.location))
							result.yPosition = parseFloat(attribute.value.value)
							break
						case "resize_scale":
							if (attribute.value.type != Types.number)
								externalCallbacks.error(new parser.SyntaxError("Object resize scale must be numbers", Types.number, attribute.value.type, attribute.value.location))
							result.resizeScale = parseFloat(attribute.value.value)
							break
						case "rotation":
							if (attribute.value.type != Types.number)
								externalCallbacks.error(new parser.SyntaxError("Object rotation must be numbers", Types.number, attribute.value.type, attribute.value.location))
							result.rotation = parseFloat(attribute.value.value)
							break
						default:
							externalCallbacks.error(new parser.SyntaxError(`Unknown object attribute '${attributeName}'`, ["x_position", "y_position", "text", "rotation", "resize_scale"], attributeName, attribute.name.location))
						}
					})
					return result
				}()
				if (object.name.type != Types.identifier)
					externalCallbacks.error("Should be impossible: Invalid object name type")
				const { hsObject, ability } = externalCallbacks.addHsObjectAndBeforeGameStartsAbility(objectType, object.name.value, objectAttributes, validScopes)
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
					externalCallbacks.error(new parser.SyntaxError("Top level custom rules must be definitions", ":", "", line.value.location))
				if (!line.value.value.type == Types.identifier)
					externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown custom rule name type", Types.identifier, line.value.value.type, line.value.value.location))
				const customRuleName = line.value.value.value
				if (externalCallbacks.isThereAlreadyADefinedCustomRuleNamed(customRuleName))
					throw new parser.SyntaxError("Duplicate custom rule definition", "", customRuleName, line.location)
				const {hsCustomRule, beforeGameStartsAbility} = externalCallbacks.addCustomRuleDefinitionAndReturnParameterly(customRuleName)
				stateStack.push({
					level: StateLevels.inObjectOrCustomRule,
					object: hsCustomRule,
					beforeGameStartsAbility: beforeGameStartsAbility
				})
				break
			case Types.customAbilityReference:
				const definition = line.value
				handleCustomBlockDefinition(definition, externalCallbacks, createCustomBlockAbilityFromDefinition)
				break
			case Types.parenthesisBlock:
				if (line.value.name.type == Types.customAbilityReference) {
					const parenthesisBlock = deepCopy(line.value)
					if (line.value.name.value.type != Types.identifier)
						externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown custom block name type", Types.identifier, line.value.name.value.type, line.value.name.value.location))
					parenthesisBlock.value = line.value.name.value
					parenthesisBlock.type = Types.customAbilityReference
					handleCustomBlockDefinition(parenthesisBlock, externalCallbacks, createCustomBlockAbilityFromDefinition)
					break
				}
				if (line.value.name.type == Types.customRule) {
					const parenthesisBlock = deepCopy(line.value)
					if (line.value.name.value.type != Types.identifier)
						externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown custom block name type", Types.identifier, line.value.name.value.type, line.value.name.value.location))
					if (!parenthesisBlock.doesHaveContainer)
						externalCallbacks.error(new parser.SyntaxError("Top level custom rules must be definitions", ":", "", line.value.location))
					parenthesisBlock.value = line.value.name.value
					parenthesisBlock.type = Types.customRule
					const {parameterly, hsCustomRule, beforeGameStartsAbility} = externalCallbacks.addCustomRuleDefinitionAndReturnParameterly(parenthesisBlock.value.value)
					parenthesisBlock.parameters?.forEach(parameterValue => {
						if (parameterValue.type != Types.parameterValue)
							externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknow parameter value type", Types.parameterValue, parameterValue.type, parameterValue.location))
						if (parameterValue.label.type != Types.identifier)
							externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown parameter label type", Types.identifier, parameterValue.label.type, parameterValue.label.location))
						const key = parameterValue.label.value
						switch (parameterValue.value.type) {
						case Types.string:
						case Types.number:
							parameterly(key, parameterValue.value.value)
							break
						default:
							externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown parameer value value type", [Types.string, Types.number], parameterValue.value.type, parameterValue.value.location))
						}
					})
					stateStack.push({
						level: StateLevels.inObjectOrCustomRule,
						object: hsCustomRule,
						beforeGameStartsAbility: beforeGameStartsAbility
					})
					break
				}
				// Intentionally fall through
			default:
				externalCallbacks.error(new parser.SyntaxError("Bad top level type", [Types.comment, Types.object, Types.customRule, Types.customAbilityReference, Types.parenthesisBlock], line.value.type, line.value.location))
			}
			break
		case StateLevels.inObjectOrCustomRule:
			switch (line.value.type) {
			case Types.parenthesisBlock:
				if (line.value.name.type == Types.identifier && line.value.name.value == "When") {
					if (line.value.parameters.length > 1)
						externalCallbacks.error(new parser.SyntaxError("Multiple parameters in parenthesised binary operator when block", "", JSON.stringify(line.value.parameters), line.value.location))
					if (line.value.parameters[0].type != Types.parameterValue)
						externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown type for parameter value", Types.parameterValue, line.value.parameters[0].type, line.value.parameters[0].location))
					const block = line.value.parameters[0].value
					if (block.type != Types.binaryOperatorBlock)
						externalCallbacks.error(new parser.SyntaxError("Bad object-level parenthesised binary operator block", [Types.binaryOperatorBlock], block.type, block.location))
					const whenBlock = {
						type: Types.whenBlock,
						value: block,
						doesHaveContainer: line.value.doesHaveContainer
					}
					handleWhenBlock(whenBlock, Types, parsed, validScopes, options, currentState, stateStack, StateLevels, externalCallbacks)
					break
				}
				switch (line.value.name.type) {
				case Types.whenBlock:
					const modifiedBlock = deepCopy(line.value)
					modifiedBlock.name = line.value.name.value
					const whenBlock = {
						type: Types.whenBlock,
						value: modifiedBlock,
						doesHaveContainer: modifiedBlock.doesHaveContainer
					}
					handleWhenBlock(whenBlock, Types, parsed, validScopes, options, currentState, stateStack, StateLevels, externalCallbacks)
					break
				case Types.customRule:
					const customRule = {
						type: Types.customRule,
						value: line.value.name.value,
						doesHaveContainer: line.value.doesHaveContainer,
						parameters: line.value.parameters
					}
					handleCustomRule(externalCallbacks, customRule, Types, currentState().object, options, (hsCustomRule, beforeGameStartsAbility) => {
						stateStack.push({
							level: StateLevels.inObjectOrCustomRule,
							object: hsCustomRule,
							beforeGameStartsAbility: beforeGameStartsAbility
						})
					})
					break
				default:
					externalCallbacks.error(new parser.SyntaxError("Bad object-level parenthesis block", [Types.whenBlock, Types.customRule], line.value.name.type, line.value.name.location))
				}
				break
			case Types.whenBlock:
				handleWhenBlock(line.value, Types, parsed, validScopes, options, currentState, stateStack, StateLevels, externalCallbacks)
				break
			case Types.comment:
				if (externalCallbacks.rulesCountForObject(currentState().object) != 0)
					break // Not in the initial before-game-starts ability
				currentState().beforeGameStartsAbility.blocks.push(externalCallbacks.createHsCommentFrom(line.value))
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
					handleWhenBlock(whenBlock, Types, parsed, validScopes, options, currentState, stateStack, StateLevels, externalCallbacks)
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
					handleWhenBlock(whenBlock, Types, parsed, validScopes, options, currentState, stateStack, StateLevels, externalCallbacks)
					break
				}
				if (externalCallbacks.rulesCountForObject(currentState().object) != 0)
					externalCallbacks.error(new parser.SyntaxError("Cannot include blocks after the first rule", [Types.whenBlock, Types.parenthesisBlock, Types.comment], line.value.type, line.location))
				const ability = currentState().beforeGameStartsAbility
				addBeforeGameStartsBlockToAbility(externalCallbacks, line, Types, parsed, validScopes, options, ability)
				break
			case Types.customRule:
				const customRule = line.value
				handleCustomRule(externalCallbacks, customRule, Types, currentState().object, options, (hsCustomRule, beforeGameStartsAbility) => {
					stateStack.push({
						level: StateLevels.inObjectOrCustomRule,
						object: hsCustomRule,
						beforeGameStartsAbility: beforeGameStartsAbility
					})
				})
				break
			default:
				externalCallbacks.error(new parser.SyntaxError("Bad object-level type", [Types.whenBlock, Types.parenthesisBlock, Types.comment, Types.binaryOperatorBlock], line.value.type, line.value.location))
			}
			break
		case StateLevels.inAbility:
			if (line.value.type == Types.identifier && line.value.value == "else") {
				if (!latestDiscardedState)
					externalCallbacks.error(parser.SyntaxError("Should be impossible: Else in a weird place", "", line.value.value, line,value.location))
				const checkIfElseBlock = latestDiscardedState.checkIfElseBlock
				if (!checkIfElseBlock)
					externalCallbacks.error(parser.SyntaxError("Else for non-check_if_else block", "", line.value.value, line.value.location))
				if (checkIfElseBlock.controlFalseScript)
					externalCallbacks.error(parser.SyntaxError("Multiple else in check if else block", "", line.value.value, line.value.location))
				const elseAbility = externalCallbacks.createElseAbilityFor(checkIfElseBlock)
				stateStack.push({
					level: StateLevels.inAbility,
					ability: elseAbility
				})
				break
			}
			const hsBlock = externalCallbacks.createMethodBlock(createBlockOfClasses.bind(null,externalCallbacks,options,line.value,Types,parsed.blockTypes,parsed.binaryOperatorBlockTypes,parsed.traitTypes,validScopes), currentState().ability)
			if (["control", "conditionalControl"].includes(hsBlock.block_class)) {
				if (!line.value.doesHaveContainer) {
					if (line.value.type == Types.customAbilityReference || line.value.name?.type == Types.customAbilityReference)
						break
					externalCallbacks.error(new parser.SyntaxError("Empty control block", ":", "", line.value.location))
					break
				}
				const ability = externalCallbacks.createAbilityAsControlScriptOf(hsBlock)
				stateStack.push({
					level: StateLevels.inAbility,
					ability: ability,
					checkIfElseBlock: hsBlock.type == 124 ? //HSBlockType.CheckIfElse
						hsBlock : null
				})
			} else if (line.value.doesHaveContainer) {
				externalCallbacks.error("Container on non-control block")
			}
			break
		default:
			externalCallbacks.error("Unknown state")
		}
		currentIndendationLevel = newIndentationLevel
	})
	if (externalCallbacks.hasUndefinedCustomRules())
		externalCallbacks.error(new parser.SyntaxError("Undefined custom rule", "TODO: undefinedCustomRuleNames", ""))
	if (externalCallbacks.hasUndefinedCustomBlocks())
		externalCallbacks.error(new parser.SyntaxError("Undefined custom Block", "TODO: undefinedCustomBlockNames", ""))
	return externalCallbacks.returnValue()

	function handleCustomBlockDefinition(definition, externalCallbacks, createCustomBlockAbilityFromDefinition) {
		if (!definition.doesHaveContainer)
			externalCallbacks.error(new parser.SyntaxError("Top level custom blocks must be definitions", ":", "", definition.location))
		if (!definition.value.type == Types.identifier)
			externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown custom block name type", Types.identifier, definition.value.type, definition.value.location))
		const customBlockAbility = createCustomBlockAbilityFromDefinition(definition, Types)
		stateStack.push({
			level: StateLevels.inAbility,
			ability: customBlockAbility,
			checkIfElseBlock: null
		})
	}
}

function handleWhenBlock(whenBlock, Types, parsed, validScopes, options, currentState, stateStack, StateLevels, externalCallbacks) {
	if (!whenBlock.doesHaveContainer)
		externalCallbacks.error(new parser.SyntaxError("Empty rule", ":", "", whenBlock.location))
	const currentObject = currentState().object
	const ability = externalCallbacks.createAbilityForRuleFrom(createBlockOfClasses.bind(null,externalCallbacks,options,whenBlock.value,Types,parsed.blockTypes,parsed.binaryOperatorBlockTypes,parsed.traitTypes,validScopes), currentObject)
	stateStack.push({
		level: StateLevels.inAbility,
		ability: ability
	})
}

function addBeforeGameStartsBlockToAbility(externalCallbacks, line, Types, parsed, validScopes, options, ability) {
	externalCallbacks.createMethodBlock(createBlockOfClasses.bind(null,externalCallbacks,options,line.value,Types,parsed.blockTypes,parsed.binaryOperatorBlockTypes,parsed.traitTypes,validScopes), ability)
}

function createBlockOfClasses(externalCallbacks, options, block, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, validScopes, allowedBlockClasses, blockCreationFunctions) {
	const {checkParameterLabels} = options
	if (block.type == Types.binaryOperatorBlock)
		block = parenthesisificateBinaryOperatorBlock(block, Types, allowedBlockClasses, BinaryOperatorBlockTypes)
	const result = blockCreationFunctions.begin()
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
				externalCallbacks.error(new parser.SyntaxError("Unknown block name type", Types.identifier, blockName.type, blockName.location))
			const newBlock = deepCopy(block)
			newBlock.value = blockName
			if (newBlock.value.type != Types.identifier)
				throw new parser.SyntaxError("Should be impossible: Unknown custom block name form", Types.identifier, newBlock.value.type, newBlock.value.location)
			const hsBlock = externalCallbacks.createCustomBlockReferenceFrom(newBlock.value.value)
			if (options.addBreakpointLines)
				hsBlock[BREAKPOINT_POSITION_KEY] = newBlock.location.start
			return hsBlock
		default:
			externalCallbacks.error(new parser.SyntaxError("Unknown block name type " + block.name.type, [Types.identifier, Types.customAbilityReference], block.name.type, block.name.location))
		}
		break
	case Types.comment:
		return externalCallbacks.createHsCommentFrom(block, options.addBreakpointLines)
	case Types.binaryOperatorBlock:
		externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unconverted binary operator block", [], "", block.location))
	case Types.customAbilityReference:
		if (block.value.type != Types.identifier)
			throw new parser.SyntaxError("Should be impossible: Unknown custom block name form", Types.identifier, block.value.type, block.value.location)
		const hsBlock = externalCallbacks.createCustomBlockReferenceFrom(block.value.value)
		if (options.addBreakpointLines)
			hsBlock[BREAKPOINT_POSITION_KEY] = block.location.start
		return hsBlock
	default:
		externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown block form", [Types.comment, Types.identifier, Types.comment], block.type, block.location))
	}
	const blockType = BlockTypes[blockName]
	if (!blockType)
		return createBlockFromUndefinedType(block, Types, BlockTypes, TraitTypes, validScopes, blockCreationFunctions.undefinedTypeFunctions, externalCallbacks)
	if (!allowedBlockClasses.includes(blockType.class.class))
		externalCallbacks.error(new parser.SyntaxError("Invalid block class", allowedBlockClasses, blockType.class.class, block.location))
	blockCreationFunctions.setType(result, blockType.type, blockType.description, blockType.class.class)
	for (let i = 0; i < blockType.parameters.length; i++) {
		const parameterSchema = blockType.parameters[i]
		if (blockParameters.length <= i)
			externalCallbacks.error(new parser.SyntaxError("Not enough parameters", blockType.parameters.length, blockParameters.length, block.location))
		const parameterValue = blockParameters[i]
		if (!parameterValue.pretendLabelIsValidEvenIfItIsnt && checkParameterLabels && !(!parameterSchema.name && !parameterValue.label)) {
			const parameterLabel = parameterValue.label
			if (parameterSchema.name && !parameterLabel)
				externalCallbacks.error(new parser.SyntaxError("Missing parameter label", parameterSchema.name, "", parameterValue.location))
			if (!parameterSchema.name && parameterLabel)
				externalCallbacks.error(new parser.SyntaxError("Extra parameter label", "", parameterLabel.value, parameterLabel.location))
			if (parameterLabel.type != Types.identifier)
				externalCallbacks.error("Unknown parameter label type")
			if (parameterLabel.value != parameterSchema.name)
				externalCallbacks.error(new parser.SyntaxError("Incorrect parameter label", parameterSchema.name, parameterLabel.value, parameterLabel.location))
		}
		const hsParameter = blockCreationFunctions.createParameter(parameterSchema.defaultValue, parameterSchema.key, parameterSchema.type)
		if (parameterValue.type != Types.parameterValue)
			externalCallbacks.error("Invalid parameter value type" + parameterValue.type)
		switch (parameterValue.value.type) {
		case Types.number:
		case Types.string:
			blockCreationFunctions.setParameterValue(hsParameter, parameterValue.value.value)
			break
		case Types.identifier:
			if (blockCreationFunctions.isObjectParameterType(hsParameter)) {
				const eventParameterPrototype = eventParameterPrototypeForIdentifier(parameterValue.value, validScopes)
				if (!eventParameterPrototype)
					externalCallbacks.error(new parser.SyntaxError("Cannot make eventParameter from this", ["Screen", "Self"], parameterValue.value.value, parameterValue.location))
				const hsEventParameter = createEventParameterUsing(eventParameterPrototype)
				blockCreationFunctions.setParameterVariable(hsParameter, hsEventParameter.id)
				blockCreationFunctions.addEventParameter(hsEventParameter)
				break
			}
			// Intentionally fall through
		case Types.binaryOperatorBlock:
		case Types.parenthesisBlock:
			const operatorBlockCreator = createBlockOfClasses.bind(null,externalCallbacks,options,parameterValue.value,Types,BlockTypes,BinaryOperatorBlockTypes,TraitTypes,validScopes)
			const innerBlock = blockCreationFunctions.createOperatorBlockUsing(operatorBlockCreator)
			blockCreationFunctions.setParameterDatum(hsParameter, innerBlock)
			break
		default:
			externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown parameter value type", [Types.number, Types.string, Types.identifier, Types.binaryOperatorBlock, Types.parenthesisBlock], parameterValue.value.type, parameterValue.location))
		}
		blockCreationFunctions.addParameter(result, hsParameter)
	}
	if (options.addBreakpointLines)
		result[BREAKPOINT_POSITION_KEY] = block.location.start
	return result
}

function createEventParameterUsing(prototype) {
	// MUTATES PROTOTYPE
	prototype.id = randomUUID()
	return prototype
}

function createBlockFromUndefinedType(block, Types, BlockTypes, TraitTypes, validScopes, undefinedTypeFunctions, externalCallbacks) {
	switch (block.type) {
	case Types.identifier:
		const variableDescription = getVariableDescriptionFromPath(block.value, validScopes)
		if (!variableDescription)
			externalCallbacks.error(new parser.SyntaxError("Undefined symbol", ["Block", "Variable"], JSON.stringify(block), block.location))
		const maybeTraits = TraitTypes[variableDescription.name]
		switch (variableDescription.scope) {
		case "Original_object":
			if (maybeTraits) {
				const trait = maybeTraits["Object"]
				if (trait)
					return undefinedTypeFunctions.createOriginalObjectTrait(trait)
			}
			const ooHsVariable = undefinedTypeFunctions.getOrAddObjectVariableNamed(variableDescription.name)
			return {
				type: 8005, //HSBlockType.OriginalObject
				variable: ooHsVariable.objectIdString,
				description: "Variable" // Correct
			}
		case "Self":
			if (maybeTraits) {
				const trait = maybeTraits["Object"]
				if (trait)
					return undefinedTypeFunctions.createSelfTrait(trait)
			}
			const hsVariable = undefinedTypeFunctions.getOrAddObjectVariableNamed(variableDescription.name, project)
			return {
				type: 8004, //HSBlockType.Self
				variable: hsVariable.objectIdString,
				description: "Variable" // Correct
			}
		case "Game":
			if (maybeTraits) {
				const trait = maybeTraits["Game"]
				if (trait)
					return undefinedTypeFunctions.createGameTrait(trait)
			}
			const gameHsVariable = undefinedTypeFunctions.getOrAddGameVariableNamed(variableDescription.name)
			return {
				type: 8003, //HSBlockType.Game
				variable: gameHsVariable.objectIdString,
				description: "Variable", // Correct
			}
		case "Local":
			const name = block.value
			return undefinedTypeFunctions.createLocalVariableNamed(name)
		case "Object":
			if (maybeTraits) {
				const trait = maybeTraits["Object"]
				if (trait) {
					const hsTrait = undefinedTypeFunctions.createObjectTrait(trait)
					variableDescription.fullScopeObject.whenDefined(hsObject => {
						undefinedTypeFunctions.setObjectTraitObjectToReferTo(hsTrait, hsObject)
					})
					return hsTrait
				}
			}
			const objectHsVariable = undefinedTypeFunctions.getOrAddObjectVariableNamed(variableDescription.name)
			const objectDefinitionCallback = undefinedTypeFunctions.createObjectVariableReferenceTo(objectHsVariable)
			variableDescription.fullScopeObject.whenDefined(objectDefinitionCallback)
			return hsDatum
		default:
			externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown variable scope", validScopes.map(e=>e.path), variableDescription.scope, block.location))
		}
		break
	case Types.parenthesisBlock:
		let blockName = block.name.value
		//Intentionally fall through
	default:
		blockName = blockName ?? JSON.stringify(block)
		externalCallbacks.error(new parser.SyntaxError("Undefined block", Object.getOwnPropertyNames(BlockTypes), blockName, block.location))
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

function handleCustomRule(externalCallbacks, customRule, Types, hsObjectOrCustomRule, options, transitionStateIfContainerExists) {
	if (customRule.value.type != Types.identifier)
		throw "Should be impossible: Non-identifier custom rules name"
	const nameAsString = customRule.value.value
	const {hsCustomRule, beforeGameStartsAbility} = externalCallbacks.handleCustomRule(nameAsString, hsObjectOrCustomRule, customRule.doesHaveContainer, (hsParametersCount, getExpectedNameForParameter, addNewParameter) => {
		if (hsParametersCount <= 0)
			return
		if (hsParametersCount != (customRule.parameters?.length || 0))
			throw new parser.SyntaxError("Wrong amount of parameters", hsParametersCount, parameters?.length || 0, customRule.location)
		for (let i = 0; i < hsParametersCount; i++) {
			const parameter = customRule.parameters[i]
			if (parameter.type != Types.parameterValue)
				throw new parser.SyntaxError("Should be impossible: Unknown parameyer type", Types.parameterValue, parameter.type, parameter.location)
			if (options.checkParameterLabels) {
				const label = parameter.label
				if (label.type != Types.identifier)
					throw new parser.SyntaxError("Should be impossible: Non-identifier parameter label for custom rule instance", Types.identifier, label.type, label.location)
				const expectedLabel = getExpectedNameForParameter(i)
				if (unSnakeCase(label.value) != expectedLabel)
					throw new parser.SyntaxError("Incorrect parameter label", expectedLabel, unSnakeCase(label.value), label.location)
			}
			switch (parameter.value.type) {
			case Types.string:
			case Types.number:
				addNewParameter(i,parameter.value.value)
				break
			default:
				throw new parser.SyntaxError("Should be impossible; Unknown custom rule parameter value type", [Types.string, Types.number], parameter.value.type, parameter.value.location)
			}
		}
	})
	if (customRule.doesHaveContainer)
		transitionStateIfContainerExists(hsCustomRule, beforeGameStartsAbility)
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