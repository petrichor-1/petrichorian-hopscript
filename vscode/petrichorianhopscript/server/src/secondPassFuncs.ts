const {parenthesisificateBinaryOperatorBlock} = require("../../../../core/parenthesisificateBinaryOperatorBlock.js")
const { eventParameterPrototypeForIdentifier } = require('../../../../core/eventParameterPrototypeForIdentifier.js')
const {HSParameterType} = require("../../../../core/HSParameterType.js")

export function addHsObjectAndBeforeGameStartsAbility(objectType: any, object: any, objectAttributes: any, validScopes: any): any {
	return {hsObject: {block_class: objectType.class}, ability: [objectType,object]}
}

export function createMethodBlock(line: any, Types: any, parsed: any, validScopes: any, options: any, currentState: any): any {
	const hsBlock = createMethodBlockFrom(line.value, Types, parsed.blockTypes, parsed.binaryOperatorBlockTypes, parsed.traitTypes, validScopes, null, options)
	return hsBlock
}
let customRules: any = {}
let error: any
export function resetSecondPassFunctions(newError: any) {
	customRules = {}
	error = newError
}
export function addCustomRuleDefinition(nameAsString: any, line: any, Types: any, maybeParameters: any, transitionStateWith: any) {
	if (customRules[nameAsString])
		error({message:"Duplicate custom rule definition", expected:"", found:nameAsString, location:line.location})
	maybeParameters?.forEach((parameterValue: any) => {
		if (parameterValue.type != Types.parameterValue)
			error({message:"Should be impossible: Unknow parameter value type", expected:Types.parameterValue, found:parameterValue.type, location:parameterValue.location})
		if (parameterValue.label.type != Types.identifier)
			error({message:"Should be impossible: Unknown parameter label type", expected:Types.identifier, found:parameterValue.label.type, location:parameterValue.label.location})
	})
	customRules[nameAsString] = true
	transitionStateWith({}, {})
}

export function handleCustomRule(customRule: any, line: any, Types: any, object: any, nextStateIfContainer: any) {
	if (customRule.value.type != Types.identifier)
		error("Should be impossible: Non-identifier custom rules name")
	const nameAsString = customRule.value.value
	if (!customRule.doesHaveContainer)
		return
	addCustomRuleDefinition(nameAsString, line, Types, line.value.parameters, nextStateIfContainer)
}

export function createAbilityForRuleFrom(whenBlock: any, Types: any, parsed: any, validScopes: any, options: any, currentObject: any): any {
	createOperatorBlockFrom(whenBlock.value, Types, parsed.blockTypes, parsed.binaryOperatorBlockTypes, parsed.traitTypes, validScopes, null, options)
	currentObject.hasRules = true
	return {}
}

function createOperatorBlockFrom(block: any, Types: any, BlockTypes: any, BinaryOperatorBlockTypes: any, TraitTypes: any, validScopes: any, project: any, options: any): any {
	return createBlockOfClasses(["operator","conditionalOperator"], "params", block, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, validScopes, project, options)
}

function createMethodBlockFrom(block: any, Types: any, BlockTypes: any, BinaryOperatorBlockTypes: any, TraitTypes: any, validScopes: any, project: any, options: any): any {
	return createBlockOfClasses(["method", "control", "conditionalControl"], "parameters", block, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, validScopes, project, options)
}

function createBlockOfClasses(allowedBlockClasses: string | any[], parametersKey: string, block: { type: any; value: any; name: { type: string; value: any; location: any }; parameters: any; location: any }, Types: { binaryOperatorBlock: any; identifier: any; parenthesisBlock: any; customAbilityReference: any; comment: any; parameterValue: any; number: any; string: any }, BlockTypes: { [x: string]: any }, BinaryOperatorBlockTypes: any, TraitTypes: any, validScopes: any, project: { eventParameters: any[] }, options: { checkParameterLabels: any }) {
	const {checkParameterLabels} = options
	if (block.type == Types.binaryOperatorBlock)
		block = parenthesisificateBinaryOperatorBlock(block, Types, allowedBlockClasses, BinaryOperatorBlockTypes)
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
				error({message:"Unknown block name type", expected:Types.identifier, found:blockName.type, location:blockName.location})
			return {block_class: "control"}
		default:
			error({message:"Unknown block name type " + block.name.type, expected:[Types.identifier, Types.customAbilityReference], found:block.name.type, location:block.name.location})
		}
		break
	case Types.comment:
		return {block_class: "method"}
	case Types.binaryOperatorBlock:
		error({message:"Should be impossible: Unconverted binary operator block", expected:[],found: "", location:block.location})
	case Types.customAbilityReference:
		return {block_class: "control"}
	default:
		error({message:"Should be impossible: Unknown block form", expected:[Types.comment, Types.identifier, Types.comment], found:block.type, location:block.location})
	}
	const blockType = BlockTypes[blockName]
	if (!blockType)
		return null//createBlockFromUndefinedTypeOfClasses(allowedBlockClasses, parametersKey, block, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, project, validScopes, options)
	if (!allowedBlockClasses.includes(blockType.class.class))
		error({message:"Invalid block class", expected:allowedBlockClasses, found:blockType.class.class, location:block.location})
	const result = {block_class: blockType.class.class, type: blockType.type}
	for (let i = 0; i < blockType.parameters.length; i++) {
		const parameterSchema = blockType.parameters[i]
		if (blockParameters.length <= i)
			error({message: "Not enough parameters", expected:blockType.parameters.length, found:blockParameters.length, location:block.location})
		const parameterValue = blockParameters[i]
		if (!parameterValue.pretendLabelIsValidEvenIfItIsnt && checkParameterLabels && !(!parameterSchema.name && !parameterValue.label)) {
			const parameterLabel = parameterValue.label
			if (parameterSchema.name && !parameterLabel)
				error({message:"Missing parameter label", expected:parameterSchema.name, found:"", location:parameterValue.location})
			if (!parameterSchema.name && parameterLabel)
				error({message:"Extra parameter label", expected:"", found:parameterLabel.value, location:parameterLabel.location})
			if (parameterLabel.type != Types.identifier)
				error("Should be impossible: Unknown parameter label type")
			if (parameterLabel.value != parameterSchema.name)
				error({message:"Incorrect parameter label", expected:parameterSchema.name, found:parameterLabel.value, location:parameterLabel.location})
		}
		if (parameterValue.type != Types.parameterValue)
			error("Should be impossible: Invalid parameter value type" + parameterValue.type)
		switch (parameterValue.value.type) {
		case Types.number:
		case Types.string:
			//This branch intentionally left blank
			break
		case Types.identifier:
			if (parameterSchema.type == HSParameterType.HSObject) {
				const eventParameterPrototype = eventParameterPrototypeForIdentifier(parameterValue.value, validScopes)
				if (!eventParameterPrototype)
					error({message: "Cannot make eventParameter from this", expected: ["Screen", "Self"], found: parameterValue.value.value, location: parameterValue.location})
				break
			}
		case Types.binaryOperatorBlock:
		case Types.parenthesisBlock:
			createOperatorBlockFrom(parameterValue.value, Types, BlockTypes, BinaryOperatorBlockTypes, TraitTypes, validScopes, project, options)
			break
		default:
			error({message: "Should be impossible: Unknown parameter value type", expected:[Types.number, Types.string, Types.identifier, Types.binaryOperatorBlock, Types.parenthesisBlock], found:parameterValue.value.type, location:parameterValue.location})
		}
	}
	return result
}