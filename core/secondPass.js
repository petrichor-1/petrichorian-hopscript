const parser = require("./htn.js")

module.exports.secondPass = (htnCode, options, stageSize, error, addHsObjectAndBeforeGameStartsAbility, addCustomRuleDefinition, createCustomBlockAbilityFromDefinition, createElseAbilityFor, createMethodBlock, createAbilityAsControlScriptOf, createAbilityForRuleFrom, rulesCountForObject, addBlockToAbility, hasUndefinedCustomRules, hasUndefinedCustomBlocks, returnValue, handleCustomRule, transformParsed, linely) => {
	const parsed = transformParsed(parser.parse(htnCode))
	const lines = parsed.lines
	const Types = parsed.tokenTypes

	const validScopes = [{path: "Self", scope: "Self"}, {path: "Original_object", scope: "Original_object"}, {path: "Game", scope: "Game"}, {path: "User", scope: "User"}, {path: "Local", scope: "Local"}]
	for (let i = 0; i < parsed.objectNames.length; i++) {
		const objectName = parsed.objectNames[i]
		if (objectName.type != Types.identifier)
			error("Should be impossible: Non-identifier object name")
		if (validScopes.map(e=>e.path).includes(objectName.value))
			error(new parser.SyntaxError("Duplicate scope path", null, objectName.value, objectName.location))
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
			error(new parser.SyntaxError("Should be impossible: Unknown line type " + line.type, Types.line, line.type, line.location))
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
				error(new parser.SyntaxError("Mixing whitespace type in indentation", indentationType, undefined, line.location))
			if (indentationLevelOfLine - currentIndendationLevel > 1)
				error(new parser.SyntaxError("Multiple indentation levels", null, null, line.location))
			newIndentationLevel = indentationLevelOfLine
		}
		for (let i = newIndentationLevel; i < currentIndendationLevel; i++) {
			latestDiscardedState = stateStack.pop()
		}
		linely(currentState(), StateLevels, line)
		switch (currentState().level) {
		case StateLevels.topLevel:
			switch (line.value.type) {
			case Types.object:
				const object = line.value
				const objectTypeIdentifier = object.objectType
				if (objectTypeIdentifier.type != Types.identifier)
					error(new parser.SyntaxError("Should be impossible: Non-identifier object type", Types.identifier, objectTypeIdentifier.type, objectTypeIdentifier.location))
				const objectTypeName = objectTypeIdentifier.value
				const objectType = parsed.objectTypes[objectTypeName]
				if (!objectType)
					error(new parser.SyntaxError("Undefined object type " + objectTypeName, Object.getOwnPropertyNames(parsed.objectTypes), objectTypeName, objectTypeIdentifier.location))
				const objectAttributes = function(){
					const result = {
						xPosition: Math.random() * stageSize.width,
						yPosition: Math.random() * stageSize.height,
						resizeScale: 1,
						rotation: 0
					}
					object.attributes?.forEach(attribute => {
						if (attribute.name.type != Types.identifier)
							error(new parser.SyntaxError("Should be impossible: Unknown sttribute name type", Types.identifier, attribute.name.type, attribute.name.location))
						const attributeName = attribute.name.value
						switch (attributeName) {
						case "text":
							if (attribute.value.type != Types.string)
								error(new parser.SyntaxError("Object text must be a string", Types.string, attribute.value.type, attribute.value.location))
							result.text = attribute.value.value
							break
						case "x_position":
							if (attribute.value.type != Types.number)
								error(new parser.SyntaxError("Object positions must be numbers", Types.number, attribute.value.type, attribute.value.location))
							result.xPosition = parseFloat(attribute.value.value)
							break
						case "y_position":
							if (attribute.value.type != Types.number)
								error(new parser.SyntaxError("Object positions must be numbers", Types.number, attribute.value.type, attribute.value.location))
							result.yPosition = parseFloat(attribute.value.value)
							break
						case "resize_scale":
							if (attribute.value.type != Types.number)
								error(new parser.SyntaxError("Object resize scale must be numbers", Types.number, attribute.value.type, attribute.value.location))
							result.resizeScale = parseFloat(attribute.value.value)
							break
						case "rotation":
							if (attribute.value.type != Types.number)
								error(new parser.SyntaxError("Object rotation must be numbers", Types.number, attribute.value.type, attribute.value.location))
							result.rotation = parseFloat(attribute.value.value)
							break
						default:
							error(new parser.SyntaxError(`Unknown object attribute '${attributeName}'`, ["x_position", "y_position", "text"], attributeName, attribute.name.location))
						}
					})
					return result
				}()
				if (object.name.type != Types.identifier)
					error("Should be impossible: Invalid object name type")
				const { hsObject, ability } = addHsObjectAndBeforeGameStartsAbility(objectType, object, objectAttributes, error, validScopes)
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
					error(new parser.SyntaxError("Top level custom rules must be definitions", ":", "", line.value.location))
				if (!line.value.value.type == Types.identifier)
					error(new parser.SyntaxError("Should be impossible: Unknown custom rule name type", Types.identifier, line.value.value.type, line.value.value.location))
				addCustomRuleDefinition(line.value.value.value, line, Types, null, (hsCustomRule, beforeGameStartsAbility) => {
					stateStack.push({
						level: StateLevels.inObjectOrCustomRule,
						object: hsCustomRule,
						beforeGameStartsAbility: beforeGameStartsAbility
					})
				})
				//TODO: Finish starting here
				break
			case Types.customAbilityReference:
				const definition = line.value
				handleCustomBlockDefinition(definition, error, createCustomBlockAbilityFromDefinition)
				break
			case Types.parenthesisBlock:
				if (line.value.name.type == Types.customAbilityReference) {
					const parenthesisBlock = deepCopy(line.value)
					if (line.value.name.value.type != Types.identifier)
						error(new parser.SyntaxError("Should be impossible: Unknown custom block name type", Types.identifier, line.value.name.value.type, line.value.name.value.location))
					parenthesisBlock.value = line.value.name.value
					parenthesisBlock.type = Types.customAbilityReference
					handleCustomBlockDefinition(parenthesisBlock, error, createCustomBlockAbilityFromDefinition)
					break
				}
				if (line.value.name.type == Types.customRule) {
					const parenthesisBlock = deepCopy(line.value)
					if (line.value.name.value.type != Types.identifier)
						error(new parser.SyntaxError("Should be impossible: Unknown custom block name type", Types.identifier, line.value.name.value.type, line.value.name.value.location))
					if (!parenthesisBlock.doesHaveContainer)
						error(new parser.SyntaxError("Top level custom rules must be definitions", ":", "", line.value.location))
					parenthesisBlock.value = line.value.name.value
					parenthesisBlock.type = Types.customRule
					addCustomRuleDefinition(parenthesisBlock.value.value, line, Types, parenthesisBlock.parameters, (hsCustomRule, beforeGameStartsAbility) => {
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
				error(new parser.SyntaxError("Bad top level type", [Types.comment, Types.object, Types.customRule, Types.customAbilityReference, Types.parenthesisBlock], line.value.type, line.value.location))
			}
			break
		case StateLevels.inObjectOrCustomRule:
			switch (line.value.type) {
			case Types.parenthesisBlock:
				if (line.value.name.type == Types.identifier && line.value.name.value == "When") {
					if (line.value.parameters.length > 1)
						error(new parser.SyntaxError("Multiple parameters in parenthesised binary operator when block", "", JSON.stringify(line.value.parameters), line.value.location))
					if (line.value.parameters[0].type != Types.parameterValue)
						error(new parser.SyntaxError("Should be impossible: Unknown type for parameter value", Types.parameterValue, line.value.parameters[0].type, line.value.parameters[0].location))
					const block = line.value.parameters[0].value
					if (block.type != Types.binaryOperatorBlock)
						error(new parser.SyntaxError("Bad object-level parenthesised binary operator block", [Types.binaryOperatorBlock], block.type, block.location))
					const whenBlock = {
						type: Types.whenBlock,
						value: block,
						doesHaveContainer: line.value.doesHaveContainer
					}
					handleWhenBlock(whenBlock, Types, parsed, validScopes, options, currentState, stateStack, StateLevels, createAbilityForRuleFrom, error)
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
					handleWhenBlock(whenBlock, Types, parsed, validScopes, options, currentState, stateStack, StateLevels, createAbilityForRuleFrom, error)
					break
				case Types.customRule:
					const customRule = {
						type: Types.customRule,
						value: line.value.name.value,
						doesHaveContainer: line.value.doesHaveContainer,
						parameters: line.value.parameters
					}
					handleCustomRule(customRule, line, Types, currentState().object, (hsCustomRule, beforeGameStartsAbility) => {
						stateStack.push({
							level: StateLevels.inObjectOrCustomRule,
							object: hsCustomRule,
							beforeGameStartsAbility: beforeGameStartsAbility
						})
					})
					break
				default:
					error(new parser.SyntaxError("Bad object-level parenthesis block", [Types.whenBlock, Types.customRule], line.value.name.type, line.value.name.location))
				}
				break
			case Types.whenBlock:
				handleWhenBlock(line.value, Types, parsed, validScopes, options, currentState, stateStack, StateLevels, createAbilityForRuleFrom, error)
				break
			case Types.comment:
				if ((currentState().object?.rules?.length || 0) != 0)
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
					handleWhenBlock(whenBlock, Types, parsed, validScopes, options, currentState, stateStack, StateLevels, createAbilityForRuleFrom, error)
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
					handleWhenBlock(whenBlock, Types, parsed, validScopes, options, currentState, stateStack, StateLevels, createAbilityForRuleFrom, error)
					break
				}
				if (rulesCountForObject(currentState().object) != 0)
					error(new parser.SyntaxError("Cannot include blocks after the first rule", [Types.whenBlock, Types.parenthesisBlock, Types.comment], line.value.type, line.location))
				const ability = currentState().beforeGameStartsAbility
				addBlockToAbility(line, Types, parsed, validScopes, options, ability)
				break
			case Types.customRule:
				const customRule = line.value
				handleCustomRule(customRule, line, Types, currentState().object,(hsCustomRule, beforeGameStartsAbility) => {
					stateStack.push({
						level: StateLevels.inObjectOrCustomRule,
						object: hsCustomRule,
						beforeGameStartsAbility: beforeGameStartsAbility
					})
				})
				break
			default:
				error(new parser.SyntaxError("Bad object-level type", [Types.whenBlock, Types.parenthesisBlock, Types.comment, Types.binaryOperatorBlock], line.value.type, line.value.location))
			}
			break
		case StateLevels.inAbility:
			if (line.value.type == Types.identifier && line.value.value == "else") {
				if (!latestDiscardedState)
					error(parser.SyntaxError("Should be impossible: Else in a weird place", "", line.value.value, line,value.location))
				const checkIfElseBlock = latestDiscardedState.checkIfElseBlock
				if (!checkIfElseBlock)
					error(parser.SyntaxError("Else for non-check_if_else block", "", line.value.value, line.value.location))
				if (checkIfElseBlock.controlFalseScript)
					error(parser.SyntaxError("Multiple else in check if else block", "", line.value.value, line.value.location))
				const elseAbility = createElseAbilityFor(checkIfElseBlock)
				stateStack.push({
					level: StateLevels.inAbility,
					ability: elseAbility
				})
				break
			}
			const hsBlock = createMethodBlock(line, Types, parsed, validScopes, options, currentState)
			if (["control", "conditionalControl"].includes(hsBlock.block_class)) {
				if (!line.value.doesHaveContainer) {
					if (line.value.type == Types.customAbilityReference || line.value.name?.type == Types.customAbilityReference)
						break
					error(new parser.SyntaxError("Empty control block", ":", "", line.value.location))
				}
				const ability = createAbilityAsControlScriptOf(hsBlock)
				stateStack.push({
					level: StateLevels.inAbility,
					ability: ability,
					checkIfElseBlock: hsBlock.type == 124 ? //HSBlockType.CheckIfElse
						hsBlock : null
				})
			} else if (line.value.doesHaveContainer) {
				error("Container on non-control block")
			}
			break
		default:
			error("Unknown state")
		}
		currentIndendationLevel = newIndentationLevel
	}
	if (hasUndefinedCustomRules())
		error(new parser.SyntaxError("Undefined custom rule", "TODO: undefinedCustomRuleNames", ""))
	if (hasUndefinedCustomBlocks())
		error(new parser.SyntaxError("Undefined custom Block", "TODO: undefinedCustomBlockNames", ""))
	return returnValue()

	function handleCustomBlockDefinition(definition, error, createCustomBlockAbilityFromDefinition) {
		if (!definition.doesHaveContainer)
			error(new parser.SyntaxError("Top level custom blocks must be definitions", ":", "", definition.location))
		if (!definition.value.type == Types.identifier)
			error(new parser.SyntaxError("Should be impossible: Unknown custom block name type", Types.identifier, definition.value.type, definition.value.location))
		const customBlockAbility = createCustomBlockAbilityFromDefinition(definition, Types)
		stateStack.push({
			level: StateLevels.inAbility,
			ability: customBlockAbility,
			checkIfElseBlock: null
		})
	}
}

function handleWhenBlock(whenBlock, Types, parsed, validScopes, options, currentState, stateStack, StateLevels, createAbilityForRuleFrom, error) {
	if (!whenBlock.doesHaveContainer)
		error(new parser.SyntaxError("Empty rule", ":", "", whenBlock.location))
	const currentObject = currentState().object
	const ability = createAbilityForRuleFrom(whenBlock, Types, parsed, validScopes, options, currentObject)
	stateStack.push({
		level: StateLevels.inAbility,
		ability: ability
	})
}

function deepCopy(object) {
	return JSON.parse(JSON.stringify(object))
}