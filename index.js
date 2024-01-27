const fs = require('fs')
const {hopscotchify} = require('./hopscotchify.js')

if (process.argv.length < 3)
	return console.error(`Nope! Try ${process.argv[0]} ${process.argv[1]} <file.htn>`)

const htnCode = fs.readFileSync(process.argv[2]).toString()
console.log(JSON.stringify(hopscotchify(htnCode, {checkParameterLabels: true})))