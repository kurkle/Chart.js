/* eslint-disable import/no-namespace, import/namespace */
import defaults from './core.defaults';
import {isObject} from '../helpers/helpers.core';

export function getIndexAxis(type, optionsWithDefaults) {
	const typeDefaults = defaults[type] || {};
	const datasetDefaults = typeDefaults.datasets || {};
	const typeOptions = optionsWithDefaults[type] || {};
	const datasetOptions = typeOptions.datasets || {};
	return datasetOptions.indexAxis || optionsWithDefaults.indexAxis || datasetDefaults.indexAxis || 'x';
}

function getAxisFromDefaultScaleID(id, indexAxis) {
	let axis = id;
	if (id === '_index_') {
		axis = indexAxis;
	} else if (id === '_value_') {
		axis = indexAxis === 'x' ? 'y' : 'x';
	}
	return axis;
}

function getDefaultScaleIDFromAxis(axis, indexAxis) {
	return axis === indexAxis ? '_index_' : '_value_';
}

function axisFromPosition(position) {
	if (position === 'top' || position === 'bottom') {
		return 'x';
	}
	if (position === 'left' || position === 'right') {
		return 'y';
	}
}

export function determineAxis(id, scaleOptions) {
	if (id === 'x' || id === 'y' || id === 'r') {
		return id;
	}
	return scaleOptions.axis || axisFromPosition(scaleOptions.position) || id.charAt(0).toLowerCase();
}

const directPropertyOrDefault = (obj, prop, def) => Object.prototype.hasOwnProperty.call(obj, prop) ? obj[prop] : def;

/**
 * @param { Config } config
 */
function includeScaleDefaults(config) {
	const optionsWithDefaults = config.options;
	const configScales = directPropertyOrDefault(optionsWithDefaults, 'scales', {});
	const chartIndexAxis = getIndexAxis(config.type, optionsWithDefaults);
	const firstIDs = Object.create(null);
	const scales = Object.create(null);

	// Figure out first scale id's per axis.
	Object.keys(configScales).forEach(id => {
		if (id === '_index_' || id === '_value_') {
			return;
		}
		const scaleConf = configScales[id];
		const axis = determineAxis(id, scaleConf);
		const defaultId = getDefaultScaleIDFromAxis(axis, chartIndexAxis);
		let parent = scaleConf;
		if (isObject(configScales[defaultId])) {
			parent = configScales[defaultId];
			Object.setPrototypeOf(scaleConf, parent);
		}
		scaleConf._parent = parent;
		firstIDs[axis] = firstIDs[axis] || id;
		scales[id] = scaleConf;
	});

	// Then merge dataset defaults to scale configs
	config.data.datasets.forEach(dataset => {
		const type = dataset.type || config.type;
		const indexAxis = dataset.indexAxis || getIndexAxis(type, optionsWithDefaults);
		const datasetDefaults = defaults[type] || {};
		const defaultScaleOptions = directPropertyOrDefault(datasetDefaults, 'scales', {});
		Object.keys(defaultScaleOptions).forEach(defaultID => {
			const axis = getAxisFromDefaultScaleID(defaultID, indexAxis);
			const id = dataset[axis + 'AxisID'] || firstIDs[axis] || axis;
			const scale = scales[id] = Object.assign(scales[id] || Object.create(null), {axis}, configScales[id]);
			const defaultScaleOpts = defaultScaleOptions[defaultID];
			if (isObject(defaultScaleOpts) && defaultScaleOpts !== scale._parent) {
				recursiveSetPrototype(scale._parent || scale, defaultScaleOpts);
				scale._parent = defaultScaleOpts;
			}
		});
	});

	// apply scale defaults, if not overridden by dataset defaults
	Object.keys(scales).forEach(key => {
		const scale = scales[key];
		const target = scale._parent || scale;
		delete scale._parent;
		if (scale.type && defaults.scales[scale.type]) {
			recursiveSetPrototype(defaults.scales[scale.type], defaults.scale);
			recursiveSetPrototype(target, defaults.scales[scale.type]);
		}
		recursiveSetChildPrototypes(scale);
	});


	return scales;
}

function recursiveChildObjects(target) {
	const props = new Map();
	let obj = Object.getPrototypeOf(target);
	while (obj) {
		const keys = Object.keys(obj);
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			if (isObject(obj[key])) {
				if (props.has(key)) {
					props.get(key).push(obj[key]);
				} else {
					props.set(key, [obj[key]]);
				}
			}
		}
		obj = Object.getPrototypeOf(obj);
	}
	return props;
}

function recursiveSetChildPrototypes(target) {
	const map = recursiveChildObjects(target);
	map.forEach((chain, key) => {
		let child = directPropertyOrDefault(target, key, Object.create(null));
		if (target[key] !== child) {
			target[key] = child;
		}
		chain.forEach(parent => {
			Object.setPrototypeOf(child, parent);
			child = parent;
		});
		recursiveSetChildPrototypes(target[key]);
	});
}

function recursiveSetPrototype(child, parent) {
	if (!child || !parent || child === parent) {
		return;
	}
	Object.setPrototypeOf(child, parent);
	Object.keys(child).forEach(key => {
		if (key.charAt(0) === '_') {
			return;
		}
		if (isObject(child[key]) && isObject(parent[key])) {
			recursiveSetPrototype(child[key], parent[key]);
		}
	});
}

function includeDefaults(options, type) {
	let parent = defaults;
	const typeDefaults = defaults[type];
	if (typeDefaults) {
		if (isObject(typeDefaults.datasets)) {
			// if there is a default datasets config, include it in the prototype chain
			Object.setPrototypeOf(typeDefaults.datasets, defaults);
			parent = typeDefaults.datasets;
		}
		recursiveSetPrototype(typeDefaults, parent);
		parent = typeDefaults;
	}
	const newOpts = Object.assign(Object.create(null), options);
	recursiveSetPrototype(newOpts, parent);

	return newOpts;
}

function initConfig(config) {
	config = config || {};

	// Do NOT use mergeConfig for the data object because this method merges arrays
	// and so would change references to labels and datasets, preventing data updates.
	const data = config.data = config.data || {datasets: [], labels: []};
	data.datasets = data.datasets || [];
	data.labels = data.labels || [];

	config.options = includeDefaults(config.options, config.type);
	includeScaleDefaults(config);

	return config;
}

export default class Config {
	constructor(config) {
		this._config = initConfig(config);
	}

	get type() {
		return this._config.type;
	}

	get data() {
		return this._config.data;
	}

	set data(data) {
		this._config.data = data;
	}

	get options() {
		return this._config.options;
	}

	get plugins() {
		return this._config.plugins;
	}

	update(options) {
		const config = this._config;
		const scaleConfig = includeScaleDefaults(config);

		options = includeDefaults(options, config.type);

		options.scales = scaleConfig;
		config.options = options;
	}
}
