#!/usr/bin/env node
const {hopscotchify} = require("../core/hopscotchify.js")
const {readdirSync, readFileSync, statSync} = require('fs')

let isWorking = true
const directoryPath = __dirname+"/samples/shouldHopscotchify"
const options = {checkParameterLabels: true}
const fileFunctions = {
	read: path => readFileSync(path).toString(),
	stat: path => statSync(path),
	getHspreLikeFrom: (path, alreadyParsedPaths) => {
		if (path.endsWith('.hopscotch') || path.endsWith('.hspre'))
			return {hspreLike: JSON.parse(readFileSync(path).toString())}
		//TODO: hsprez
		const info = hopscotchify(path, {checkParameterLabels: true}, fileFunctions, alreadyParsedPaths)
		info.hspreLike = info.hopscotchified
		return info
	}
}
readdirSync(directoryPath)
	.filter(e=>e.endsWith(".htn"))
	.forEach(filename => {
		const path = directoryPath + "/" + filename
		try {
			hopscotchify(path, options, fileFunctions, {})
		} catch (error) {
			isWorking = false
			console.log(`Nope! ${filename} got error: ${error}`)
		}
	})

if (isWorking) {
	console.log("Yep!")
} else {
	process.exit(1)
}