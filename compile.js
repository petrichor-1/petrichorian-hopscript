const fs = require('fs')
const {hopscotchify} = require('./core/hopscotchify.js')

if (process.argv.length < 3)
	return console.error(`Nope! Try ${process.argv[0]} ${process.argv[1]} <file.htn>`)

const inputPath = process.argv[2]
const project = fs.readFileSync(inputPath).toString()
const preludePath = __dirname + "/core/prelude/"
const preludeFiles = [preludePath+"Hopscotch.htn"]
for (let i = 0; project.split('\n')[i].startsWith("#include "); i++) {
	const nextFile = project.split('\n')[i].substring("#include ".length)
	if (/\//.test(nextFile))
		return console.error(`Invalid include file path ${nextFile}`)
	const fullPath = preludePath + nextFile
	if (!fs.existsSync(fullPath))
		return console.error(`Include file ${nextFile} does not exist`)
	preludeFiles.push(fullPath)
}
const alreadyIncluded = new Set()
let prelude = ""
const fileMap = []
preludeFiles.forEach(path => {
	if (alreadyIncluded.has(path))
		return
	alreadyIncluded.add(path)
	const fileContents = fs.readFileSync(path).toString()
	fileMap.push({file: path, starts: prelude.split('\n').length, length: fileContents.split('\n').length})
	prelude+=fileContents
	prelude += "\n"
})

fileMap.push({file: inputPath, starts: prelude.split('\n').length, length: project.split('\n').length})

const htnCode = prelude + "\n" + project

try {
	const hopscotchified = hopscotchify(htnCode, {checkParameterLabels: true})
	console.log(JSON.stringify(hopscotchified))
} catch (error) {
	try {
		const expected = error.expected.map ? error.expected.map(e => {
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
		const locationFile = function(){
			for (let i = 0; i < fileMap.length; i++) {
				let file = fileMap[i]
				if (file.starts + file.length >= error.location.start.line)
					return file
			}
			return null
		}()
		const file = locationFile.file
		const lineOffset = locationFile.starts
		const message = `Syntax error: ${error.message ? error.message : ""} \n\tExpected '${expected.filter(e=>!e.startsWith("[internal]")).join("', '")}', found '${error.found}'\n\tat \x1b[32m${file}:${error.location.start.line-lineOffset}:${error.location.start.column}\x1b[0m`
		console.log(message)
		const line = htnCode.split('\n')[error.location.start.line-1]
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