const fs = require('fs')
const {hopscotchify} = require('./hopscotchify.js')

if (process.argv.length < 3)
	return console.error(`Nope! Try ${process.argv[0]} ${process.argv[1]} <file.htn>`)

const prelude = fs.readFileSync(__dirname+"/Hopscotch.htn").toString()

const project = fs.readFileSync(process.argv[2]).toString()
const htnCode = prelude + "\n" + project
console.log(JSON.stringify(hopscotchify(htnCode, {checkParameterLabels: true})))