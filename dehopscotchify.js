#!/usr/bin/env node

const fs = require('fs')
const parser = require('./core/htn.js')

if (process.argv.length < 3)
	return console.error(`Nope! Try ${process.argv[0]} ${process.argv[1]} <file.hopscotch>`)

const prelude = fs.readFileSync(__dirname+"/core/prelude/Hopscotch.htn").toString() + "\n\n" + fs.readFileSync(__dirname+"/core/prelude/secretblocks.htn").toString()
const preludeLineCount = prelude.split("\n").length

const inputPath = process.argv[2]
const project = JSON.parse(fs.readFileSync(inputPath).toString())

const {objectTypes, blockTypes, traitTypes, binaryOperatorBlockTypes} = parser.parse(prelude)

const binaryOperatorsByBlockName = swapKeysAndValues(binaryOperatorBlockTypes)
const blockNamesByHSType = function() {
	let result = {}
	for (const name in blockTypes) {
		if (Object.hasOwnProperty.call(blockTypes, name)) {
			const typeDefinition = blockTypes[name];
			result[typeDefinition.type] = {name: name, typeDefinition: typeDefinition}
		}
	}
	return result
}()
const objectNamesByHSType = function() {
	let result = {}
	for (const name in objectTypes) {
		if (Object.hasOwnProperty.call(objectTypes, name)) {
			const typeDefinition = objectTypes[name];
			result[typeDefinition.type] = {name: name, typeDefinition: typeDefinition}
		}
	}
	return result
}()

let finalResult = ""
let currentIndentationLevel = 0
function newLine() {
	finalResult += "\n"
	for (let i = 0; i < currentIndentationLevel; i++)
		finalResult += "\t"
}
project.abilities.forEach(ability => {
	if (!ability.name || ability.name == "")
		return
	if (ability.blocks.length <= 0)
		return
	finalResult += "custom_block "
	finalResult += snakeCaseify(ability.name)
	if ((ability.parameters?.length ?? 0) > 0) {
		finalResult += "("
		finalResult += snakeCaseify(ability.parameters[0].key)
		const value = ability.parameters[0].defaultValue.replace(/"/g,'\\"')
		const needsQuotes = !/^\-?[0-9]+(e\+?[0-9]+)?(\.[0-9]+(e[\+\-]?[0-9]+)?)?$/.test(value)
		finalResult += ": "
		if (needsQuotes)
			finalResult += '"'
		finalResult += value
		if (needsQuotes)
			finalResult += '"'
		for (let i = 1; i < ability.parameters.length; i++) {
			finalResult += ", "
			finalResult += snakeCaseify(ability.parameters[i].key)
			const value = ability.parameters[i].defaultValue.replace(/"/g,'\\"')
			const needsQuotes = !/^\-?[0-9]+(e\+?[0-9]+)?(\.[0-9]+(e[\+\-]?[0-9]+)?)?$/.test(value)
			finalResult += ": "
			if (needsQuotes)
				finalResult += '"'
			finalResult += value
			if (needsQuotes)
				finalResult += '"'
		}
		finalResult += ")"
	}
	finalResult += ":"
	currentIndentationLevel++
	newLine()
	addAbility(ability)
	currentIndentationLevel--
	newLine()
})
project.customRules.forEach(customRule => {
	if (customRule.rules.length <= 0 && project.abilities.find(e=>e.abilityID==customRule.abilityID)?.blocks?.length <= 0)
		return
	finalResult += "custom_rule "
	finalResult += snakeCaseify(customRule.name)
	if ((customRule.parameters?.length ?? 0) > 0) {
		finalResult += "("
		finalResult += snakeCaseify(customRule.parameters[0].key)
		const value = customRule.parameters[0].defaultValue.replace(/"/g,'\\"')
		const needsQuotes = !/^\-?[0-9]+(e\+?[0-9]+)?(\.[0-9]+(e[\+\-]?[0-9]+)?)?$/.test(value)
		finalResult += ": "
		if (needsQuotes)
			finalResult += '"'
		finalResult += value
		if (needsQuotes)
			finalResult += '"'
		for (let i = 1; i < customRule.parameters.length; i++) {
			finalResult += ", "
			finalResult += snakeCaseify(customRule.parameters[i].key)
			const value = customRule.parameters[i].defaultValue.replace(/"/g,'\\"')
			const needsQuotes = !/^\-?[0-9]+(e\+?[0-9]+)?(\.[0-9]+(e[\+\-]?[0-9]+)?)?$/.test(value)
			finalResult += ": "
			if (needsQuotes)
				finalResult += '"'
			finalResult += value
			if (needsQuotes)
				finalResult += '"'
		}
		finalResult += ")"
	}
	finalResult += ":"
	currentIndentationLevel++
	addCustomRuleOrObject(customRule)
	currentIndentationLevel--
	newLine()
})
project.scenes.forEach(scene => {
	finalResult += "Scene " + snakeCaseify(scene.name) + ":"
	newLine()
	currentIndentationLevel++
	scene.objects.forEach(objectID => {
		const hsObject = project.objects.find(o=>o.objectID==objectID)
		if (!hsObject)
			throw `Could not find object with id ${objectID}`
		if (hsObject.rules.length <= 0 && (project.abilities.find(e=>e.abilityID==hsObject.abilityID)?.blocks?.length || 0) <= 0)
			return
		const htnObjectType = objectNamesByHSType[hsObject.type]
		if (!htnObjectType)
			throw `Undefined object type ${hsObject.type} (used by ${hsObject.name})`
		finalResult += htnObjectType.name + " "
		finalResult += snakeCaseify(hsObject.name)
		finalResult += `(x_position: ${parseFloat(hsObject.xPosition)}, y_position: ${parseFloat(hsObject.yPosition)}, resize_scale: ${parseFloat(hsObject.resizeScale)}, rotation: ${parseFloat(hsObject.rotation)}`
		if (hsObject.type == 1 && (hsObject.text?.length || 0) > 0) //HSObjectType.Text
			finalResult += `, text: "${hsObject.text.replace(/"/g,"\"")}"`
		finalResult += "):"
		currentIndentationLevel++
		addCustomRuleOrObject(hsObject)
		currentIndentationLevel--
		newLine()
	})
})
finalResult = finalResult.replace(/\n(\t+\n)+/gm,"\n")
console.log(finalResult)


function addCustomRuleOrObject(customRuleOrObject) {
	const ability = project.abilities.find(e=>e.abilityID==customRuleOrObject.abilityID)
	if (ability && ability.blocks.length > 0) {
		newLine()
		addAbility(ability)
	}
	customRuleOrObject.rules.forEach(ruleId => {
		newLine()
		const maybeCustomRuleInstance = project.customRuleInstances.find(cri=>cri.id == ruleId)
		if (maybeCustomRuleInstance)
			return addCustomRuleInstance(maybeCustomRuleInstance)
		const rule = project.rules.find(e=>e.id==ruleId)
		if (!rule)
			throw `Could not find rule with id ${ruleId} from object ${hsObject.name}`
		addRule(rule)
	})
}

function addCustomRuleInstance(customRuleInstance) {
	const customRule = project.customRules.find(e=>e.id==customRuleInstance.customRuleID)
	finalResult += "custom_rule "
	finalResult += snakeCaseify(customRule.name)
}

function addRule(rule) {
	finalResult += "When "
	addBlock(rule.parameters[0].datum, "params")
	finalResult += ":"
	currentIndentationLevel++
	newLine()
	const ability = project.abilities.find(e=>e.abilityID==rule.abilityID)
	if (!ability)
		throw "Missing ability id " + rule.abilityID
	addAbility(ability)
	currentIndentationLevel--
}

function addComment(hsBlock) {
	finalResult += "#"
	const lines = hsBlock.parameters[0].value.split("\n")
	finalResult += lines[0]
	for (let i = 1; i < lines.length; i++) {
		finalResult += "#\t"
		finalResult += lines[i]
	}
}

function addBlock(hsBlock, parametersKey) {
	if (hsBlock.type == 69) { //HSBlockTypes.Comment
		return addComment(hsBlock)
	}
	if (hsBlock.type == 123) { //HSBlockTypes.Ability
		finalResult += "custom_block "
		finalResult += snakeCaseify(hsBlock.description)
		if (hsBlock.parameters?.length > 0) {
			finalResult += "("
			hsBlock.parameters.forEach(hsParameter => {
				finalResult += snakeCaseify(hsParameter.key)
				finalResult += ": "
				addParameterValue(hsParameter)
			})
			finalResult += ")"
		}
		return
	}
	const block = blockNamesByHSType[hsBlock.type] || ((hsBlock.type == 22) ? ({typeDefinition: {parameters: []}, name: "ae"}) : console.log(hsBlock.type))
	if (!block)
		throw "Undefined block type " + hsBlock.type
	if (block.name == "set")
		return addBinaryOperator("=", hsBlock, parametersKey)
	const maybeBinaryOperator = binaryOperatorsByBlockName[block.name]
	if (maybeBinaryOperator)
		return addBinaryOperator(maybeBinaryOperator, hsBlock, parametersKey)
	finalResult += block.name
	const parametersPrototype = block.typeDefinition.parameters
	let needs_to_define_block = false
	if (parametersPrototype.length != (hsBlock[parametersKey]?.length || 0)) {
		if (hsBlock.type != 53 && hsBlock.type != 55 && hsBlock.type != 19&& hsBlock.type != 22)
			throw "Parameter length mismatch" + JSON.stringify(hsBlock) + JSON.stringify(block) + parametersPrototype.length + " " + (hsBlock[parametersKey]?.length || 0)
		if (hsBlock.type == 53)
			finalResult += "_times"
	}
	if (parametersPrototype.length == 0)
		return
	finalResult += "("
	for (let i = 0; i < parametersPrototype.length; i++) {
		if (i > 0)
			finalResult += ", "
		const parameterPrototype = parametersPrototype[i]
		if (parameterPrototype.name)
			finalResult += `${parameterPrototype.name}: `
		addParameterValue(hsBlock[parametersKey][i])
	}
	finalResult += ")"
	if (needs_to_define_block) {
		newLine()
		finalResult += '_defineBlockType method create_a_clone_of_this_object_times 53 "Create a Clone of This Object" 42 _ "times" "5", '
	}
}

function maybeBinaryOperatorFor(hsBlockType) {
	return binaryOperatorsByBlockName[blockNamesByHSType[hsBlockType]?.name]
}
function addBinaryOperator(binaryOperator, hsBlock, parametersKey) {
	const needsParentheses = (!!maybeBinaryOperatorFor(hsBlock[parametersKey][0]?.datum?.blockType || -1) || !!maybeBinaryOperatorFor(hsBlock[parametersKey][0]?.datum?.blockType || -1))
		&& binaryOperator != "^"
	if (needsParentheses)
		finalResult += "("
	addParameterValue(hsBlock[parametersKey][0])
	finalResult += ` ${binaryOperator} `
	addParameterValue(hsBlock[parametersKey][1])
	if (needsParentheses)
		finalResult += ")"
}

function addParameterValue(hsParameterValue) {
	if (hsParameterValue.datum)
		return addDatum(hsParameterValue.datum)
	if (hsParameterValue.variable)
		return addEventParameterReference(hsParameterValue.variable)
	const value = hsParameterValue.value.replace(/"/g,'\\"')
	const needsQuotes = !/^\-?[0-9]+(e\+?[0-9]+)?(\.[0-9]+(e[\+\-]?[0-9]+)?)?$/.test(value)
	if (needsQuotes)
		finalResult += '"'
	finalResult += value
	if (needsQuotes)
		finalResult += '"'
}

function addDatum(datum) {
	if (datum.variable)
		return addVariableFromDatum(datum)
	if (datum.HSTraitTypeKey)
		return addTrait(datum)
	if (["operator","conditionalOperator"].includes(datum.block_class))
		return addBlock(datum, "params")
	if (datum.type == 8009) //HSBlockType.Local
		return addLocalVariable(datum)
	if (datum.blockType >= 10001 && datum.blockType < 10003) //HSBlockType.PreviousSceneParameter and HSBlockType.HS_END_OF_SCENE_REFERENCE_BLOCKS
		return addSceneReferenceBlock(datum)
	// throw "Unknown datum type" + JSON.stringify(datum)
}

function addSceneReferenceBlock(datum) {
	switch (datum.blockType) {
	case 10002: //HSBlockType.NextSceneParameter
		finalResult += "Next_scene"
		break
	default:
		console.log(datum)
		throw "TODO"
	}
}

function addVariableFromDatum(datum) {
	const variableId = datum.variable
	const hsVariable = project.variables.find(e=>e.objectIdString == variableId)
	if (!hsVariable)
		throw `Couldn't find variable with id ${variableId}`
	const scope = function(){
		switch (datum.type) {
		case 8000: //HSBlockType.Object
			const name = project.objects.find(e=>e.objectID == datum.object)?.name
			if (!name)
				throw "Couldn't find object name for id " + datum.object
			return snakeCaseify(name)
		case 8003: //HSBlockType.Game
			return "Game"
		case 8004: //HSBlockType.Self
			return "Self"
		case 8005: //HSBlockType.OriginalObject
			return "Original_object"
		default:
			throw `Unknown variable type ${datum.type}`
		}
	}()
	finalResult += scope + "."
	finalResult += snakeCaseify(hsVariable.name)
}

function addTrait(hsTrait) {
	const scope = function() {
		switch (hsTrait.HSTraitObjectParameterTypeKey) {
		case 8003: //HSBlockType.Game
		case undefined:
			return {label:"Game", scope: "Game"}
		case 8004: //HSBlockType.Self
			return {label:"Self", scope: "Object"}
		case 8005: //HSBlockType.OriginalObject
			return {label:"Original_object", scope: "Object"}
		case 8000: //HSBlockType.Object
			return {scope: "Object", label: snakeCaseify(project.objects.find(e=>e.objectID == hsTrait.HSTraitObjectIDKey).name)}
		default:
			console.log(hsTrait)
			throw "Unknown trait scope " + hsTrait.HSTraitObjectParameterTypeKey
		}
	}()
	if (!scope.label)
		throw "Coudln't find label for trait " + JSON.stringify(hsTrait)
	finalResult += scope.label
	finalResult += "."
	const maybeElementAndKey = findInObject(traitTypes, e=>e[scope.scope]?.type == hsTrait.HSTraitTypeKey)
	if (!maybeElementAndKey)
		throw `Couldn't find trait for type ${hsTrait.HSTraitTypeKey} in scope ${scope.scope}`
	finalResult += maybeElementAndKey.key
}

function addLocalVariable(datum) {
	const name = snakeCaseify(datum.name)
	const maybeBlock = blockTypes[name]
	if (maybeBlock)
		finalResult += "Local."
	finalResult += name
}

function addAbility(hsAbility) {
	hsAbility.blocks.forEach(block => {
		addBlock(block,"parameters")
		if (block.type == 123) { //HSBlockType.ability
			return newLine()
		}
		if (block.controlScript) {
			finalResult += ":"
			currentIndentationLevel++
			newLine()
			const childAbility = project.abilities.find(e=>e.abilityID == block.controlScript.abilityID)
			if (!childAbility)
				throw `Missing ability with id ${block.controlScript.abilityID} as child of ability with id ${hsAbility.abilityID}`
			addAbility(childAbility)
			currentIndentationLevel--
		}
		if (block.controlFalseScript) {
			const childAbility = project.abilities.find(e=>e.abilityID == block.controlFalseScript.abilityID)
			if (childAbility && childAbility.blocks.length > 0) {
				newLine()
				finalResult += "else:"
				currentIndentationLevel++
				newLine()
				addAbility(childAbility)
				currentIndentationLevel--
			}
		}
		newLine()
	})
}

function addEventParameterReference(eventParameterId) {
	const eventParameter = project.eventParameters.find(e=>e.id==eventParameterId)
	if (!eventParameter)
		throw `Couldn't find eventParameter with id ${eventParameter} – if it is a variable or a trait, use a datum. This behavior differs from Hopscotch`
	switch (eventParameter.blockType) {
	case 8003: //HSBlockType.Game
		finalResult += "Screen"
		break
	case 8004:
		finalResult += "Self"
		break
	default:
		throw "Unknown event parameter type " + eventParameter.blockType
	}
}

function swapKeysAndValues(obj) {
	let result = {}
	for (const oldKey in obj) {
		if (Object.hasOwnProperty.call(obj, oldKey)) {
			const oldValue = obj[oldKey];
			result[oldValue] = oldKey
		}
	}
	return result
}

function snakeCaseify(string) {
	console.log(string)
	const possibleResult = string.split(" ")
		.map(e=>e[0].toLowerCase()+e.substring(1,e.length))
		.join("_")
		.replace(/[\t\n #\(\)=\",\/\[\]:]/g,"disallowed")
	if (/^[_\-0-9]/.test(possibleResult))
		return "disallowed_" + possibleResult
	return possibleResult
}

function findInObject(object, predicate) {
	for (const key in object) {
		if (Object.hasOwnProperty.call(object, key)) {
			const element = object[key];
			if (predicate(element, key))
				return {element: element, key: key}
		}
	}
	return null
}