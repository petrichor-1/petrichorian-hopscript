file
	= line* lineContents? whitespace*

line
	= nonNewlineWhitespace* lineContents endOfLine+
lineContents
	= block
endOfLine
	= nonNewlineWhitespace* "\n"

block
	= parenthesisBlock
	/ binaryOperatorBlock
	/ blockName

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