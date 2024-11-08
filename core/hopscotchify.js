const { randomUUID } = require('crypto')
const {secondPass} = require('./secondPass.js')
const {HSParameterType} = require('./HSParameterType.js')
const {mergeHspreLikes} = require('./mergeHspreLikes.js')
const path = require("path")
const sizeOf = require("image-size")

const BREAKPOINT_POSITION_KEY = "PETRICHOR_BREAKPOINT_POSITION"

const MagicBlockTypes = {
	event: -10140000,
	whileHack: -1014010,
}

module.exports.hopscotchify = (htnPath, options, fileFunctions, alreadyParsedPaths) => {
	const project = {
		stageSize: {
			width: 1024,
			height: 768,
		},
		playerVersion: "2.2.3",
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
		scenes: [],
		sceneReferences: [],
	}

	const customObjectPaths = []

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
	function findSceneWithName(name) {
		return project.scenes.find(s=>s.name==name)
	}
	let sceneDefinitionCallbacks = {}
	function whenSceneIsDefinedWithName(name, callback) {
		const extant = findSceneWithName(name)
		if (extant)
			return callback(extant)
		sceneDefinitionCallbacks[name] = sceneDefinitionCallbacks[name] || []
		sceneDefinitionCallbacks[name].push(callback)
	}
	const htnCode = fileFunctions.read(htnPath)
	let objectTypes;
	let blockTypes;
	let traitTypes;
	let binaryOperatorBlockTypes;
	let objectNames;
	let parameterTypes;
	let sceneNames;
	let definedCustomBlocks;
	let parsed;
	const hopscotchified = secondPass(htnPath, htnCode, options, project.stageSize, {
		handleDependency: path => {
			const hspreLikeAndOtherInfo = function() {
				if (alreadyParsedPaths[path])
					return alreadyParsedPaths[path]
				const hspreLikeAndOtherInfo = fileFunctions.getHspreLikeFrom(path, alreadyParsedPaths)
				alreadyParsedPaths[path] = hspreLikeAndOtherInfo
				mergeHspreLikes(project, hspreLikeAndOtherInfo.hspreLike)
				return hspreLikeAndOtherInfo
			}()
			hspreLikeAndOtherInfo.hspreLike.customRules?.forEach(hsCustomRule => {
				const name = hsCustomRule.name
				customRuleDefinitionCallbacks[name]?.forEach(callback => callback(hsCustomRule))
				customRuleDefinitionCallbacks[name] = null
				customRules[name] = hsCustomRule
			})
			hspreLikeAndOtherInfo.hspreLike.abilities?.filter(e=>!!e.name).forEach(hsCustomBlock => {
				const name = hsCustomBlock.name
				customBlockDefinitionCallbacks[name]?.forEach(callback => callback(hsCustomBlock))
				customBlockDefinitionCallbacks[name] = null
				customBlocks[name] = hsCustomBlock
			})
			if (hspreLikeAndOtherInfo.hspreLike.requires_beta_editor !== undefined)
				project.requires_beta_editor = hspreLikeAndOtherInfo.hspreLike.requires_beta_editor
			hspreLikeAndOtherInfo.customObjectPaths?.forEach(path => {
				customObjectPaths.push(path)
			})
			return hspreLikeAndOtherInfo
		},
		customBlockAbilityFunctions: makeCustomBlockAbilityFunctions(),
		createHsCommentFrom: createHsCommentFrom,
		createCustomBlockReferenceFrom: createCustomBlockReferenceFrom,
		error: (e)=>{throw e},
		addHsObjectAndBeforeGameStartsAbility: addHsObjectAndBeforeGameStartsAbility,
		addCustomRuleDefinitionAndReturnParameterly: addCustomRuleDefinitionAndReturnParameterly,
		createElseAbilityFor: createElseAbilityFor,
		createMethodBlock: createMethodBlock,
		createAbilityAsControlScriptOf: createAbilityAsControlScriptOf,
		createAbilityForRuleFrom: createAbilityForRuleFrom,
		rulesCountForObject: o=>o.rules.length,
		hasUndefinedCustomRules: hasUndefinedCustomRules,
		hasUndefinedCustomBlocks: hasUndefinedCustomBlocks,
		returnValue: ()=>project,
		handleCustomRule: handleCustomRule.bind(null, project),
		transformParsed: tparsed => {
			objectTypes = tparsed.objectTypes
			blockTypes = tparsed.blockTypes
			traitTypes = tparsed.traitTypes
			binaryOperatorBlockTypes = tparsed.binaryOperatorBlockTypes
			objectNames = tparsed.objectNames
			parameterTypes = tparsed.parameterTypes
			sceneNames = tparsed.sceneNames
			definedCustomBlocks = tparsed.definedCustomBlocks
			parsed = tparsed
			return tparsed
		},
		linely:  ()=>{},
		isThereAlreadyADefinedCustomRuleNamed: isThereAlreadyADefinedCustomRuleNamed,
		setRequiresBetaEditor: (value)=>{project.requires_beta_editor = value},
		createSceneNamed: createScene.bind(null, project, findSceneWithName, sceneDefinitionCallbacks),
	})
	// Apply while loop hack
	// Will replace every "while" block in the project with a recursive check once if block
	// Spooky
	hopscotchified.abilities.forEach(ability => {
		ability.blocks.map(block => {
			if (block.type != MagicBlockTypes.whileHack)
				return block
			block.type = 122 //HSBlockType.CheckOnceIf
			block.description = "Check Once If"
			hopscotchified.abilities.find(a=>a.abilityID==block.controlScript.abilityID).blocks.push(block)
			return block
		})
	})
	// End while loop application
	return {
		hopscotchified,
		objectTypes,
		blockTypes,
		traitTypes,
		binaryOperatorBlockTypes,
		objectNames,
		parameterTypes,
		sceneNames,
		definedCustomBlocks,
		parsed,
		customObjectPaths,
	}
	function createElseAbilityFor(checkIfElseBlock) {
		const elseAbility = createEmptyAbility()
		project.abilities.push(elseAbility)
		checkIfElseBlock.controlFalseScript = { abilityID: elseAbility.abilityID }
		return elseAbility
	}
	function createMethodBlock(createBlockOfClasses, ability) {
		const hsBlock = createMethodBlockFrom(project, whenSceneIsDefinedWithName, htnPath, fileFunctions, customObjectPaths, createBlockOfClasses)
		ability.blocks.push(hsBlock)
		if (hsBlock.type == 123) { //HSBlockType.ability
			onDefinitionOfCustomBlockNamed(hsBlock.description, hsAbility => {
				hsBlock.controlScript.abilityID = hsAbility.abilityID
			})
		}
		return hsBlock
	}
	// Returns hsCustomRule, beforeGameStartsAbility
	function handleCustomRule(project, nameAsString, hsObjectOrCustomRule, hasContainer, callbackForWhenRuleIsDefined) {
		const rulesList = hsObjectOrCustomRule.rules
		const tempid = "TEMP" + randomUUID()
		rulesList.push(tempid)
		onDefinitionOfCustomRuleNamed(unSnakeCase(nameAsString), hsCustomRule => {
			const hsCustomRuleInstance = createCustomRuleInstanceFor(project, whenSceneIsDefinedWithName, hsCustomRule, callbackForWhenRuleIsDefined, htnPath, fileFunctions, customObjectPaths)
			project.customRuleInstances.push(hsCustomRuleInstance)
			const index = rulesList.findIndex(e => e == tempid)
			if (index < 0)
				throw "Should be imposssible: Placeholder rule removed"
			rulesList[index] = hsCustomRuleInstance.id
		})
		if (!hasContainer)
			return {hsCustomRule: null, beforeGameStartsAbility: null}
		return addCustomRuleDefinitionAndReturnParameterly(nameAsString)
	}
	function addHsObjectAndBeforeGameStartsAbility(objectType, desiredObjectName, objectAttributes, scene) {
		const hsObject = deepCopy(objectType)
		hsObject.name = unSnakeCase(desiredObjectName)
		hsObject.rules = []
		hsObject.objectID = randomUUID()
		hsObject.xPosition = objectAttributes.xPosition.toString()
		hsObject.yPosition = objectAttributes.yPosition.toString()
		hsObject.resizeScale = objectAttributes.resizeScale.toString()
		hsObject.rotation = objectAttributes.rotation.toString()
		hsObject.text = "" //NEEDED
		if (objectAttributes.text) {
			hsObject.text = objectAttributes.text
		}
		if (objectAttributes.customImageFilename) {
			const imagePath = path.resolve(path.dirname(htnPath), objectAttributes.customImageFilename)
			const customObject = getOrAddcustomObjectWithPath(project, imagePath, hsObject.name, fileFunctions, customObjectPaths)
			hsObject.customObjectID = customObject.id
			hsObject.width = customObject.size.width
			hsObject.height = customObject.size.height
		}
		const ability = createEmptyAbility()
		project.abilities.push(ability)
		hsObject.abilityID = ability.abilityID
		project.objects.push(hsObject)
		scene.objects.push(hsObject.objectID)
		return { hsObject, ability }
	}
	function hasUndefinedCustomBlocks() {
		const undefinedCustomBlockNames = Object.getOwnPropertyNames(customBlockDefinitionCallbacks).filter(e => !!customBlockDefinitionCallbacks[e])
		const hasUndefinedCustomBlocks = undefinedCustomBlockNames.length > 0
		if (hasUndefinedCustomBlocks)
			console.log(undefinedCustomBlockNames)
		return hasUndefinedCustomBlocks
	}
	
	function hasUndefinedCustomRules() {
		const undefinedCustomRuleNames = Object.getOwnPropertyNames(customRuleDefinitionCallbacks).filter(e => !!customRuleDefinitionCallbacks[e])
		const hasUndefinedCustomRules = undefinedCustomRuleNames.length > 0
		if (hasUndefinedCustomRules)
			console.log(undefinedCustomRuleNames)
		return hasUndefinedCustomRules
	}
	function isThereAlreadyADefinedCustomRuleNamed(nameAsString) {
		return !!customRules[nameAsString]
	}
	function addCustomRuleDefinitionAndReturnParameterly(nameAsString) {
		nameAsString = unSnakeCase(nameAsString)
		const beforeGameStartsAbility = createEmptyAbility()
		project.abilities.push(beforeGameStartsAbility)
		const hsCustomRule = {
			id: randomUUID(),
			abilityID: beforeGameStartsAbility.abilityID,
			name: nameAsString,
			parameters: [], //TODO
			rules: []
		}
		project.customRules.push(hsCustomRule)
		return {
			parameterly: (key, parameterValue) => {
				const parameter = {}
				parameter.key = unSnakeCase(key)
				parameter.defaultValue = parameterValue
				parameter.value = parameterValue
				hsCustomRule.parameters.push(parameter)
			},
			hsCustomRule: hsCustomRule,
			beforeGameStartsAbility: beforeGameStartsAbility,
			finish: () => {
				customRuleDefinitionCallbacks[nameAsString]?.forEach(callback => callback(hsCustomRule))
				customRuleDefinitionCallbacks[nameAsString] = null
				customRules[nameAsString] = hsCustomRule
			}
		}
	}

	function createAbilityForRuleFrom(createBlockOfClasses, currentObject) {
		const hsBlock = createOperatorBlockFrom(project,whenSceneIsDefinedWithName, htnPath, fileFunctions, customObjectPaths, createBlockOfClasses, MagicBlockTypes.event)
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

	function makeCustomBlockAbilityFunctions() {
		return {
			begin: () => {
				const customBlockAbility = createEmptyAbility()
				customBlockAbility.parameters = []
				return customBlockAbility
			},
			addParameter: (customBlockAbility, key, value) => {
				const hsParameter = {
					type: 57, //constant
					defaultValue: value,
					value: value,
					key: key
				}
				customBlockAbility.parameters.push(hsParameter)
			},
			finish: (customBlockAbility, name) => {
				project.abilities.push(customBlockAbility)
				customBlockDefinitionCallbacks[name]?.forEach(callback => {
					callback(customBlockAbility)
				})
				customBlockDefinitionCallbacks[name] = null
				customBlocks[name] = customBlockAbility
				customBlockAbility.name = name
			}
		}
	}
}

function deepCopy(object) {
	return JSON.parse(JSON.stringify(object))
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

function createBlockCreationFunctionsFor(project, parametersKey, whenSceneIsDefinedWithName, htnPath, fileFunctions, customObjectPaths) {
	return {
		begin: (parametersKey => {
			const result = {}
			result[parametersKey] = []
			return result
		}).bind(null,parametersKey),
		setType: (result, hsBlockType, description, blockClass) => {
			result.type = hsBlockType
			result.description = description
			result.block_class = blockClass
		},
		createParameter: (defaultValue, key, type) => {
			return {
				defaultValue: defaultValue,
				key: key,
				type: type
			}
		},
		setParameterValue: (hsParameter, value) => {
			hsParameter.value = value
		},
		isObjectParameterType: (hsParameter => hsParameter.type == HSParameterType.HSObject),
		setParameterVariable: ((hsParameter, toId) => hsParameter.variable = toId),
		addEventParameter: ((project, hsEventParameter) => project.eventParameters.push(hsEventParameter)).bind(null, project),
		setParameterDatum: ((hsParameter, innerBlock) => hsParameter.datum = innerBlock),
		addParameter: ((parametersKey, result, hsParameter) => result[parametersKey].push(hsParameter)).bind(null, parametersKey),
		createOperatorBlockUsing: createOperatorBlockFrom.bind(null,project, whenSceneIsDefinedWithName, htnPath, fileFunctions, customObjectPaths),
		undefinedTypeFunctions: {
			getOrAddObjectVariableNamed: getOrAddObjectVariableNamed.bind(null,project),
			createSelfTrait: createSelfTrait,
			createGameTrait: createGameTrait,
			createUserTrait: createUserTrait,
			getOrAddGameVariableNamed: getOrAddGameVariableNamed.bind(null,project),
			getOrAddUserVariableNamed: getOrAddUserVariableNamed.bind(null,project),
			createLocalVariableNamed: createLocalVariableNamed,
			createOriginalObjectTrait: createOriginalObjectTrait,
			createObjectTrait: createObjectTrait,
			setObjectTraitObjectToReferTo: ((hsTrait, hsObject) => hsTrait.HSTraitObjectIDKey = hsObject.objectID),
			createObjectVariableReferenceTo: (hsVariable => {
				const hsDatum = {
					type: 8000, //HSBlockType.Object
					variable: hsVariable.objectIdString,
					description: "Variable", // Correct
					object: "PETRICHOR__TEMPOBJECTID"
				}
				return {objectDefinitionCallback: hsObject => {hsDatum.object = hsObject.objectID}, hsDatum}
			}),
			createNextSceneBlock: createNextSceneBlock,
			createPreviousSceneBlock: createPreviousSceneBlock,
			createReferenceToSceneNamed: createReferenceToSceneNamed.bind(null, project, whenSceneIsDefinedWithName),
			createSetImageBlockForHSObjectType: createSetImageBlockForHSObjectType.bind(null, project, htnPath, fileFunctions, customObjectPaths),
		}
	}
}

function createOperatorBlockFrom(project, whenSceneIsDefinedWithName, htnPath, fileFunctions, customObjectPaths, createBlockOfClasses, parameterType) {
	const blockCreationFunctions = createBlockCreationFunctionsFor(project, "params", whenSceneIsDefinedWithName, htnPath, fileFunctions, customObjectPaths)
	return createBlockOfClasses(["operator","conditionalOperator"], blockCreationFunctions, parameterType)
}

function createMethodBlockFrom(project, whenSceneIsDefinedWithName, htnPath, fileFunctions, customObjectPaths, createBlockOfClasses) {
	const blockCreationFunctions = createBlockCreationFunctionsFor(project, "parameters", whenSceneIsDefinedWithName, htnPath, fileFunctions, customObjectPaths)
	return createBlockOfClasses(["method", "control", "conditionalControl"], blockCreationFunctions, null)
}

function createCustomBlockReferenceFrom(snakeCaseName) {
	const name = unSnakeCase(snakeCaseName)
	const hsBlock = {
		block_class: "control",
		type: 123, //HSBlockType.Ability
		description: name,
		controlScript: {
			abilityID: "PETRICHOR__TEMP"
		},
		parameters: [],
	}
	return {
		hsBlock,
		addParameterWithRawValue: (key, value, defaultValue) => {
			hsBlock.parameters.push({
				defaultValue, value,
				key: unSnakeCase(key),
				type: 57, //HSParameterType.MultiPurposeNumberDefault
			})
		},
		addParameterWithChildBlock: (key, value, defaultValue) => {
			hsBlock.parameters.push({
				defaultValue,
				key: unSnakeCase(key),
				type: 57, //HSParameterType.MultiPurposeNumberDefault
				value: "",
				datum: value
			})
		}
	}
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

function createUserTrait(trait) {
	return {
		HSTraitObjectParameterTypeKey: 8007, //HSBlockType.User
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

function createLocalVariableNamed(snakeCaseName) {
	const name = unSnakeCase(snakeCaseName)
	return {
		name: name,
		type: 8009, //HSBlockType.Local
		description: "Local Variable" //Constant
	}
}

function getOrAddObjectVariableNamed(project, name) {
	const hsName = unSnakeCase(name)
	const maybeExistingVariable = project.variables.find(variable=>variable.name == hsName && variable.type == 8000) // 8000 = HSBlockType.Object
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

function getOrAddUserVariableNamed(project, name) {
	const hsName = unSnakeCase(name)
	const maybeExistingVariable = project.variables.find(variable=>variable.name == hsName && variable.type == 8008) // 8007 = HSBlockType.User
	if (maybeExistingVariable)
		return maybeExistingVariable
	const hsVariable = {
		name: hsName,
		type: 8007, //HSBlockType.User
		objectIdString: `phnuv${hsName}`
	}
	project.variables.push(hsVariable)
	return hsVariable
}

function getOrAddGameVariableNamed(project, name) {
	const hsName = unSnakeCase(name)
	const maybeExistingVariable = project.variables.find(variable=>variable.name == hsName && variable.type == 8003) // 8003 = HSBlockType.Game
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

function createHsCommentFrom(comment, addBreakpointLines) {
	const result = {
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
	if (addBreakpointLines)
		result[BREAKPOINT_POSITION_KEY] = comment.location
	return result
}

function createCustomRuleInstanceFor(project, whenSceneIsDefinedWithName, hsCustomRule, callbackForWhenRuleIsDefined, htnPath, fileFunctions, customObjectPaths) {
	const result = {
		id: randomUUID(),
		customRuleID: hsCustomRule.id,
		parameters: []
	}
	callbackForWhenRuleIsDefined(hsCustomRule.parameters.length, (i) => {
		const hsParameter = hsCustomRule.parameters[i]
		return hsParameter.key
	}, (i, value) => {
		const hsParameter = hsCustomRule.parameters[i]
		const newHsParameter = deepCopy(hsParameter)
		newHsParameter.value = value
		result.parameters.push(newHsParameter)
	}, createOperatorBlockFrom.bind(null,project, whenSceneIsDefinedWithName, htnPath, fileFunctions, customObjectPaths),
	(i, childBlock) => {
		const hsParameter = hsCustomRule.parameters[i]
		const newHsParameter = deepCopy(hsParameter)
		newHsParameter.value = newHsParameter.defaultValue
		newHsParameter.datum = childBlock
		result.parameters.push(newHsParameter)
	})
	return result
}

function createScene(project, findSceneWithName, sceneDefinitionCallbacks, sceneName) {
	const extant = findSceneWithName(unSnakeCase(sceneName))
	if (extant)
		return extant
	const hsScene = {
		name: unSnakeCase(sceneName),
		objects: [],
		id: UUIDforName(sceneName),
	}
	project.scenes.push(hsScene)
	sceneDefinitionCallbacks[hsScene.name]?.forEach(f=>f(hsScene))
	return hsScene
}

function createNextSceneBlock() {
	return {
		blockType: 10002, //HSBlockType.NextSceneParameter
		description: "Next Scene",
		id: randomUUID(), //TODO: Figure out what this is used for and if this is the correct value
	}
}

function createPreviousSceneBlock() {
	return {
		blockType: 10001, //HSBlockType.PreviousSceneParameter
		description: "Previous Scene",
		id: randomUUID(), //TODO: Figure out what this is used for and if this is the correct value
	}
}

function createReferenceToSceneNamed(project, whenSceneIsDefinedWithName, name) {
	const hsName = unSnakeCase(name)
	const hsBlock = {
		blockType: 10000, //HSBlockType.SceneReferenceBlock
		description: "Scene",
		id: randomUUID(), //TODO: Figure out what this is used for and if this is the correct value
		scene: UUIDforName(hsName) //"PETRICHOR__PLACEHOLDER__jsdjsfsjajhs if this is still in the final project that is a bug",
	}
	project.sceneReferences.push(hsBlock)
	//TODO: Do this right, don't rely on knowing the scene's id here.
	// whenSceneIsDefinedWithName(hsName, hsScene => {
	// 	hsBlock.scene = hsScene.id
	// })
	return hsBlock
}

function createSetImageBlockForHSObjectType(project, htnPath, fileFunctions, customObjectPaths, type, customObjectFilename) {
	const result = {
		type: type,
		name: "", // Both of these should be empty strings
		description: "",
	}
	if (customObjectFilename) {
		const imagePath = path.resolve(path.dirname(htnPath), customObjectFilename)
		const customObject = getOrAddcustomObjectWithPath(project, imagePath, `Image ${randomUUID()}`, fileFunctions, customObjectPaths)
		result.customObject = customObject.id
	}
	return result
}

function UUIDforName(name) {
	// TODO: Better fromat
	// or... even better, don't use this at all.
	return name
}

function getOrAddcustomObjectWithPath(project, customObjectAbsolutePath, nameIfCreating, fileFunctions, customObjectPaths) {
	// FIXME: Duplicate basenames would be seen as the same.
	//        is that acceptable?
	const fileName = path.basename(customObjectAbsolutePath)
	for (const customObjectIndex in project.customObjects) {
		const customObject = project.customObjects[customObjectIndex]
		if (customObject.fileName == fileName)
			return customObject
	}
	const stats = fileFunctions.stat(customObjectAbsolutePath)
	// const buffer = Buffer.from(fileFunctions.read(customObjectFilename), "utf-8")
	//TODO: Properly read this through fileFunctions
	const {width, height} = sizeOf(customObjectAbsolutePath)
	createdDate = stats.birthtime.toISOString()
	updatedDate = stats.mtime.toISOString()
	const customObject = {
		createdDate,
		updatedDate,
		name: nameIfCreating,
		id: randomUUID(),
		fileName,
		size: {
			width,
			height
		}
	}
	project.customObjects.push(customObject)
	customObjectPaths.push(customObjectAbsolutePath)
	return customObject
}