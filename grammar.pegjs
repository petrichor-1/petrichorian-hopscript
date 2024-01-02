file
	= line* lineContents? whitespace*

line
	= lineContents endOfLine+
lineContents
	= block
endOfLine
	= (!"\n" whitespace)* "\n"

block
	= parenthesisBlock
	/ assignmentBlock
	/ blockName

assignmentBlock
	= blockName whitespace* "=" (parameterValue ",")* parameterValue

parenthesisBlock
	= blockName whitespace* "(" (parameterValue ",")* parameterValue? ")"

parameterValue
	= whitespace* value whitespace*

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