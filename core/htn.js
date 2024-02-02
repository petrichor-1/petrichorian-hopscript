const peggy = require('peggy')
const fs = require('fs')

module.exports = peggy.generate(fs.readFileSync(__dirname+"/htn.pegjs").toString())