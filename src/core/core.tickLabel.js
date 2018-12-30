'use strict';

var helpers = require('../helpers/index');

var halfPI = Math.PI / 2;
var quarterPI = halfPI / 2;

var cache = {};
function measureWidth(ctx, font, text) {
	var fontString = font.string;
	var fontCache = cache[fontString] = cache[fontString] || {font: fontString, data: {}, garbageCollect: []};
	return helpers.longestText(ctx, fontString, text, fontCache);
}

function contains(a, b) {
	return a.indexOf(b) > -1;
}

var TickLabel = function(ctx, font, color, text) {
	var me = this;
	me._ctx = ctx;
	me._font = font;
	me._color = color;
	me._text = helpers.isArray(text) ? text : [text];
	me.initialize.apply(me, arguments);
};

helpers.extend(TickLabel.prototype, {
	initialize: function() {
		var me = this;
		var font = me._font;
		var text = me._text;
		var w = measureWidth(me._ctx, font, text);
		var h = text.length * font.lineHeight;
		var d = Math.sqrt(w * w + h * h);
		helpers.extend(me, {w: w, h: h, d: d, r: d / 2});
	},

	/**
	 * Calculate bounding box size when rotated
	 * @param {number} rad - rotation angle in radians
	 */
	size: function(rad) {
		var me = this;
		var cos = Math.abs(Math.cos(rad));
		var sin = Math.abs(Math.sin(rad));
		var w = me.w;
		var h = me.h;
		var d = Math.sqrt(w * w + h * h);
		return {
			d: d,
			r: d / 2,
			h: h * cos + w * sin,
			w: h * sin + w * cos
		};
	},

	/**
	 * @private
	 */
	_getCenter: function(rad, anchor, size) {
		size = size || this.size(rad);
		var centerX = 0;
		var centerY = 0;
		var halfWidth = size.w / 2;
		var halfHeight = size.h / 2;


		if (contains(anchor, 'l')) {
			centerX = halfWidth;
		}
		if (contains(anchor, 'r')) {
			centerX = -halfWidth;
		}
		if (contains(anchor, 't')) {
			centerY = halfHeight;
			if (contains(anchor, 'R')) {
				rad = rad % halfPI;
				centerX = Math.sin(rad > -quarterPI ? rad : rad - halfPI) * halfHeight;
			}
		}
		if (contains(anchor, 'b')) {
			centerY = -halfHeight;
			if (contains(anchor, 'R')) {
				centerX = Math.sin(rad > -quarterPI ? -rad : rad + halfPI) * halfHeight;
			}
		}

		return {x: centerX, y: centerY};
	},

	padding: function(rad, anchor) {
		var me = this;
		var size = me.size(rad);
		var center = me._getCenter(rad, anchor, size);
		return {
			left: size.w / 2 - center.x,
			right: center.x + size.w / 2,
			top: size.h / 2 - center.y,
			bottom: center.y + size.h / 2
		};
	},

	/**
	 *
	 * @param {Object} pt - {x, y}
	 * @param {Number} rad - label angle in radians
	 * @param {String} align - text alignment inside label
	 * @param {String} anchor - label anchor
	 */
	draw: function(anchorX, anchorY, rad, align, anchor) {
		var me = this;
		var ctx = me._ctx;
		var font = me._font;
		var lineHeight = font.lineHeight;
		var y = me.h / 2;
		var text = me._text;
		var i = text.length - 1;
		var x = align === 'left' ? me.w / -2 : align === 'right' ? me.w / 2 : 0;
		var center = me._getCenter(rad, anchor || '');

		ctx.save();
		ctx.translate(anchorX + center.x, anchorY + center.y);
		ctx.rotate(rad);
		ctx.font = font.string;
		ctx.fillStyle = me._color;
		ctx.textBaseline = 'middle';
		ctx.textAlign = align;

		y -= lineHeight / 2;
		for (; i >= 0; --i) {
			ctx.fillText(text[i], x, y);
			y -= lineHeight;
		}
		ctx.restore();
	}
});

module.exports = TickLabel;
