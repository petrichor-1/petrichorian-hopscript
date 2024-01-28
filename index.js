const fs = require('fs')
const {hopscotchify} = require('./hopscotchify.js')

if (process.argv.length < 3)
	return console.error(`Nope! Try ${process.argv[0]} ${process.argv[1]} <file.htn>`)

const prelude = fs.readFileSync(__dirname+"/Hopscotch.htn").toString()
const preludeLineCount = prelude.split("\n").length

const inputPath = process.argv[2]
const project = fs.readFileSync(inputPath).toString()
const htnCode = prelude + "\n" + project

try {
	const hopscotchified = hopscotchify(htnCode, {checkParameterLabels: true})
	console.log(JSON.stringify(hopscotchified))
} catch (error) {
	try {
		const message = `${error.toString()}\nExpected '${error.expected}', found '${error.found}' at ${inputPath}:${error.location.start.line-preludeLineCount}:${error.location.start.column}`
		console.log(message)
	} catch {
		console.log(error)
	}
}