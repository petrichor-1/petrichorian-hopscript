#!/usr/bin/env node

const fs = require('fs')
const {parseArgs} = require('node:util')
const {hopscotchify} = require('./core/hopscotchify.js')

if (process.argv.length < 3)
	return console.error(`Nope! Try ${process.argv[0]} ${process.argv[1]} <file.htn>`)

const argOptions = {
	allowPositionals: true,
	options: {
		ignoreParameterLabels: {
			type: "boolean"
		}
	}
}
const parsedArgs  = parseArgs(argOptions)

if (parsedArgs.positionals.length != 1)
	return console.error(`Nope! Try ${process.argv[0]} ${process.argv[1]} <file.htn>`)

const inputPath = parsedArgs.positionals[0]
const ignoreParameterLabels = parsedArgs.values.ignoreParameterLabels || false

const fileFunctions = {
	read: path => fs.readFileSync(path).toString(),
	getHspreLikeFrom: (path, alreadyParsedPaths) => {
		if (path.endsWith('.hopscotch') || path.endsWith('.hspre'))
			return {hspreLike: JSON.parse(fs.readFileSync(path).toString())}
		//TODO: hsprez
		const {
			hopscotchified,
			objectTypes,
			blockTypes,
			traitTypes,
			binaryOperatorBlockTypes,
			objectNames,
			parameterTypes
		} = hopscotchify(path, {checkParameterLabels: !ignoreParameterLabels}, fileFunctions, alreadyParsedPaths)
		return {
			hspreLike: hopscotchified,
			hopscotchified,
			objectTypes,
			blockTypes,
			traitTypes,
			binaryOperatorBlockTypes,
			objectNames,
			parameterTypes
		}
	}
}
try {
	const {hopscotchified} = hopscotchify(inputPath, {checkParameterLabels: !ignoreParameterLabels}, fileFunctions, {})
	console.log(JSON.stringify(hopscotchified))
} catch (error) {
	try {
		const expected = error.expected?.map ? error.expected.map(e => {
			if (e.text)
				return e.text
			if (e.description)
				return e.description
			if (e.type == "class")
				return e.parts.join(" or ")
			if (e.type == "end")
				return "end of file"
			return e
		}) : [error.expected]
		const file = error.location.source
		const lineOffset = 0
		const message = `Syntax error: ${error.message ? error.message : ""} \n\tExpected '${expected.filter(e=>!`${e}`.startsWith("[internal]")).join("', '")}', found '${error.found}'\n\tat \x1b[32m${file}:${error.location.start.line-lineOffset}:${error.location.start.column}\x1b[0m`
		console.log(message)
		const line = fs.readFileSync(file).toString().split('\n')[error.location.start.line-1]
		const before = line.substring(0,error.location.start.column-1).replace(/\t/g," ")
		const problematic = line.substring(error.location.start.column-1,error.location.end.column-1).replace(/\t/g," ")
		const after = line.substring(error.location.end.column-1, line.length).replace(/\t/g," ")
		console.log(`${before}\x1b[31m${problematic}\x1b[0m${after}`)
		let arrowLine = ""
		for (let i = 1; i < error.location.start.column; i++)
			arrowLine += " "
		for (let i = 0; i < error.location.end.column - error.location.start.column; i++)
			arrowLine += "^"
		console.log(arrowLine)
	} catch (e2) {
		console.log(error, e2)
	}
}