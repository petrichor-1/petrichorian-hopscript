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
	customObjects: any[]
}

// Merge source into target
export function mergeHspreLikes(target: HspreLike, source: HspreLike) {
	if (source.abilities)
		target.abilities = target.abilities.concat(source.abilities)
	if (source.eventParameters)
		target.eventParameters = target.eventParameters.concat(source.eventParameters)
	if (source.objects)
		target.objects = target.objects.concat(source.objects)
	if (source.rules)
		target.rules = target.rules.concat(source.rules)
	if (source.customRules)
		target.customRules = target.customRules.concat(source.customRules)
	if (source.customRuleInstances)
		target.customRuleInstances = target.customRuleInstances.concat(source.customRuleInstances)
	if (source.variables)
		target.variables = target.variables.concat(source.variables)
	if (source.sceneReferences)
		target.sceneReferences = target.sceneReferences.concat(source.sceneReferences)
	if (source.customObjects)
		target.customObjects = target.customObjects.concat(source.customObjects)
	source.scenes?.forEach(scene => {
		const existingScene = target.scenes.find(e=>e.name==scene.name)
		if (existingScene)
			return existingScene.objects = existingScene.objects.concat(scene.objects)
		target.scenes.push(scene)
	})
}