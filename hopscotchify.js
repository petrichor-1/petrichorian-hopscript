#!/usr/bin/env node

const fs = require('fs')
const {parseArgs} = require('node:util')
const {hopscotchify} = require('./core/hopscotchify.js')
const path = require('path')

if (process.argv.length < 3)
	return console.error(`Nope! Try ${process.argv[0]} ${process.argv[1]} <file.htn>`)

const argOptions = {
	allowPositionals: true,
	options: {
		ignoreParameterLabels: {
			type: "boolean"
		},
		output: {
			type: "string"
		},
		customImageDirectory: {
			type: "string"
		}
	}
}
const parsedArgs  = parseArgs(argOptions)

if (parsedArgs.positionals.length != 1)
	return console.error(`Nope! Try ${process.argv[0]} ${process.argv[1]} <file.htn>`)

const inputPath = parsedArgs.positionals[0]
const ignoreParameterLabels = parsedArgs.values.ignoreParameterLabels || false
const outputFilePath = parsedArgs.values.output
const customImageDirectoryPath = parsedArgs.values.customImageDirectory

const fileFunctions = {
	read: path => fs.readFileSync(path).toString(),
	stat: path => fs.statSync(path),
	getHspreLikeFrom: (path, alreadyParsedPaths) => {
		if (path.endsWith('.hopscotch') || path.endsWith('.hspre'))
			return {hspreLike: JSON.parse(fs.readFileSync(path).toString())}
		//TODO: hsprez
		const info = hopscotchify(path, {checkParameterLabels: !ignoreParameterLabels}, fileFunctions, alreadyParsedPaths)
		info.hspreLike = info.hopscotchified
		return info
	}
}
try {
	const {hopscotchified, customObjectPaths} = hopscotchify(inputPath, {checkParameterLabels: !ignoreParameterLabels}, fileFunctions, {})
	const result = JSON.stringify(hopscotchified)
	if (customImageDirectoryPath)
		copyCustomImagesTo(customImageDirectoryPath, customObjectPaths)
	if (!outputFilePath)
		return console.log(result)
	fs.writeFileSync(outputFilePath, result)
	if (!customImageDirectoryPath) {
		for (copIndex in customObjectPaths) {
			const cop = customObjectPaths[copIndex]
			console.log(`Be sure to copy the image at ${cop}`)
		}
		console.log("You can use the --customImageDirectory option to automatically copy these files!")
	}
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

function copyCustomImagesTo(customImageDirectoryPath, customObjectPaths) {
	for (pathIndex in customObjectPaths) {
		const filePath = customObjectPaths[pathIndex]
		const image = fs.readFileSync(filePath)
		const basename = path.basename(filePath)
		const finalPath = path.join(customImageDirectoryPath, basename)
		fs.writeFileSync(finalPath, image)
	}
}