function eventParameterPrototypeForIdentifier(identifier) {
	// THis gets mutated so return a fresh one
	switch (identifier.value) {
		case "Screen":
			return {
				blockType: 8003,
				description: "📱 My iPad"
			};
		case "Self":
			return {
				blockType: 8004,
				description: "Self"
			};
		default:
			return null;
	}
}
exports.eventParameterPrototypeForIdentifier = eventParameterPrototypeForIdentifier;
