{
	const Types = {
		number: "Number",
		parenthesisBlock: "parenthesisBlock",
		parameterValue: "parameterValue",
		identifier: "identifier",
		binaryOperatorBlock: "binaryOperatorBlock",
		string: "string",
		line: "line",
		comment: "comment",
		squareBracketsBlock: "squareBracketsBlock",
		customAbilityReference: "customAbilityReference",
		whenBlock: "whenBlock",
		object: "object",
		customRule: "custom_rule",
		scene: "scene",
	}
	let objectTypes = {}
	let blockTypes = {}
	let binaryOperatorBlockTypes = {}
	let traitTypes = {}
	let objectNames = []
	let sceneNames = []
	let parameterTypes = {}
	let dependencies = ["Hopscotch.htn"] // Hopscotch.htn is implicitly imported
	let userVariablesEnabled = false
	let requiresBetaEditor
	let definedCustomBlocks = {}
}

file
	= mainLines:line* lastLine:lineContents? whitespace*
	{
		return {
			tokenTypes: Types,
			lines: [mainLines,[lastLine]].flatMap(e=>e).filter(e=>e),
			objectTypes: objectTypes,
			blockTypes: blockTypes,
			traitTypes: traitTypes,
			binaryOperatorBlockTypes: binaryOperatorBlockTypes,
			objectNames: objectNames,
			parameterTypes: parameterTypes,
			dependencies: dependencies,
			userVariablesEnabled: userVariablesEnabled,
			requiresBetaEditor: requiresBetaEditor,
			sceneNames: sceneNames,
			definedCustomBlocks: definedCustomBlocks,
		}
	}

line
	= contents:lineContents endOfLine+
	{
		if (!contents)
			return null
		return contents
	}
lineContents
	= indentationWhitespace:nonNewlineWhitespace* block:(binaryOperatorWhenBlock / scene / importStatement / object / singleArgumentNakedBlock / block / internalDefinition)
	{
		if (!block)
			return null
		return {
			type: Types.line,
			location: location(),
			indentationWhitespace: indentationWhitespace,
			value: block
		}
	}
endOfLine "End of line"
	= nonNewlineWhitespace* "\n"

block "Block"
	= block:actualBlock container:blockContainer?
	{
		block.doesHaveContainer = block.doesHaveContainer || !!container
		if (block.doesHaveContainer) {
			if (block.type == Types.customAbilityReference)
				definedCustomBlocks[block.value.value.value] = []
			if (block.name?.type == Types.customAbilityReference)
				definedCustomBlocks[block.name.value.value] = block.parameters.map(parameterValue => {
					return {
						label: parameterValue.label.value,
						defaultValue: parameterValue.value.value
					}
				})
		}
		return block
	}
	/ "(" block:actualBlock ")"
	{ return block }
actualBlock
	= binaryOperatorBlock
	/ nonBinaryOperatorBlock

nonBinaryOperatorBlock "Non-binary-operator block"
	= parenthesisBlock
	/ squareBracketsBlock
	/ blockName
	/ comment
blockContainer
	= whitespace* ":"

binaryOperatorBlock "Binary operator block"
	= leftSide:binaryOperatorBlockInitialValue whitespace* type:binaryOperatorKeyword /*parameters:(unlabeledParameterValue  whitespace* ",")**/ finalParameter:unlabeledParameterValue
	{
		const result = {
			type: Types.binaryOperatorBlock,
			location: location(),
			leftSide: leftSide,
			rightSide: [finalParameter], //[parameters.map(e=>e[0]),finalParameter].flatMap(e=>e),
			operatorKeyword: type
		}
		if (finalParameter.value.doesHaveContainer)
			result.doesHaveContainer = true // Propagate doesHaveContainer to myself
		return result
	}
binaryOperatorKeyword
	= "=="
	/ "="
	/ "MATCHES"
	/ "-"
	/ "/"
	/ "*"
	/ "+"
	/ "^"
	/ "!="
	/ "<="
	/ ">="
	/ "<"
	/ ">"
	/ "and "
	/ "or "
	/ "%"

binaryOperatorBlockInitialValue
= number
	/ string
	/ regex
	/ "(" whitespace* block:binaryOperatorBlock whitespace* ")"
	{ return block }
	/ nonBinaryOperatorBlock

parenthesisBlock "Parenthesis block"
	= name:blockName whitespace* "(" firstFewValues:(parameterValue  whitespace* ",")* finalValue:parameterValue?  whitespace* ")"
	{
		return {
			type: Types.parenthesisBlock,
			location: location(),
			name: name,
			// `.map(e=>e[0])` is a hack to get just the parameter value
			parameters: [firstFewValues.map(e=>e[0]), finalValue].flatMap(e=>e)
		}
	}

singleArgumentNakedBlock "Single argument block with no parameters"
	= name:blockName nonNewlineWhitespace+ parameter:parameterValue container:blockContainer?
	{
		const block = {
			// Lie a little bit
			type: Types.parenthesisBlock,
			location: location(),
			name: name,
			parameters: [parameter]
		}
		// Don't let the container be stolen by the parameter value
		if (!!container || parameter.doesHaveContainer || parameter.value?.doesHaveContainer)
			block.doesHaveContainer = true
		return block
	}

parameterValue "Parameter"
	= whitespace* label:(identifier ":")? whitespace* val:value
	{
		return {
			type: Types.parameterValue,
			location: location(),
			value: val,
			label:label ? label[0] : null,
		}
	}
unlabeledParameterValue "Unlabeled parameter"
	= whitespace*  whitespace* val:value
	{
		return {
			type: Types.parameterValue,
			location: location(),
			value: val,
			label:null,
		}
	}

comment "comment"
	= "#" characters:(!"\n" .)+
	{
		return {
			type: Types.comment,
			location: location(),
			value: characters.map(e=>e[1]).join('')
		}
	}

squareBracketsBlock
	= name:(blockName / string) whitespace* "[" parameters:(parameterValue  whitespace* ",")* finalParameter:parameterValue?  whitespace* "]"
	{
		return {
			type: Types.squareBracketsBlock,
			location: location(),
			name: name,
			parameters: [parameters.map(e=>e[0]),[finalParameter]].flatMap(e=>e)
		}
	}

blockName
	= customAbilityReferenceName
	/ whenBlockName
	/ customRuleName
	/ identifier

customAbilityReferenceName "custom block"
	= "custom_block" whitespace+ name:identifier
	{
		return {
			type: Types.customAbilityReference,
			location: location(),
			value: name
		}
	}

whenBlockName "when block"
	= "When" whitespace+ name:identifier
	{
		return {
			type: Types.whenBlock,
			location: location(),
			value: name
		}
	}

customRuleName "custom rule"
	= "custom_rule" whitespace+ name:identifier
	{
		return {
			type: Types.customRule,
			location: location(),
			value: name
		}
	}

identifier "identifier"
	= first:identifierAllowedFirstCharacter rest:identifierAllowedCharacter*
	{
		return {
			type: Types.identifier,
			location: location(),
			value: first + rest.join('')
		}
	}

identifierAllowedFirstCharacter
	= ![0-9] !"_" !"-" v:identifierAllowedCharacter
	{
		return v
	}

identifierAllowedCharacter
	= !whitespace !"#" !"(" !")" !"=" !"\"" !"," !"/" !"[" !"]" !":" v:.
	{
		return v
	}

value
	= block
	/ number
	/ string
	/ regex

number "number"
	// Regex from webplayer: 
	// /^\-?[0-9]+(e\+?[0-9]+)?(\.[0-9]+(e[\+\-]?[0-9]+)?)?$/
	= val:("-"? [0-9]+("e""+"?[0-9]+)?("."[0-9]+("e"[+\-]?[0-9]+)?)?)
	{
		return {
			type: Types.number,
			location: location(),
			// Magic hack to just get all extant characters to be in a single string
			value: val.flatMap((e) => e).filter(e=>!!e).map(e=>e.join?e.join(''):e).join('')
		}
	}

string "string"
	= "\"" characters:stringContentsCharacter* "\""
	{
		return {
			type: Types.string,
			location: location(),
			value: characters.join('')
		}
	}
stringContentsCharacter
	= "\\\""
	{ return '"' }
	/ !"\"" c:.
	{ return c }

regex
	= "/" characters:regexContentsCharacter* "/"
	{
		return {
			type: Types.string, // technically lying but there is no difference in hopscotch
			location: location(),
			value: characters.join('')
		}
	}
regexContentsCharacter
	= "\\/"
	/ !"/" c:.
	{ return c }

whitespace "whitespace"
	= [ \t\n]

nonNewlineWhitespace "non-newline whitespace"
	= !"\n" c:whitespace
	{ return c }

object "object"
	= type:objectTypeName nonNewlineWhitespace+ name:identifier whitespace* attributes:objectAttributes? whitespace* ":"
	{
		const maybeExtant = objectNames.find(e=>{
			return e.location.source == name.location.source
				&& e.location.start.offset == name.location.start.offset
				&& e.location.end.offset == name.location.end.offset
		})
		// Why the heck is it parsing the same thing twice?
		if (!maybeExtant)
			objectNames.push(name)
		return {
			type: Types.object,
			objectType: type,
			name: name,
			attributes: attributes,
			location: location(),
		}
	}

scene "Scene"
	= "Scene" whitespace+ name:identifier whitespace* ":"
	{
		sceneNames.push(name.value)
		return {
			type: Types.scene,
			name: name,
			location: location(),
		}
	}

binaryOperatorWhenBlock "When block with binary operator"
	= "When" whitespace+ "("? block:binaryOperatorBlock ")"? nonNewlineWhitespace* colon:":"?
	{
		return {
			type: Types.whenBlock,
			location: location(),
			value: block,
			doesHaveContainer: block.doesHaveContainer || !!colon
		}
	}

objectAttributes "object attributes"
	= "(" whitespace* attributes:(objectAttribute "," whitespace*)* finalAttribute:objectAttribute whitespace* ")"
	{
		const result = attributes.map(e=>e[0]) || []
		result.push(finalAttribute)
		return result
	}
objectAttribute "object attribute"
	= name:identifier whitespace* ":" whitespace* value:(number / string)
	{
		return {name:name,value:value, location: location()}
	}

objectTypeName "object type name"
// BE SURE TO CHANGE objectTypeDefinition IF THIS CHANGES, IT ASSUMES THIS IS ALWAYS IDENTIFIER
	= !"When " !"custom_rule" !"custom_block" value:identifier
	{ return value }

importStatement
	= "Import" whitespace+ value:string
	{
		dependencies.push(value.value)
	}

internalDefinition
	= objectTypeDefinition / blockTypeDefinition / binaryOperatorBlockTypeDefinition / traitTypeDefinition / parameterTypeDefinition / unimportStatement / setRequiresBetaEditorStatement

unimportStatement
	= "_unimport " value:string
	{
		dependencies = dependencies.filter(e=>e!=value.value)
	}

objectTypeDefinition "[internal] object type definition"
	= "_defineObjectType " name:objectTypeName " " typeId:number " " filename:string " " width:number " " height:number
	{
		objectTypes[name.value] = {
			type: parseFloat(typeId.value),
			filename: filename.value,
			width: width.value,
			height: height.value
		}
	}

traitTypeDefinition "[internal] trait type definition"
	= "_defineTraitType " type:identifier " " name:identifier " " typeId:number " " description:string " [" allowedScopes:(traitScope ", ")* "]"
	{
		const trait = traitTypes[name.value] = traitTypes[name.value] ?? {}
		allowedScopes.forEach(e=>{
			trait[e[0]] = {
				type: parseFloat(typeId.value),
				description: description.value,
				dataType: type,
			}
		})
	}
traitScope
	= "Game"
	/ "Local"
	/ "Object"
	/ "User"

blockTypeDefinition "[internal] block type definition"
	= "_defineBlockType " blockClass:blockClass " " name:blockName " " typeId:number " " description:string " "? parameters:(number " " (identifier / "_") " " string " " string ", ")*
	{
		blockTypes[name.value] = {
			class: blockClass,
			type: parseFloat(typeId.value),
			description: description.value,
			parameters: parameters?.map(e=>{
				return {
					name:e[2] != "_" ? e[2].value : null,
					key:e[4].value,
					defaultValue:e[6].value,
					type: parseFloat(e[0].value)
				}
			}),
		}
	}

binaryOperatorBlockTypeDefinition "[internal] binary operator definition"
	= "_defineBinaryOperator " keyword:binaryOperatorKeyword " " mapsTo:blockName
	{
		binaryOperatorBlockTypes[keyword] = mapsTo.value
	}

parameterTypeDefinition
	= "_defineParameterType " hsType:number " " types:(identifier " ")+
	{
		parameterTypes[hsType.value] = types.map(e=>e[0].value)
	}

blockClass
	= "operator(" type:identifier ")"
	{
		return {class:"operator",dataType:type}
	}
	/ "conditionalOperator(" type:identifier ")"
	{
		return {class:"conditionalOperator",dataType:type}
	}
	/ "method"
	{
		return {class:"method"}
	}
	/ "control"
	{
		return {class:"control"}
	}
	/ "conditionalControl"
	{
		return {class:"conditionalControl"}
	}

setRequiresBetaEditorStatement
	= "_setRequiresBetaEditor " value:("true"/"false")
	{
		requiresBetaEditor = value == "true"
	}