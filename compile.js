const fs = require('fs')
const {hopscotchify} = require('./core/hopscotchify.js')

if (process.argv.length < 3)
	return console.error(`Nope! Try ${process.argv[0]} ${process.argv[1]} <file.htn>`)

const prelude = fs.readFileSync(__dirname+"/core/prelude/Hopscotch.htn").toString()
const preludeLineCount = prelude.split("\n").length

const inputPath = process.argv[2]
const project = fs.readFileSync(inputPath).toString()
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
		const message = `Syntax error: Expected '${expected.filter(e=>!e.startsWith("[internal]")).join("', '")}', found '${error.found}'\n\tat ${inputPath}:${error.location.start.line-preludeLineCount}:${error.location.start.column}`
		console.log(message)
		const line = htnCode.split('\n')[error.location.start.line-1]
		const before = line.substring(0,error.location.start.column-1)
		const problematic = line.substring(error.location.start.column-1,error.location.end.column-1)
		const after = line.substring(error.location.end.column-1, line.length)
		console.log(`${before}\x1b[31m${problematic}\x1b[0m${after}`)
		let arrowLine = ""
		for (let i = 1; i < error.location.start.column; i++)
			arrowLine += " "
		for (let i = 0; i < error.location.end.column - error.location.start.column; i++)
			arrowLine += "^"
		console.log(arrowLine)
	} catch {
		console.log(error)
	}
}