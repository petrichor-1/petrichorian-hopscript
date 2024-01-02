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
actualBlock
	= parenthesisBlock
	/ binaryOperatorBlock
	/ blockName
blockContainer
	= whitespace* ":"

binaryOperatorBlock
	= blockName whitespace* binaryOperatorKeyword (parameterValue  whitespace* ",")* parameterValue
binaryOperatorKeyword
	= "="
	/ "MATCHES"

parenthesisBlock
	= blockName whitespace* "(" (parameterValue  whitespace* ",")* parameterValue?  whitespace* ")"

parameterValue
	= whitespace* value

blockName
	= identifier

identifier
	= identifierAllowedFirstCharacter identifierAllowedCharacter*

identifierAllowedFirstCharacter
	= ![0-9] identifierAllowedCharacter

identifierAllowedCharacter
	= !whitespace !"#" !"(" !")" !"=" !"\"" !"," .

value
	= block
	/ number
	/ string

number
	// Regex from webplayer: 
	// /^\-?[0-9]+(e\+?[0-9]+)?(\.[0-9]+(e[\+\-]?[0-9]+)?)?$/
	= "-"? [0-9]+("e""+"?[0-9]+)?("."[0-9]+("e"[+\-]?[0-9]+)?)?

string
	= "\"" stringContentsCharacter* "\""
stringContentsCharacter
	= "\\\""
	/ !"\"" .

whitespace
	= [ \t\n]

nonNewlineWhitespace
	= !"\n" whitespace