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
	}
	let objectTypes = {}
	let blockTypes = {}
	let binaryOperatorBlockTypes = {}
	let traitTypes = {}
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
	= indentationWhitespace:nonNewlineWhitespace* block:(object / block / objectTypeDefinition / blockTypeDefinition / binaryOperatorBlockTypeDefinition / traitTypeDefinition)
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
endOfLine
	= nonNewlineWhitespace* "\n"

block
	= block:actualBlock container:blockContainer?
	{
		block.doesHaveContainer = !!container
		return block
	}
	/ "(" block:actualBlock ")"
	{ return block }
actualBlock
	= binaryOperatorBlock
	/ nonBinaryOperatorBlock

nonBinaryOperatorBlock
	= parenthesisBlock
	/ squareBracketsBlock
	/ blockName
	/ comment
blockContainer
	= whitespace* ":"

binaryOperatorBlock
	= leftSide:binaryOperatorBlockInitialValue whitespace* type:binaryOperatorKeyword parameters:(parameterValue  whitespace* ",")* finalParameter:parameterValue
	{
		return {
			type: Types.binaryOperatorBlock,
			location: location(),
			leftSide: leftSide,
			rightSide: [parameters.map(e=>e[0]),finalParameter].flatMap(e=>e),
			operatorKeyword: type
		}
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

binaryOperatorBlockInitialValue
= number
	/ string
	/ regex
	/ "(" whitespace* block:binaryOperatorBlock whitespace* ")"
	{ return block }
	/ nonBinaryOperatorBlock

parenthesisBlock
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

parameterValue
	= whitespace* label:(identifier ":")? whitespace* val:value
	{
		return {
			type: Types.parameterValue,
			location: location(),
			value: val,
			label:label ? label[0] : null,
		}
	}

comment
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
	/ identifier

customAbilityReferenceName
	= "custom_ability" whitespace+ name:identifier
	{
		return {
			type: Types.customAbilityReference,
			location: location(),
			value: name
		}
	}

whenBlockName
	= "When" whitespace+ name:identifier
	{
		return {
			type: Types.whenBlock,
			location: location(),
			value: name
		}
	}

identifier
	= first:identifierAllowedFirstCharacter rest:identifierAllowedCharacter*
	{
		return {
			type: Types.identifier,
			location: location(),
			value: first + rest.join('')
		}
	}

identifierAllowedFirstCharacter
	= ![0-9] !"_" v:identifierAllowedCharacter
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

number
	// Regex from webplayer: 
	// /^\-?[0-9]+(e\+?[0-9]+)?(\.[0-9]+(e[\+\-]?[0-9]+)?)?$/
	= val:("-"? [0-9]+("e""+"?[0-9]+)?("."[0-9]+("e"[+\-]?[0-9]+)?)?)
	{
		return {
			type: Types.number,
			location: location(),
			// Magic hack to just get all extant characters to be in a single string
			value: val.flatMap((e) => e).filter(e=>!!e).join('')
		}
	}

string
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

whitespace
	= [ \t\n]

nonNewlineWhitespace
	= !"\n" c:whitespace
	{ return c }

object
	= type:objectTypeName whitespace+ name:string whitespace* ":"
	{
		return {
			type: Types.object,
			objectType: type,
			name: name
		}
	}

objectTypeName
// BE SURE TO CHANGE objectTypeDefinition IF THIS CHANGES, IT ASSUMES THIS IS ALWAYS IDENTIFIER
	= identifier

objectTypeDefinition
	= "_defineObjectType " name:objectTypeName " " typeId:number " " filename:string " " width:number " " height:number
	{
		objectTypes[name.value] = {
			type: parseFloat(typeId.value),
			filename: filename.value,
			width: width.value,
			height: height.value
		}
	}

traitTypeDefinition
	= "_defineTraitType " name:identifier " " typeId:number " " description:string
	{
		traitTypes[name.value] = {
			type: parseFloat(typeId.value),
			description: description.value,
		}
	}

blockTypeDefinition
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

binaryOperatorBlockTypeDefinition
	= "_defineBinaryOperator " keyword:binaryOperatorKeyword " " mapsTo:blockName
	{
		binaryOperatorBlockTypes[keyword] = mapsTo.value
	}

blockClass
	= "operator"
	/ "method"
	/ "control"
	/ "conditionalControl"