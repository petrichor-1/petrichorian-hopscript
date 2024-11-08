const { randomUUID } = require('crypto')
const parser = require("./htn.js")
const { parenthesisificateBinaryOperatorBlock } = require('./parenthesisificateBinaryOperatorBlock.js')
const { eventParameterPrototypeForIdentifier } = require('./eventParameterPrototypeForIdentifier.js')
const path = require('path')

const BREAKPOINT_POSITION_KEY = "PETRICHOR_BREAKPOINT_POSITION"

module.exports.secondPass = (htnPath, htnCode, options, stageSize, externalCallbacks) => {
	let parsed = parser.parse(htnCode, {grammarSource: htnPath})
	if (parsed.requiresBetaEditor && externalCallbacks.setRequiresBetaEditor)
		externalCallbacks.setRequiresBetaEditor(true)
	if (externalCallbacks.transformParsed)
		parsed = externalCallbacks.transformParsed(parsed)
	const dependencies = {}
	parsed.dependencies.forEach(dependencyPath => {
		if (/\//.test(dependencyPath)) {
			dependencyPath = path.resolve(path.dirname(htnPath), dependencyPath)
		} else {
			dependencyPath = path.join(__dirname, "prelude", path.basename(dependencyPath))
		}
		dependencies[dependencyPath] = externalCallbacks.handleDependency(dependencyPath)
	})
	if (externalCallbacks.afterDependencyResolution)
		externalCallbacks.afterDependencyResolution(parsed, dependencies)

	function getBlockTypeNamed(name) {
		if (parsed.blockTypes[name])
			return parsed.blockTypes[name]
		for (const path in dependencies) {
			if (Object.hasOwnProperty.call(dependencies, path)) {
				const dependencyData = dependencies[path];
				if (dependencyData.blockTypes && dependencyData.blockTypes[name])
					return dependencyData.blockTypes[name]
			}
		}
		return null
	}
	function getObjectTypeNamed(name) {
		if (parsed.objectTypes[name])
			return parsed.objectTypes[name]
		for (const path in dependencies) {
			if (Object.hasOwnProperty.call(dependencies, path)) {
				const dependencyData = dependencies[path];
				if (dependencyData.objectTypes && dependencyData.objectTypes[name])
					return dependencyData.objectTypes[name]
			}
		}
		return null
	}
	function getBinaryOperatorBlockWithKeyword(keyword) {
		if (parsed.binaryOperatorBlockTypes[keyword])
			return parsed.binaryOperatorBlockTypes[keyword]
		for (const path in dependencies) {
			if (Object.hasOwnProperty.call(dependencies, path)) {
				const dependencyData = dependencies[path];
				if (dependencyData.binaryOperatorBlockTypes && dependencyData.binaryOperatorBlockTypes[keyword])
					return dependencyData.binaryOperatorBlockTypes[keyword]
			}
		}
		return null
	}
	function getDataTypesForParameterType(hsType) {
		if (parsed.parameterTypes[hsType])
			return parsed.parameterTypes[hsType]
		for (const path in dependencies) {
			if (Object.hasOwnProperty.call(dependencies, path)) {
				const dependencyData = dependencies[path];
				if (dependencyData.parameterTypes && dependencyData.parameterTypes[hsType])
					return dependencyData.parameterTypes[hsType]
			}
		}
		return null
	}
	function getTraitTypeWithName(name) {
		if (parsed.traitTypes[name])
			return parsed.traitTypes[name]
		for (const path in dependencies) {
			if (Object.hasOwnProperty.call(dependencies, path)) {
				const dependencyData = dependencies[path];
				if (dependencyData.traitTypes && dependencyData.traitTypes[name])
					return dependencyData.traitTypes[name]
			}
		}
		return null
	}
	function doesSceneExistWithName(name) {
		if (parsed.sceneNames.includes(name))
			return true
		for (const path in dependencies) {
			if (Object.hasOwnProperty.call(dependencies, path)) {
				const dependencyData = dependencies[path];
				if (dependencyData.sceneNames && dependencyData.sceneNames.includes(name))
					return true
			}
		}
		return false
	}

	function getParametersForCustomBlockNamed(name) {
		if (parsed.definedCustomBlocks[name])
			return parsed.definedCustomBlocks[name]
		for (const path in dependencies) {
			if (Object.hasOwnProperty.call(dependencies, path)) {
				const dependencyData = dependencies[path];
				if (dependencyData.definedCustomBlocks && dependencyData.definedCustomBlocks[name])
					return dependencyData.definedCustomBlocks[name]
			}
		}
		return null
	}

	const blockCreationHelpers = {getBlockTypeNamed, getBinaryOperatorBlockWithKeyword, getTraitTypeWithName, getDataTypesForParameterType, doesSceneExistWithName, getObjectTypeNamed, getParametersForCustomBlockNamed}
	const lines = parsed.lines
	const Types = parsed.tokenTypes

	const validScopes = [{path: "Self", scope: "Self"}, {path: "Original_object", scope: "Original_object"}, {path: "Game", scope: "Game"}, {path: "User", scope: "User"}, {path: "Local", scope: "Local"}, {path: "Scenes", scope: "Scene"}]
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
		topLevel: -1,
		inScene: 0,
		inObjectOrCustomRule: 1,
		inAbility: 2,
	}
	let stateStack = [{
		level: StateLevels.topLevel
	}]
	function currentState() {
		return stateStack[stateStack.length-1]
	}
	function latestHsScene() {
		for (let i = stateStack.length-1; i >= 0; i--) {
			if (stateStack[i].level == StateLevels.inScene)
				return stateStack[i].scene
		}
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
		currentIndendationLevel = newIndentationLevel
		externalCallbacks.linely(currentState(), StateLevels, line)
		switch (currentState().level) {
		case StateLevels.topLevel:
			switch (line.value.type) {
			case Types.comment:
				return; // Don't know what level this is, but no matter what this can't be included in the final result
			case Types.scene:
				const sceneName = line.value.name
				if (sceneName.type != Types.identifier)
					return externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown type for scene name", Types.identifier, sceneName.type, sceneName.location))
				const hsScene = externalCallbacks.createSceneNamed(sceneName.value)
				stateStack.push({
					level: StateLevels.inScene,
					scene: hsScene
				})
				return
			default:
				stateStack.push({
					level: StateLevels.inScene,
					scene: externalCallbacks.createSceneNamed("Scene 1")
				})
				// This means that the top level is actually scene level, so fall through to that case.
			}
			// Intentionally fall through
		case StateLevels.inScene:
			switch (line.value.type) {
			case Types.object:
				const object = line.value
				const objectTypeIdentifier = object.objectType
				if (objectTypeIdentifier.type != Types.identifier)
					externalCallbacks.error(new parser.SyntaxError("Should be impossible: Non-identifier object type", Types.identifier, objectTypeIdentifier.type, objectTypeIdentifier.location))
				const objectTypeName = objectTypeIdentifier.value
				const objectType = getObjectTypeNamed(objectTypeName)
				if (!objectType)
					externalCallbacks.error(new parser.SyntaxError("Undefined object type " + objectTypeName, "TODO: Object.getOwnPropertyNames(parsed.objectTypes)", objectTypeName, objectTypeIdentifier.location))
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
						case "file":
							if (attribute.value.type != Types.string)
								externalCallbacks.error(new parser.SyntaxError("Object custom image filename must be a string", Types.string, attribute.value.type, attribute.value.location))
							result.customImageFilename = attribute.value.value
							break
						default:
							externalCallbacks.error(new parser.SyntaxError(`Unknown object attribute '${attributeName}'`, ["x_position", "y_position", "text", "rotation", "resize_scale", "file"], attributeName, attribute.name.location))
						}
					})
					return result
				}()
				if (object.name.type != Types.identifier)
					externalCallbacks.error("Should be impossible: Invalid object name type")
				const { hsObject, ability } = externalCallbacks.addHsObjectAndBeforeGameStartsAbility(objectType, object.name.value, objectAttributes, latestHsScene())
				validScopes.find(e => e.path == object.name.value).hasBeenDefinedAs(hsObject)
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
				const {hsCustomRule, beforeGameStartsAbility, finish} = externalCallbacks.addCustomRuleDefinitionAndReturnParameterly(customRuleName)
				stateStack.push({
					level: StateLevels.inObjectOrCustomRule,
					object: hsCustomRule,
					beforeGameStartsAbility: beforeGameStartsAbility
				})
				finish()
				break
			case Types.customAbilityReference:
				const definition = line.value
				handleCustomBlockDefinition(definition, externalCallbacks, createCustomBlockAbilityFromDefinition.bind(null, blockCreationHelpers))
				break
			case Types.parenthesisBlock:
				if (line.value.name.type == Types.customAbilityReference) {
					const parenthesisBlock = deepCopy(line.value)
					if (line.value.name.value.type != Types.identifier)
						externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown custom block name type", Types.identifier, line.value.name.value.type, line.value.name.value.location))
					parenthesisBlock.value = line.value.name.value
					parenthesisBlock.type = Types.customAbilityReference
					handleCustomBlockDefinition(parenthesisBlock, externalCallbacks, createCustomBlockAbilityFromDefinition.bind(null, blockCreationHelpers))
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
					const {parameterly, hsCustomRule, beforeGameStartsAbility, finish} = externalCallbacks.addCustomRuleDefinitionAndReturnParameterly(parenthesisBlock.value.value)
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
					finish()
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
					handleWhenBlock(whenBlock, Types, validScopes, options, currentState, stateStack, StateLevels, externalCallbacks, blockCreationHelpers)
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
					handleWhenBlock(whenBlock, Types, validScopes, options, currentState, stateStack, StateLevels, externalCallbacks, blockCreationHelpers)
					break
				case Types.customRule:
					const customRule = {
						type: Types.customRule,
						value: line.value.name.value,
						doesHaveContainer: line.value.doesHaveContainer,
						parameters: line.value.parameters
					}
					handleCustomRule(externalCallbacks, customRule, Types, currentState().object, options, validScopes, blockCreationHelpers, (hsCustomRule, beforeGameStartsAbility) => {
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
				handleWhenBlock(line.value, Types, validScopes, options, currentState, stateStack, StateLevels, externalCallbacks, blockCreationHelpers)
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
					handleWhenBlock(whenBlock, Types, validScopes, options, currentState, stateStack, StateLevels, externalCallbacks, blockCreationHelpers)
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
					handleWhenBlock(whenBlock, Types, validScopes, options, currentState, stateStack, StateLevels, externalCallbacks, blockCreationHelpers)
					break
				}
				if (externalCallbacks.rulesCountForObject(currentState().object) != 0)
					externalCallbacks.error(new parser.SyntaxError("Cannot include blocks after the first rule", [Types.whenBlock, Types.parenthesisBlock, Types.comment], line.value.type, line.location))
				const ability = currentState().beforeGameStartsAbility
				addBeforeGameStartsBlockToAbility(externalCallbacks, line, Types, validScopes, options, ability, blockCreationHelpers)
				break
			case Types.customRule:
				const customRule = line.value
				handleCustomRule(externalCallbacks, customRule, Types, currentState().object, options, validScopes, blockCreationHelpers, (hsCustomRule, beforeGameStartsAbility) => {
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
			const hsBlock = externalCallbacks.createMethodBlock(createBlockOfClasses.bind(null,externalCallbacks,options,line.value,Types,validScopes, blockCreationHelpers), currentState().ability)
			if (["control", "conditionalControl"].includes(hsBlock.block_class)) {
				if (!line.value.doesHaveContainer) {
					if (line.value.type == Types.customAbilityReference || line.value.name?.type == Types.customAbilityReference)
						break
					externalCallbacks.error(new parser.SyntaxError("Empty control block", ":", "", line.value.location))
					break
				}
				let ability;
				if (line.value.type == Types.customAbilityReference || line.value.name?.type == Types.customAbilityReference) {
					const definition = function(){
						if (line.value.type == Types.customAbilityReference)
							return line.value
						if (line.value.name?.type !== Types.customAbilityReference)
							return externalCallbacks.error(new parser.SyntaxError("Incorrect custom block definition form.", Types.customAbilityReference, line.value.type, line.value.location))
						const result = deepCopy(line.value)
						result.value = deepCopy(line.value.name.value)
						return result
					}()
					ability = createCustomBlockAbilityFromDefinition(blockCreationHelpers, definition, externalCallbacks, Types)
				}
				if (!ability)
					ability = externalCallbacks.createAbilityAsControlScriptOf(hsBlock)
				stateStack.push({
					level: StateLevels.inAbility,
					ability: ability,
					checkIfElseBlock: hsBlock.type == 124 ? //HSBlockType.CheckIfElse
						hsBlock : null
				})
			} else if (line.value.doesHaveContainer) {
				externalCallbacks.error(new parser.SyntaxError("Container on non-control block", "", ":", line.value.location))
			}
			break
		default:
			externalCallbacks.error("Unknown state")
		}
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
		const customBlockAbility = createCustomBlockAbilityFromDefinition(definition, externalCallbacks, Types)
		stateStack.push({
			level: StateLevels.inAbility,
			ability: customBlockAbility,
			checkIfElseBlock: null
		})
	}
}

function handleWhenBlock(whenBlock, Types, validScopes, options, currentState, stateStack, StateLevels, externalCallbacks, helpers) {
	if (!whenBlock.doesHaveContainer)
		externalCallbacks.error(new parser.SyntaxError("Empty rule", ":", "", whenBlock.location))
	const currentObject = currentState().object
	const ability = externalCallbacks.createAbilityForRuleFrom(createBlockOfClasses.bind(null,externalCallbacks,options,whenBlock.value,Types,validScopes, helpers), currentObject)
	stateStack.push({
		level: StateLevels.inAbility,
		ability: ability
	})
}
function addBeforeGameStartsBlockToAbility(externalCallbacks, line, Types, validScopes, options, ability, helpers) {
	externalCallbacks.createMethodBlock(createBlockOfClasses.bind(null,externalCallbacks,options,line.value,Types,validScopes, helpers), ability)
}
function unSnakeCase(snakeCaseString) {
	const words = snakeCaseString.split("_")
		.map(e=>e[0].toUpperCase()+e.substring(1,e.length))
	return words.join(" ")
}
function createCustomBlockAbilityFromDefinition(helpers, definition, externalCallbacks, Types) {
	const name = unSnakeCase(definition.value.value)
	const customBlockAbility = externalCallbacks.customBlockAbilityFunctions.begin(name)
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
			externalCallbacks.customBlockAbilityFunctions.addParameter(customBlockAbility, unSnakeCase(parameter.label.value), parameterValue)
		}
	}
	externalCallbacks.customBlockAbilityFunctions.finish(customBlockAbility, name)
	return customBlockAbility
}

function createBlockOfClasses(externalCallbacks, options, block, Types, validScopes, helpers, allowedBlockClasses, blockCreationFunctions, maybeParameterType) {
	const {checkParameterLabels} = options
	if (block.type == Types.binaryOperatorBlock)
		block = parenthesisificateBinaryOperatorBlock(block, Types, allowedBlockClasses, helpers.getBinaryOperatorBlockWithKeyword)
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
			const {hsBlock, addParameterWithRawValue, addParameterWithChildBlock} = externalCallbacks.createCustomBlockReferenceFrom(newBlock.value.value)
			const parameters = helpers.getParametersForCustomBlockNamed(blockName.value)
			if (!parameters)
				return hsBlock
			blockParameters = block.parameters
			if (blockParameters.length != parameters.length)
				return externalCallbacks.error(new parser.SyntaxError("Wrong amount of arguments to custom block", parameters.length, blockParameters.length, block.location))
			for (let i = 0; i < blockParameters.length; i++) {
				const template = parameters[i]
				const parameterValue = blockParameters[i]
				if (parameterValue.type != Types.parameterValue)
					return externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown parameter value type for agrument to custom block", Types.parameterValue, parameterValue.type, parameterValue.location))
				if (options.checkParameterLabels) {
					const desiredLabel = template.label
					if (parameterValue.label.type != Types.identifier)
						return externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown type for parameter value label in custom block argument", Types.identifier, parameterValue.label.type, parameterValue.label.location))
					const actualLabel = parameterValue.label.value
					if (desiredLabel != actualLabel)
						externalCallbacks.error(new parser.SyntaxError("Incorrect label for argument to custom block", desiredLabel, actualLabel, parameterValue.label.location))
				}
				const value = parameterValue.value
				switch (value.type) {
				case Types.string:
				case Types.number:
					addParameterWithRawValue(template.label, value.value, template.defaultValue)
					break
				case Types.identifier:
				case Types.binaryOperatorBlock:
				case Types.parenthesisBlock:
					const operatorBlockCreator = createBlockOfClasses.bind(null, externalCallbacks, options, value, Types, validScopes, helpers)
					const innerBlock = blockCreationFunctions.createOperatorBlockUsing(operatorBlockCreator, 57) //HSParameterType.MultiPurposeNumberDefault
					addParameterWithChildBlock(template.label, innerBlock, template.defaultValue)
					break
				default:
					externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown parameter value type", [Types.number, Types.string, Types.identifier, Types.binaryOperatorBlock, Types.parenthesisBlock], parameterValue.value.type, parameterValue.location))
				}
			}
			if (options.addBreakpointLines)
				hsBlock[BREAKPOINT_POSITION_KEY] = newBlock.location
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
		const {hsBlock} = externalCallbacks.createCustomBlockReferenceFrom(block.value.value)
		if (options.addBreakpointLines)
			hsBlock[BREAKPOINT_POSITION_KEY] = block.location
		return hsBlock
	default:
		externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown block form", [Types.comment, Types.identifier, Types.comment], block.type, block.location))
	}
	const blockType = helpers.getBlockTypeNamed(blockName)
	if (!blockType) {
		if (allowedBlockClasses.includes("operator")) {
			const desiredTypes = function() {
				if (!maybeParameterType)
					return null
				return helpers.getDataTypesForParameterType(maybeParameterType)
			}()
			return maybeCreateVariableFromUndefinedType(block, Types, helpers.getTraitTypeWithName, validScopes, blockCreationFunctions.undefinedTypeFunctions, externalCallbacks, desiredTypes, helpers.doesSceneExistWithName, helpers.getObjectTypeNamed)
		}
		blockName = blockName ?? JSON.stringify(block)
		return externalCallbacks.error(new parser.SyntaxError("Undefined block", "TODO: Object.getOwnPropertyNames(BlockTypes)", blockName, block.location))
	}
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
			const operatorBlockCreator = createBlockOfClasses.bind(null, externalCallbacks, options, parameterValue.value, Types, validScopes, helpers)
			const innerBlock = blockCreationFunctions.createOperatorBlockUsing(operatorBlockCreator, hsParameter.type)
			blockCreationFunctions.setParameterDatum(hsParameter, innerBlock)
			break
		default:
			externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown parameter value type", [Types.number, Types.string, Types.identifier, Types.binaryOperatorBlock, Types.parenthesisBlock], parameterValue.value.type, parameterValue.value.location))
		}
		blockCreationFunctions.addParameter(result, hsParameter)
	}
	if (options.addBreakpointLines)
		result[BREAKPOINT_POSITION_KEY] = block.location
	return result
}

function createEventParameterUsing(prototype) {
	// MUTATES PROTOTYPE
	prototype.id = randomUUID()
	return prototype
}

function maybeCreateVariableFromUndefinedType(block, Types, getTraitTypeWithName, validScopes, undefinedTypeFunctions, externalCallbacks, maybeDesiredTypes, doesSceneExistWithName, getObjectTypeNamed) {
	if (maybeDesiredTypes?.includes("ObjectType")) {
		let blockName;
		let blockParameters;
		switch (block.type) {
		case Types.identifier:
			blockName = block.value
			break
		case Types.parenthesisBlock:
			if (block.name.type != Types.identifier)
				externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown type for object type name in set image parameter with attributes", [Types.identifier], block.name.type, block.name.location))
			blockName = block.name.value
			blockParameters = block.parameters
			break
		default:
			externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown type for object type name in set image parameter", [Types.identifier, Types.parenthesisBlock], block.type, block.location))
		}
		const objectType = getObjectTypeNamed(blockName)
		if (!objectType)
			externalCallbacks.error(new parser.SyntaxError("Invalid object type", "TODO: Get all object types", block.value, block.location))
		let customObjectFilename;
		if (Array.isArray(blockParameters)) {
			if (blockParameters.length != 1)
				externalCallbacks.error(new parser.SyntaxError("Too many attributes in object type for set image", 1, blockParameters.length, block.location))
			const param = blockParameters[0]
			if (param.type != Types.parameterValue)
				externalCallbacks.error(new parser.SyntaxError("Uncomprehensible type for attribute in object type for set image", Types.parameterValue, param.type, param.location))
			const label = param.label
			const value = param.value
			if (label.type != Types.identifier)
				externalCallbacks.error(new parser.SyntaxError("Uncomprehensible type for attribute name in object type for set image", Types.identifier, label.type, label.location))
			if (value.type != Types.string)
				externalCallbacks.error(new parser.SyntaxError("Attributes of object types in set image blocks must be string literals", Types.string, value.type, value.location))
			switch (label.value) {
			case "file":
				customObjectFilename = value.value
				break;
			default:
				externalCallbacks.error(new parser.SyntaxError("Unknown object attribute for set image block object type", "file", label.value, label.location))
			}
		}
		return undefinedTypeFunctions.createSetImageBlockForHSObjectType(objectType.type, customObjectFilename)
	}
	switch (block.type) {
	case Types.identifier:
		const variableDescription = getVariableDescriptionFromPath(block.value, validScopes)
		if (!variableDescription)
			externalCallbacks.error(new parser.SyntaxError("Undefined symbol", ["Block", "Variable"], JSON.stringify(block), block.location))
		const maybeTraits = getTraitTypeWithName(variableDescription.name)
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
			const hsVariable = undefinedTypeFunctions.getOrAddObjectVariableNamed(variableDescription.name)
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
			const {objectDefinitionCallback, hsDatum} = undefinedTypeFunctions.createObjectVariableReferenceTo(objectHsVariable)
			variableDescription.fullScopeObject.whenDefined(objectDefinitionCallback)
			return hsDatum
		case "User":
			if (maybeTraits) {
				const trait = maybeTraits.User
				if (trait) {
					return undefinedTypeFunctions.createUserTrait(trait)
				}
			}
			const userHsVariable = undefinedTypeFunctions.getOrAddUserVariableNamed(variableDescription.name)
			return {
				type: userHsVariable.type,
				variable: userHsVariable.objectIdString,
				description: "Variable", // Correct
			}
		case "Scene":
			if (variableDescription.name == "Next")
				return undefinedTypeFunctions.createNextSceneBlock()
			if (variableDescription.name == "Previous")
				return undefinedTypeFunctions.createPreviousSceneBlock()
			if (!doesSceneExistWithName(variableDescription.name))
				externalCallbacks.error(new parser.SyntaxError("Undefined scene name", ["Next", "Previous", "TODO: get scene names"], variableDescription.name, block.location))
			return undefinedTypeFunctions.createReferenceToSceneNamed(variableDescription.name)
		default:
			externalCallbacks.error(new parser.SyntaxError("Should be impossible: Unknown variable scope", validScopes.map(e=>e.path), variableDescription.scope, block.location))
		}
		break
	case Types.parenthesisBlock:
		let blockName = block.name.value
		//Intentionally fall through
	default:
		blockName = blockName ?? JSON.stringify(block)
		externalCallbacks.error(new parser.SyntaxError("Undefined block", "TODO: Object.getOwnPropertyNames(BlockTypes)", blockName, block.location))
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

function handleCustomRule(externalCallbacks, customRule, Types, hsObjectOrCustomRule, options, validScopes, blockCreationHelpers, transitionStateIfContainerExists) {
	if (customRule.value.type != Types.identifier)
		throw "Should be impossible: Non-identifier custom rules name"
	const nameAsString = customRule.value.value
	// may not get finish
	const {hsCustomRule, beforeGameStartsAbility, finish} = externalCallbacks.handleCustomRule(nameAsString, hsObjectOrCustomRule, customRule.doesHaveContainer, (hsParametersCount, getExpectedNameForParameter, addNewParameter, createOperatorBlockUsing, addParameterWithChildBlock) => {
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
			case Types.identifier:
			case Types.binaryOperatorBlock:
			case Types.parenthesisBlock:
				const operatorBlockCreator = createBlockOfClasses.bind(null, externalCallbacks, options, parameter.value, Types, validScopes, blockCreationHelpers)
				const innerBlock = createOperatorBlockUsing(operatorBlockCreator, 57) //HSParameterType.MultiPurposeNumberDefault
				addParameterWithChildBlock(i, innerBlock)
				break
			default:
				throw new parser.SyntaxError("Should be impossible; Unknown custom rule parameter value type", [Types.string, Types.number, Types.identifier, Types.binaryOperatorBlock, Types.parenthesisBlock], parameter.value.type, parameter.value.location)
			}
		}
	})
	if (finish)
		finish()
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