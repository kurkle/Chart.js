import Element from '../core/core.element';
import {toRadians, toDegrees} from '../helpers/helpers.math';
import {isArray} from '../helpers/helpers.core';

const textWidthCache = {};

export default class Label extends Element {
	/**
	 * @param {object} cfg
	 */
	constructor(cfg) {
		super();

		this._rotation = 0;
		this._text = [];
		this.options = {};

		if (cfg) {
			Object.assign(this, cfg);
		}
	}

	set rotation(deg) {
		this._rotation = toRadians(deg);
	}

	get rotation() {
		return toDegrees(this._rotation);
	}

	set text(value) {
		const old = this._text;
		const a = isArray(value) ? value : [value];
		if (linesChanged(old, a)) {
			this._size = 0;
		}
		this._text = a;
	}

	get text() {
		const a = this._text;
		return a.length === 1 ? a[0] : a;
	}

	/**
	 * @param {boolean} [useFinalPosition]
	 */
	getCenterPoint(useFinalPosition) {
		const {x, y, rotation} = this.getProps(['x', 'y', 'rotation'], useFinalPosition);
		const size = rotatedSize(this._size, rotation);
		// TODO: offset, anchor
		return {x, y, size};
	}

	draw(ctx) {
		const me = this;
		const options = me.options;
		const align = options.align;
		const lineHeight = options.font.lineHeight;
		const rotation = me._rotation;
		const lines = me._text;

		ctx.save();
		ctx.translate(me.x, me.y);
		ctx.rotate(rotation);
		setStyle(ctx, options);

		const size = this._size || me._measure(ctx);
		const x = options.align === 'left' ? size.width / -2 : align === 'right' ? size.width / 2 : 0;

		for (let y = size.height - lineHeight, i = lines.length - 1; i >= 0; i--, y -= lineHeight) {
			ctx.fillText(lines[i], x, y);
		}
	}

	_measure(ctx) {
		const font = this.options.font;
		const fontString = font.string;
		const cache = textWidthCache[fontString] || (textWidthCache[fontString] = {});
		const lines = this._text;
		const lineCount = lines.length;
		const height = lineCount * font.lineHeight;

		let width = 0;
		for (let i = 0; i < lineCount; i++) {
			const line = lines[i];
			const lineWidth = cache[line] || (cache[line] = ctx.measureText(line).width);
			width = Math.max(lineWidth, width);
		}
		return {width, height};
	}
}

Label.id = 'label';

/**
 * @type {any}
 */
Label.defaults = {
	align: 'center',
	anchor: 'center',
	display: true,
};

/**
 * @type {any}
 */
Label.defaultRoutes = {
	backgroundColor: 'color',
	borderColor: 'color',
};

function setStyle(ctx, options) {
	ctx.font = options.font.string;
	ctx.fillStyle = options.color;
	ctx.textBaseline = 'middle';
	ctx.textAlign = options.align;
	ctx.shadowBlur = options.textShadowBlur;
	ctx.shadowColor = options.textShadowColor;
}

/**
 * @param {string[]?} a
 * @param {string[]} b
 */
function linesChanged(a, b) {
	if (!a || a.length !== b.length) {
		return true;
	}
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return true;
		}
	}
	return false;
}

function rotatedSize(size, rotation) {
	const sin = Math.sin(rotation);
	const cos = Math.cos(rotation);
	const halfWidth = size.width / 2;
	const halfHeight = size.height / 2;
	return {
		width: sin * halfHeight + cos * halfWidth,
		height: cos * halfHeight + sin * halfWidth
	};
}
