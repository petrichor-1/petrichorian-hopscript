const parser = require("./htn.js")
const { randomUUID } = require('crypto')

module.exports.hopscotchify = (htnCode, options) => {
	const parsed = parser.parse(htnCode)
	const lines = parsed.lines
	const Types = parsed.tokenTypes

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
		scenes: [
			{
				name: "Scene 1",
				objects: [],
			},
		],
	}

	let indentationType;
	let indentationLevelWhitespaceCount;
	let currentIndendationLevel = 0

	let currentObject
	let abilityStack = []

	const States = {
		topLevel: 0,
		inObject: 1,
		inAbility: 2,
	}
	let currentState = States.topLevel
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
			switch (currentState) {
			case States.inAbility:
				abilityStack.pop()
				if (abilityStack.length <= 0)
					currentState = States.inObject //FIXME: Not necessarily true
				break
			case States.inObject:
				currentState = States.topLevel
				break
			default:
				throw "Unexitable state"
			}
		}
		switch (currentState) {
		case States.topLevel:
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
				if (object.name.type != "string")
					throw "Invalid object name type"
				hsObject.name = object.name.value
				hsObject.rules = []
				hsObject.objectID = randomUUID()
				hsObject.xPosition = "150"
				hsObject.yPosition = "150"
				hsObject.abilityID = ""
				project.objects.push(hsObject)
				project.scenes[0].objects.push(hsObject.objectID)
				currentState = States.inObject
				currentObject = hsObject
				break
			case Types.comment:
				// This branch intentionally left blank
				break
			default:
				throw "Bad top level type"
			}
			break
		case States.inObject:
			switch (line.value.type) {
			case Types.whenBlock:
				const whenBlock = line.value
				if (!whenBlock.doesHaveContainer)
					throw "Empty rule"
				const hsBlock = createOperatorBlockFrom(whenBlock.value, Types, parsed.blockTypes, parsed.binaryOperatorBlockTypes, parsed.traitTypes, options)
				const rule = createRuleWith(hsBlock)
				currentObject.rules.push(rule.id)
				project.rules.push(rule)
				const ability = createEmptyAbility()
				rule.abilityID = ability.abilityID
				project.abilities.push(ability)
				abilityStack.push(ability)
				currentState = States.inAbility
				break
			default:
				throw "Bad object level type"
			}
			break
		case States.inAbility:
			const hsBlock = createMethodBlockFrom(line.value, Types, parsed.blockTypes, parsed.binaryOperatorBlockTypes, parsed.traitTypes, options)
			abilityStack[abilityStack.length-1].blocks.push(hsBlock)
			if (hsBlock.block_class == "control") {
				if (!line.value.doesHaveContainer)
					throw "Empty control block"
				const ability = createEmptyAbility()
				hsBlock.controlScript = {abilityID: ability.abilityID}
				project.abilities.push(ability)
				abilityStack.push(ability)
			}
			break
		default:
			throw "Unknown state"
		}
		currentIndendationLevel = newIndentationLevel
	}
	return project
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

function createOperatorBlockFrom(block, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, options) {
	return createBlockOfClasses(["operator","conditionalOperator"], "params", block, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, options)
}

function createMethodBlockFrom(block, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, options) {
	return createBlockOfClasses(["method", "control", "conditionalControl"], "parameters", block, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, options)
}

function createBlockOfClasses(allowedBlockClasses, parametersKey, block, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, options) {
	const {checkParameterLabels} = options
	if (block.type == Types.binaryOperatorBlock)
		block = parenthesisificateBinaryOperatorBlock(block, Types, BlockTypes, BinaryOperatorBlockTypes)

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
		if (block.name.type != Types.identifier)
			throw "Unknown block name type " + block.name.type
		blockName = block.name.value
		blockParameters = block.parameters
		break
	case Types.comment:
		return createHsCommentFrom(block)
	case Types.binaryOperatorBlock:
		throw new parser.SyntaxError("Should be impossible: Unconverted binary operator block", [], "", block.location)
	default:
		throw "Unknown block form"
	}
	const blockType = BlockTypes[blockName]
	if (!blockType)
		return createBlockFromUndefinedTypeOfClasses(allowedBlockClasses, parametersKey, block, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, options)
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
				throw "Incorrect parameter label"
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
		case Types.binaryOperatorBlock:
		case Types.parenthesisBlock:
			hsParameter.datum = createOperatorBlockFrom(parameterValue.value, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, options)
			break
		default:
			throw new parser.SyntaxError("Should be impossible: Unknown parameter value type", [Types.number, Types.string, Types.identifier, Types.binaryOperatorBlock, Types.parenthesisBlock], parameterValue.value.type, parameterValue.location)
		}
		result[parametersKey].push(hsParameter)
	}
	return result
}

function parenthesisificateBinaryOperatorBlock(binaryOperatorBlock, Types, BlockTypes, BinaryOperatorBlockTypes) {
	const actualBlockName = BinaryOperatorBlockTypes[binaryOperatorBlock.operatorKeyword]
	if (!actualBlockName)
		throw new parser.SyntaxError("Undefined binary operator", Object.getOwnPropertyNames(BinaryOperatorBlockTypes), binaryOperatorBlock.operatorKeyword, binaryOperatorBlock.location)

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
	case "-":
	case "+":
		return 0
	case "/":
	case "*":
		return 1
	case "^":
		return 2
	case "==":
	case "=":
	case "MATCHES":
		return 3
	default:
		throw `Should be impossible: Unknown binary operator keyword '${operator}'`
	}
}

function createBlockFromUndefinedTypeOfClasses(allowedBlockClasses, parametersKey, block, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, options) {
	switch (block.type) {
	case Types.identifier:
		const variableDescription = getVariableDescriptionFromPath(block.value)
		if (!variableDescription)
			throw new parser.SyntaxError("Undefined symbol", ["Block", "Variable"], JSON.stringify(block), block.location)
		const maybeTrait = TraitTypes[variableDescription.name]
		switch (variableDescription.scope) {
		case "original_object":
			if (maybeTrait)
				return createOriginalObjectTrait(maybeTrait)
			throw new parser.SyntaxError("Should be impossible: Unhandled original object scope", [], "", block.location)
		case "self":
			if (maybeTrait)
				return createSelfTrait(maybeTrait)
			throw new parser.SyntaxError("Should be impossible: Unhandled self scope", [], "", block.location)
		default:
			throw new parser.SyntaxError("Should be impossible: Unknown variable scope", ["original_object", "self"], variableDescription.scope, block.location)
		}
		break
	default:
		throw new parser.SyntaxError("Should be impossible: Unknown block form", [Types.identifier],block.type,block.location)
	}
}

function getVariableDescriptionFromPath(variablePath) {
	const fullVariablePath = variablePath.split('.')
	if (fullVariablePath.length == 1)
		return {scope: "local", name:fullVariablePath[0]}
	// Determine which scope this refers to
	// TODO: Pass this in from elsewhere and get a list of objects that are defined in the htn
	const validObjects = [{path: "self", scope: "self"}, {path: "original_object", scope: "original_object"}, {path: "game", scope: "game"}, {path: "user", scope: "user"}, {path: "local", scope: "local"}]
	for (let i = 0; i < validObjects.length; i++) {
		const objectPath = validObjects[i].path.split('.')
		if (arrayStartsWith(fullVariablePath, objectPath))
			return {scope: validObjects[i].scope, name: fullVariablePath.slice(objectPath.length).join('.')}
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

function createRuleWith(hsBlock) {
	if (hsBlock.block_class != "operator")
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