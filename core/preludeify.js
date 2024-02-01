const fs = require('fs')

module.exports = function(project, inputPath) {
	const preludePath = __dirname + "/prelude/"
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
		fileMap.push({file: path, starts: prelude.split('\n').length, length: fileContents.split('\n').length, offset: prelude.length})
		prelude+=fileContents
		prelude += "\n"
	})

	fileMap.push({file: inputPath, starts: prelude.split('\n').length, length: project.split('\n').length, offset: prelude.length})

	return {htnCode: prelude + "\n" + project, fileMap: fileMap}
}