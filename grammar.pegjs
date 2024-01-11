{
	const Types = {
		number: "Number",
		parenthesisBlock: "parenthesisBlock",
		parameterValue: "parameterValue",
		identifier: "identifier",
		binaryOperatorBlock: "binaryOperatorBlock",
	}
}

file
	= line* lineContents? whitespace*

line
	= nonNewlineWhitespace* lineContents endOfLine+
lineContents
	= nonNewlineWhitespace* block
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
		console.log(leftSide,type,parameters,finalParameter)
		return {
			type: Types.binaryOperatorBlock,
			leftSide: leftSide,
			rightSide: [parameters.map(e=>e[0]),finalParameter].flatMap(e=>e)
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
			name: name,
			// `.map(e=>e[0])` is a hack to get just the parameter value
			parameters: [firstFewValues.map(e=>e[0]), finalValue].flatMap(e=>e)
		}
	}

parameterValue
	= whitespace* val:value
	{
		return {
			type: Types.parameterValue,
			value: val
		}
	}

comment
	= "#" (!"\n" .)+

squareBracketsBlock
	= (blockName / string) whitespace* "[" (parameterValue  whitespace* ",")* parameterValue?  whitespace* "]"

blockName
	= customAbilityReferenceName
	/ whenBlockName
	/ identifier

customAbilityReferenceName
	= "custom_ability" whitespace+ identifier

whenBlockName
	= "When" whitespace+ identifier

identifier
	= first:identifierAllowedFirstCharacter rest:identifierAllowedCharacter*
	{
		return {
			type: Types.identifier,
			value: first + rest.join('')
		}
	}

identifierAllowedFirstCharacter
	= ![0-9] v:identifierAllowedCharacter
	{
		return v
	}

identifierAllowedCharacter
	= !whitespace !"#" !"(" !")" !"=" !"\"" !"," !"/" !"[" !"]" v:.
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
			// Magic hack to just get all extant characters to be in a single string
			value: val.flatMap((e) => e).filter(e=>!!e).join('')
		}
	}

string
	= "\"" stringContentsCharacter* "\""
stringContentsCharacter
	= "\\\""
	/ !"\"" .

regex
	= "/" regexContentsCharacter* "/"
regexContentsCharacter
	= "\\/"
	/ !"/" .

whitespace
	= [ \t\n]

nonNewlineWhitespace
	= !"\n" whitespace