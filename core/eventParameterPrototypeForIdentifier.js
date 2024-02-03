function eventParameterPrototypeForIdentifier(identifier, validScopes) {
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
			const maybeObjectScope = validScopes.find(e=>e.path == identifier.value && e.scope == "Object")
			if (maybeObjectScope) {
				const prototype = {
					blockType: 8000,
					description: "Object",
					objectID: "PETRICHOR__TEMPSHOULDNOTBEUNCHANGED"
				}
				maybeObjectScope.whenDefined(hsObject => {
					prototype.objectID = hsObject.objectID
				})
				return prototype
			}
			return null;
	}
}
exports.eventParameterPrototypeForIdentifier = eventParameterPrototypeForIdentifier;
