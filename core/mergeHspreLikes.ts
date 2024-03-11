/*
Anything that is like hspre (this includes full projects)
*/
export interface HspreLike {
	abilities: any[]
	eventParameters: any[]
	objects: any[]
	rules: any[]
	customRules: any[]
	customRuleInstances: any[]
	variables: any[]
	scenes: any[]
	sceneReferences: any[]
}

// Merge source into target
export function mergeHspreLikes(target: HspreLike, source: HspreLike) {
	target.abilities = target.abilities.concat(source.abilities)
	target.eventParameters = target.eventParameters.concat(source.eventParameters)
	target.objects = target.objects.concat(source.objects)
	target.rules = target.rules.concat(source.rules)
	target.customRules = target.customRules.concat(source.customRules)
	target.customRuleInstances = target.customRuleInstances.concat(source.customRuleInstances)
	target.variables = target.variables.concat(source.variables)
	target.sceneReferences = target.sceneReferences.concat(source.sceneReferences)
	source.scenes?.forEach(scene => {
		const existingScene = target.scenes.find(e=>e.name==scene.name)
		if (existingScene)
			return existingScene.objects = existingScene.objects.concat(scene.objects)
		target.scenes.push(scene)
	})
}