{
	const Types = {
		number: "Number",
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
	= actualBlock blockContainer?
	/ "(" actualBlock ")"
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
	= binaryOperatorBlockInitialValue whitespace* binaryOperatorKeyword (parameterValue  whitespace* ",")* parameterValue
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
	/ "(" whitespace* binaryOperatorBlock whitespace* ")"
	/ nonBinaryOperatorBlock

parenthesisBlock
	= blockName whitespace* "(" (parameterValue  whitespace* ",")* parameterValue?  whitespace* ")"

parameterValue
	= whitespace* value

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
	= identifierAllowedFirstCharacter identifierAllowedCharacter*

identifierAllowedFirstCharacter
	= ![0-9] identifierAllowedCharacter

identifierAllowedCharacter
	= !whitespace !"#" !"(" !")" !"=" !"\"" !"," !"/" !"[" !"]".

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