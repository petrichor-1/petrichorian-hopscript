# Petrichorian hopscript
This is an idea for [hopscript](https://forum.gethopscotch.com/t/hopscript-hopscotch-text-language-concept/61544?u=petrichor) inspired by Tri-Angle's [Hopscotch Textual Notation](https://forum.gethopscotch.com/t/hopscotch-notation-compiler/66230?u=petrichor).

Currently, there are four major elements in this repository:

* `hopscotchify.js` – A program to convert hopscript to a hopscotch project. Just run `node hopscotchify.js <hopscriptfile.htn>` and it will output the hopscotch json (or an error message.) You can add a `--output` option to set a file for the output project to go to – for example, `node hopscotchify.js main.htn --output ~/hsjp/13qd081dr9.hopscotch`.

* `dehopscotchify.js` – An unmaintained program to convert hopscotch projects to hopscript. Just run `node dehopscotchify.js <hopscotchfile.hopscotch>` and it will output the hopscript code. It probably won't work with the current code

* `extract-hopscotch-json.js` – A utility to extract Hopscotch project JSON from HTML or ZIP exports downloaded from explore.gethopscotch.com. Run `node extract-hopscotch-json.js <file.html|file.zip> --output <outputfile.hopscotch>` to extract the project data. The tool automatically detects whether the input is HTML or ZIP and validates that it contains a valid Hopscotch project export. The extracted `.hopscotch` file can then be used with `dehopscotchify.js`.

* `vscode/petrichorianhopscript` – An unmaintained extension for visual studio code to provide some basic syntax highlighting and limited completions. It **will not** work currently, I intend to update it later when there are less big changes being made to the language.

For any of these to work, you first need to run `npm install` to install some dependencies used for parsing the hopscript. Then inside of `core` run `tsc` to compile the typescript used there.