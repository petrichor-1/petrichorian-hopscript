export function mergeLists<T>(target: T[], source: T[] | undefined) {
	if (!source)
		return
	source.forEach(item => {
		if (target.includes(item))
			return
		target.push(item)
	})
}

export function mergeObjects(target: any, source: any | undefined) {
	if (!source)
		return target
	for (const key in source) {
		if (Object.prototype.hasOwnProperty.call(source, key)) {
			const element = source[key];
			if (target[key])
				continue
			target[key] = element
		}
	}
	return target
}