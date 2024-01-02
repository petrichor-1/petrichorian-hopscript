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

assignmentBlock
	= blockName whitespace* "=" whitespace* value

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
	= !whitespace !"#" !"(" !")" !"=" .

value
	= block
	/ number

number
	// Regex from webplayer: 
	// /^\-?[0-9]+(e\+?[0-9]+)?(\.[0-9]+(e[\+\-]?[0-9]+)?)?$/
	= "-"? [0-9]+("e""+"?[0-9]+)?("."[0-9]+("e"[+\-]?[0-9]+)?)?

whitespace
	= [ \t\n]