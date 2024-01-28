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
				const hsBlock = createOperatorBlockFrom(whenBlock.value, Types, parsed.blockTypes, options)
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
			const hsBlock = createMethodBlockFrom(line.value, Types, parsed.blockTypes, options)
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

function createOperatorBlockFrom(block, Types, BlockTypes, options) {
	const {checkParameterLabels} = options

	let result = {
		block_class: "operator", // Not necessarily correct, but HS doesn't complain
		params: []
	}
	switch (block.type) {
	case Types.identifier:
		const blockName = block.value
		const blockType = BlockTypes[blockName]
		if (!blockType)
			throw "Undefined block type"
		if (blockType.class != "operator")
			throw "Invalid block class"
		result.type = blockType.type
		result.description = blockType.description
		if (blockType.parameters.length > 0)
			throw "Idk how to handle operators with params"
		if (result.params.length <= 0)
			result.params = undefined
		return result
	default:
		throw "Unknown block form"
	}
}

function createMethodBlockFrom(block, Types, BlockTypes, options) {
	const {checkParameterLabels} = options

	let result = {
		parameters: []
	}
	let blockName
	let blockParameters
	switch (block.type) {
	case Types.identifier:
		blockName = block.value
		blockParameters = []
		break
	case Types.parenthesisBlock:
		if (block.name.type != Types.identifier)
			throw "Unknown block name type"
		blockName = block.name.value
		blockParameters = block.parameters
		break
	default:
		throw "Unknown block form"
	}
	const blockType = BlockTypes[blockName]
	if (!blockType)
		throw "Undefined block type"
	if (blockType.class != "method" && blockType.class != "control")
		throw "Invalid block class"
	result.type = blockType.type
	result.description = blockType.description
	result.block_class = blockType.class
	for (let i = 0; i < blockType.parameters.length; i++) {
		const parameterSchema = blockType.parameters[i]
		if (blockParameters.length <= i)
			throw "Not enough parameters"
		const parameterValue = blockParameters[i]
		if (checkParameterLabels) {
			if (parameterSchema.name && !parameterValue.label)
				throw new parser.SyntaxError("Missing parameter label", parameterSchema.name, "", parameterValue.location)
			const parameterLabel = parameterValue.label
			if (!parameterSchema.name && parameterLabel)
				throw "Extra parameter label"
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
			throw "Invalid parameter value type"
		switch (parameterValue.value.type) {
		case Types.number:
		case Types.string:
			hsParameter.value = parameterValue.value.value
			break
		default:
			throw new parser.SyntaxError("Should be impossible: Unknown parameter value type", [Types.number, Types.string], parameterValue.value.type, parameterValue.location)
		}
		result.parameters.push(hsParameter)
	}
	return result
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