#!/usr/bin/env node
const {hopscotchify} = require("../core/hopscotchify.js")
const {readdirSync, readFileSync} = require('fs')
const preludeify = require("../core/preludeify.js")

let isWorking = true
const directoryPath = __dirname+"/samples/shouldHopscotchify"
const options = {checkParameterLabels: true}
console.log("Testing " + directoryPath)
readdirSync(directoryPath)
	.filter(e=>e.endsWith(".htn"))
	.forEach(filename => {
		const {htnCode} = preludeify(readFileSync(directoryPath + "/" + filename).toString(), filename)
		try {
			hopscotchify(htnCode, options)
		} catch (error) {
			isWorking = false
			console.log(`Nope! ${filename} got error: ${error}`)
		}
	})

if (isWorking)
	console.log("Yep!")