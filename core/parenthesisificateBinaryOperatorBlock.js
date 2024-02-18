function parenthesisificateBinaryOperatorBlock(binaryOperatorBlock, Types, allowedBlockClasses, getBinaryOperatorBlockWithKeyword) {
	const actualBlockName = getBinaryOperatorBlockWithKeyword(binaryOperatorBlock.operatorKeyword);
	if (!actualBlockName) {
		if (binaryOperatorBlock.operatorKeyword == "=") {
			if (allowedBlockClasses.includes("method")) {
				const rightSide = deepCopy(binaryOperatorBlock.rightSide[0]);
				rightSide.pretendLabelIsValidEvenIfItIsnt = true;
				// TODO: Allow tri-angle style assignment syntax for *shudders* non-set/equals blocks
				return {
					type: Types.parenthesisBlock,
					location: binaryOperatorBlock.location,
					name: { type: Types.identifier, value: "set" },
					parameters: [wrapInInfallibleParameterValue(binaryOperatorBlock.leftSide, Types), rightSide]
				};
			}
		}
		throw new parser.SyntaxError("Undefined binary operator", "TODO: Object.getOwnPropertyNames(BinaryOperatorBlockTypes)", binaryOperatorBlock.operatorKeyword, binaryOperatorBlock.location);
	}
	if (binaryOperatorBlock.rightSide.length != 1)
		throw "TODO: Multiple parameters for binary operator blocks";
	let rightSide = binaryOperatorBlock.rightSide[0];
	if (rightSide.type != Types.parameterValue)
		throw "Should be impossible: Unknown parameter value type in binary operator block";
	let listOfOperandsAndOperators = [binaryOperatorBlock.leftSide, { type: "TEMPOPERATOR", value: binaryOperatorBlock.operatorKeyword, priority: binaryOperatorPriority(binaryOperatorBlock.operatorKeyword) }];
	let currentRightSide = binaryOperatorBlock.rightSide[0].value;
	while (currentRightSide.type == Types.binaryOperatorBlock) {
		listOfOperandsAndOperators.push(currentRightSide.leftSide, { type: "TEMPOPERATOR", value: currentRightSide.operatorKeyword, priority: binaryOperatorPriority(currentRightSide.operatorKeyword) });
		if (currentRightSide.rightSide.length != 1)
			throw "TODO: Multiple parameters for binary operator blocks (2)";
		currentRightSide = currentRightSide.rightSide[0].value;
	}
	listOfOperandsAndOperators.push(currentRightSide);
	let maxPriority = listOfOperandsAndOperators.reduce((c, i) => Math.max(c, i.priority !== undefined ? i.priority : c), -1);
	while (maxPriority > -1) {
		for (let i = 0; i < listOfOperandsAndOperators.length; i++) {
			const item = listOfOperandsAndOperators[i];
			if (item.type != "TEMPOPERATOR")
				continue;
			if (item.priority < maxPriority)
				continue;
			const actualName = getBinaryOperatorBlockWithKeyword(item.value);
			if (!actualName)
				throw new parser.SyntaxError("Undefined binary operator block", Object.getOwnPropertyNames(BinaryOperatorBlockTypes), item.value, listOfOperandsAndOperators[i - 1].location); // Location is approximate
			const newItem = {
				type: Types.parenthesisBlock,
				location: listOfOperandsAndOperators[i - 1].location, // Approximation
				name: { type: Types.identifier, value: actualName },
				parameters: [wrapInInfallibleParameterValue(listOfOperandsAndOperators[i - 1], Types), wrapInInfallibleParameterValue(listOfOperandsAndOperators[i + 1], Types)]
			};
			listOfOperandsAndOperators.splice(i - 1, 2);
			listOfOperandsAndOperators.fill(newItem, i - 1, i);
			i--;
		}
		maxPriority = listOfOperandsAndOperators.reduce((c, i) => Math.max(c, i.priority !== undefined ? i.priority : c), -1);
	}
	if (listOfOperandsAndOperators.length != 1)
		throw "Something ent wrong lol";
	return listOfOperandsAndOperators[0];
}
exports.parenthesisificateBinaryOperatorBlock = parenthesisificateBinaryOperatorBlock;


function deepCopy(object) {
	return JSON.parse(JSON.stringify(object))
}

function wrapInInfallibleParameterValue(e, Types) {
	return {
		type: Types.parameterValue,
		value: e,
		pretendLabelIsValidEvenIfItIsnt: true
	}
}
function binaryOperatorPriority(operator) {
	switch (operator) {
	case "and":
	case "or":
	case "not":
		return 0
	case "<":
	case "<=":
	case ">":
	case ">=":
	case "!=":
	case "==":
	case "=":
	case "MATCHES":
		return 1
	case "-":
	case "+":
		return 2
	case "/":
	case "*":
	case "%":
		return 3
	case "^":
		return 4
	default:
		throw `Should be impossible: Unknown binary operator keyword '${operator}'`
	}
}