const parser = require("./htn.js")

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
				externalCallbacks.addCustomRuleDefinition(customRuleName, line, Types, null, (hsCustomRule, beforeGameStartsAbility) => {
					stateStack.push({
						level: StateLevels.inObjectOrCustomRule,
						object: hsCustomRule,
						beforeGameStartsAbility: beforeGameStartsAbility
					})
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
					externalCallbacks.addCustomRuleDefinition(parenthesisBlock.value.value, Types, parenthesisBlock.parameters, (hsCustomRule, beforeGameStartsAbility) => {
						stateStack.push({
							level: StateLevels.inObjectOrCustomRule,
							object: hsCustomRule,
							beforeGameStartsAbility: beforeGameStartsAbility
						})
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
					externalCallbacks.handleCustomRule(customRule, line, Types, currentState().object, (hsCustomRule, beforeGameStartsAbility) => {
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
				if ((currentState().object?.rules?.length || 0) != 0)
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
				externalCallbacks.addBlockToAbility(line, Types, parsed, validScopes, options, ability)
				break
			case Types.customRule:
				const customRule = line.value
				externalCallbacks.handleCustomRule(customRule, line, Types, currentState().object,(hsCustomRule, beforeGameStartsAbility) => {
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
			const hsBlock = externalCallbacks.createMethodBlock(line, Types, parsed, validScopes, options, currentState)
			if (["control", "conditionalControl"].includes(hsBlock.block_class)) {
				if (!line.value.doesHaveContainer) {
					if (line.value.type == Types.customAbilityReference || line.value.name?.type == Types.customAbilityReference)
						break
						externalCallbacks.error(new parser.SyntaxError("Empty control block", ":", "", line.value.location))
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
	const ability = externalCallbacks.createAbilityForRuleFrom(whenBlock, Types, parsed, validScopes, options, currentObject)
	stateStack.push({
		level: StateLevels.inAbility,
		ability: ability
	})
}

function deepCopy(object) {
	return JSON.parse(JSON.stringify(object))
}