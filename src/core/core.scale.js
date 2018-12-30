'use strict';

var defaults = require('./core.defaults');
var Element = require('./core.element');
var helpers = require('../helpers/index');
var Ticks = require('./core.ticks');
var TickLabel = require('./core.tickLabel');
var parseFont = helpers.options._parseFont;

var valueOrDefault = helpers.valueOrDefault;
var valueAtIndexOrDefault = helpers.valueAtIndexOrDefault;
var resolve = helpers.options.resolve;

defaults._set('scale', {
	display: true,
	position: 'left',
	offset: false,

	// grid line settings
	gridLines: {
		display: true,
		color: 'rgba(0, 0, 0, 0.1)',
		lineWidth: 1,
		drawBorder: true,
		drawOnChartArea: true,
		drawTicks: true,
		tickMarkLength: 10,
		zeroLineWidth: 1,
		zeroLineColor: 'rgba(0,0,0,0.25)',
		zeroLineBorderDash: [],
		zeroLineBorderDashOffset: 0.0,
		offsetGridLines: false,
		borderDash: [],
		borderDashOffset: 0.0
	},

	// scale label
	scaleLabel: {
		// display property
		display: false,

		// actual label
		labelString: '',

		// top/bottom padding
		padding: {
			top: 4,
			bottom: 4
		}
	},

	// label settings
	ticks: {
		beginAtZero: false,
		minRotation: 0,
		maxRotation: 50,
		mirror: false,
		padding: 0,
		reverse: false,
		display: true,
		autoSkip: true,
		autoSkipPadding: 0,
		labelOffset: 0,
		// We pass through arrays to be rendered as multiline labels, we convert Others to strings here.
		callback: Ticks.formatters.values,
		minor: {},
		major: {}
	}
});

function labelsFromTicks(ticks) {
	var labels = [];
	var i, ilen;

	for (i = 0, ilen = ticks.length; i < ilen; ++i) {
		if (ticks[i].label) {
			labels.push(ticks[i]._label);
		}
	}

	return labels;
}

function getPixelForGridLine(scale, index, offsetGridLines) {
	var lineValue = scale.getPixelForTick(index);

	if (offsetGridLines) {
		if (scale.getTicks().length === 1) {
			lineValue -= scale.isHorizontal() ?
				Math.max(lineValue - scale.left, scale.right - lineValue) :
				Math.max(lineValue - scale.top, scale.bottom - lineValue);
		} else if (index === 0) {
			lineValue -= (scale.getPixelForTick(1) - lineValue) / 2;
		} else {
			lineValue -= (lineValue - scale.getPixelForTick(index - 1)) / 2;
		}
	}
	return lineValue;
}

function largestLabel(labels) {
	var largest = {d: 0, w: 0, h: 0};
	var i, ilen;
	for (i = 0, ilen = labels.length; i < ilen; ++i) {
		if (labels[i].d > largest.d) {
			largest = labels[i];
		}
	}
	return largest;
}

function findMaxLabelSize(labels) {
	var i, ilen, label, w, h;
	for (i = 0, ilen = labels.length, w = 0, h = 0; i < ilen; ++i) {
		label = labels[i];
		if (label.w > w) {
			w = label.w;
		}
		if (label.h > h) {
			h = label.h;
		}
	}
	return {w: w, h: h};
}

function parseFontOptions(options, nestedOpts) {
	var globalDefaults = defaults.global;
	var size = resolve([nestedOpts.fontSize, options.fontSize, globalDefaults.defaultFontSize]);
	var style = resolve([nestedOpts.fontStyle, options.fontStyle, globalDefaults.defaultFontStyle]);
	var family = resolve([nestedOpts.fontFamily, options.fontFamily, globalDefaults.defaultFontFamily]);

	return {
		size: size,
		style: style,
		family: family,
		string: helpers.fontString(size, style, family),
		lineHeight: helpers.options.toLineHeight(resolve([nestedOpts.lineHeight, options.lineHeight, globalDefaults.defaultLineHeight]), size),
		color: resolve([nestedOpts.fontColor, options.fontColor, globalDefaults.defaultFontColor])
	};
}

function parseTickFontOptions(options) {
	var minor = parseFontOptions(options, options.minor);
	var major = options.major.enabled ? parseFontOptions(options, options.major) : minor;

	return {minor: minor, major: major};
}

function getTickMarkLength(options) {
	return options.drawTicks ? options.tickMarkLength : 0;
}

function getScaleLabelHeight(options) {
	var font, padding;

	if (!options.display) {
		return 0;
	}

	font = helpers.options._parseFont(options);
	padding = helpers.options.toPadding(options.padding);

	return font.lineHeight + padding.height;
}

function getAnchor(options) {
	var tickOpts = options.ticks;
	var pos = options.position;
	var textAnchor = tickOpts.textAnchor;

	return textAnchor || pos === 'top' ? 'Rb' : pos === 'bottom' ? 'Rt' : pos === 'left' ? 'r' : 'l';
}

module.exports = Element.extend({
	/**
	 * Get the padding needed for the scale
	 * @method getPadding
	 * @private
	 * @returns {Padding} the necessary padding
	 */
	getPadding: function() {
		var me = this;
		return {
			left: me.paddingLeft || 0,
			top: me.paddingTop || 0,
			right: me.paddingRight || 0,
			bottom: me.paddingBottom || 0
		};
	},

	/**
	 * Returns the scale tick objects ({label, major})
	 * @since 2.7
	 */
	getTicks: function() {
		return this._ticks;
	},

	// These methods are ordered by lifecyle. Utilities then follow.
	// Any function defined here is inherited by all scale types.
	// Any function can be extended by the scale type

	mergeTicksOptions: function() {
		// noop
	},

	beforeUpdate: function() {
		helpers.callback(this.options.beforeUpdate, [this]);
	},

	update: function(maxWidth, maxHeight, margins) {
		var me = this;
		var ctx = me.ctx;
		var tickFonts = parseTickFontOptions(me.options.ticks);
		var i, ilen, labels, label, ticks, tick, tickFont;

		// Update Lifecycle - Probably don't want to ever extend or overwrite this function ;)
		me.beforeUpdate();

		// Absorb the master measurements
		me.maxWidth = maxWidth;
		me.maxHeight = maxHeight;
		me.margins = helpers.extend({
			left: 0,
			right: 0,
			top: 0,
			bottom: 0
		}, margins);
		me.longestTextCache = me.longestTextCache || {};

		// Dimensions
		me.beforeSetDimensions();
		me.setDimensions();
		me.afterSetDimensions();

		// Data min/max
		me.beforeDataLimits();
		me.determineDataLimits();
		me.afterDataLimits();

		// Ticks - `this.ticks` is now DEPRECATED!
		// Internal ticks are now stored as objects in the PRIVATE `this._ticks` member
		// and must not be accessed directly from outside this class. `this.ticks` being
		// around for long time and not marked as private, we can't change its structure
		// without unexpected breaking changes. If you need to access the scale ticks,
		// use scale.getTicks() instead.

		me.beforeBuildTicks();

		// New implementations should return an array of objects but for BACKWARD COMPAT,
		// we still support no return (`this.ticks` internally set by calling this method).
		ticks = me.buildTicks() || [];

		// Allow modification of ticks in callback.
		ticks = me.afterBuildTicks(ticks) || ticks;

		me.beforeTickToLabelConversion();

		// New implementations should return the formatted tick labels but for BACKWARD
		// COMPAT, we still support no return (`this.ticks` internally changed by calling
		// this method and supposed to contain only string values).
		labels = me.convertTicksToLabels(ticks) || me.ticks;

		me.afterTickToLabelConversion();

		me.ticks = labels;   // BACKWARD COMPATIBILITY

		// IMPORTANT: from this point, we consider that `this.ticks` will NEVER change!

		// BACKWARD COMPAT: synchronize `_ticks` with labels (so potentially `this.ticks`)
		for (i = 0, ilen = labels.length; i < ilen; ++i) {
			label = labels[i];
			tick = ticks[i];
			tickFont = tick && tick.major ? tickFonts.major : tickFonts.minor;
			if (!tick) {
				ticks.push(tick = {
					label: label,
					_label: new TickLabel(ctx, tickFont, tickFont.color, label),
					major: false
				});
			} else {
				tick.label = label;
				tick._label = new TickLabel(ctx, tickFont, tickFont.color, label);
			}
		}

		me._ticks = ticks;

		// Tick Rotation
		me.beforeCalculateTickRotation();
		me.calculateTickRotation();
		me.afterCalculateTickRotation();
		// Fit
		me.beforeFit();
		me.fit();
		me.afterFit();
		//
		me.afterUpdate();

		return me.minSize;

	},
	afterUpdate: function() {
		helpers.callback(this.options.afterUpdate, [this]);
	},

	//

	beforeSetDimensions: function() {
		helpers.callback(this.options.beforeSetDimensions, [this]);
	},
	setDimensions: function() {
		var me = this;
		// Set the unconstrained dimension before label rotation
		if (me.isHorizontal()) {
			// Reset position before calculating rotation
			me.width = me.maxWidth;
			me.left = 0;
			me.right = me.width;
		} else {
			me.height = me.maxHeight;

			// Reset position before calculating rotation
			me.top = 0;
			me.bottom = me.height;
		}

		// Reset padding
		me.paddingLeft = 0;
		me.paddingTop = 0;
		me.paddingRight = 0;
		me.paddingBottom = 0;
	},
	afterSetDimensions: function() {
		helpers.callback(this.options.afterSetDimensions, [this]);
	},

	// Data limits
	beforeDataLimits: function() {
		helpers.callback(this.options.beforeDataLimits, [this]);
	},
	determineDataLimits: helpers.noop,
	afterDataLimits: function() {
		helpers.callback(this.options.afterDataLimits, [this]);
	},

	//
	beforeBuildTicks: function() {
		helpers.callback(this.options.beforeBuildTicks, [this]);
	},
	buildTicks: helpers.noop,
	afterBuildTicks: function(ticks) {
		var me = this;
		// ticks is empty for old axis implementations here
		if (helpers.isArray(ticks) && ticks.length) {
			return helpers.callback(me.options.afterBuildTicks, [me, ticks]);
		}
		// Support old implementations (that modified `this.ticks` directly in buildTicks)
		me.ticks = helpers.callback(me.options.afterBuildTicks, [me, me.ticks]) || me.ticks;
		return ticks;
	},

	beforeTickToLabelConversion: function() {
		helpers.callback(this.options.beforeTickToLabelConversion, [this]);
	},
	convertTicksToLabels: function() {
		var me = this;
		// Convert ticks to strings
		var tickOpts = me.options.ticks;
		me.ticks = me.ticks.map(tickOpts.userCallback || tickOpts.callback, this);
	},
	afterTickToLabelConversion: function() {
		helpers.callback(this.options.afterTickToLabelConversion, [this]);
	},

	//

	beforeCalculateTickRotation: function() {
		helpers.callback(this.options.beforeCalculateTickRotation, [this]);
	},
	calculateTickRotation: function() {
		var me = this;
		var options = me.options;
		var tickOpts = options.ticks;
		var labels = labelsFromTicks(me._ticks);
		var labelRotation = tickOpts.minRotation || 0;
		var minRotation = labelRotation;
		var maxRotation = tickOpts.maxRotation || 90;
		var maxSize = findMaxLabelSize(labels);
		var bigLabel = largestLabel(labels);
		var labelWidth = maxSize.w;
		var labelHeight = maxSize.h;
		var labelDiagonal, tickWidth, maxWidth, maxHeight, rad;
		var tickCount = me.getTicks().length;

		if (labels.length && me._isVisible() && tickOpts.display && me.isHorizontal()) {

			// Allow 3 pixels x2 padding either side for label readability
			maxWidth = Math.min(me.maxWidth, me.chart.width - labelWidth);
			tickWidth = options.offset ? me.maxWidth / tickCount : maxWidth / (tickCount - 1);

			labelDiagonal = Math.sqrt(labelWidth * labelWidth + labelHeight * labelHeight);

			if (labelWidth + 6 > tickWidth) {
				rad = Math.asin(Math.min(labelHeight / tickWidth, 1));
			} else if (tickWidth < labelDiagonal) {
				// Label would fit without rotation, but rotate still to smooth
				// the start rotation (when resizing)
				rad = Math.acos(tickWidth / labelDiagonal);
			}

			if (rad) {
				labelHeight = bigLabel.size(-1 * rad).h;
				maxHeight = me.maxHeight - getTickMarkLength(options.gridLines)
					- tickOpts.padding - getScaleLabelHeight(options.scaleLabel) - 6;

				if (labelHeight > maxHeight) {
					rad = Math.asin(Math.min(maxHeight / labelDiagonal, 1));
				}
				labelRotation = helpers.toDegrees(rad);
			}
			labelRotation = Math.max(minRotation, Math.min(maxRotation, labelRotation));
		}

		me.labelRotation = labelRotation;
		me._largestLabel = largestLabel(labels);
		me._maxLabelSize = maxSize;
		me._firstLabel = labels[0];
		me._lastLabel = labels[labels.length - 1];
	},
	afterCalculateTickRotation: function() {
		helpers.callback(this.options.afterCalculateTickRotation, [this]);
	},

	//

	beforeFit: function() {
		helpers.callback(this.options.beforeFit, [this]);
	},
	fit: function() {
		var me = this;
		// Reset
		var minSize = me.minSize = {
			width: 0,
			height: 0
		};

		var opts = me.options;
		var tickOpts = opts.ticks;
		var scaleLabelOpts = opts.scaleLabel;
		var gridLineOpts = opts.gridLines;
		var display = me._isVisible();
		var isHorizontal = me.isHorizontal();

		// Width
		if (isHorizontal) {
			// subtract the margins to line up with the chartArea if we are a full width scale
			minSize.width = me.isFullWidth() ? me.maxWidth - me.margins.left - me.margins.right : me.maxWidth;
		} else if (display) {
			minSize.width = getTickMarkLength(gridLineOpts) + getScaleLabelHeight(scaleLabelOpts);
		}

		// height
		if (!isHorizontal) {
			minSize.height = me.maxHeight; // fill all the height
		} else if (display) {
			minSize.height = getTickMarkLength(gridLineOpts) + getScaleLabelHeight(scaleLabelOpts);
		}

		// Don't bother fitting the ticks if we are not showing them
		if (tickOpts.display && display) {
			var tickFont = parseFont(tickOpts);
			var lineSpace = tickFont.size * 0.5;
			var tickPadding = me.options.ticks.padding;
			var rad = -1 * helpers.toRadians(me.labelRotation);
			var largestLabelSize = me._largestLabel && typeof me._largestLabel.size === 'function' ? me._largestLabel.size(rad) : {w: 0, h: 0};
			var anchor = getAnchor(opts);
			var paddingLeft = me._firstLabel ? me._firstLabel.padding(rad, anchor).left : 0;
			var paddingRight = me._lastLabel ? me._lastLabel.padding(rad, anchor).right : 0;
			var maxLabelSize = me._maxLabelSize;
			var labelWidth = Math.max(maxLabelSize.w, largestLabelSize.w);
			var labelHeight = Math.max(maxLabelSize.h, largestLabelSize.h);

			if (isHorizontal) {
				var maxLabelHeight = minSize.height;
				minSize.height = Math.min(me.maxHeight, minSize.height + labelHeight + tickPadding + lineSpace);

				// Store clipping height for labels
				me._maxLabelHeight = minSize.height - maxLabelHeight - tickPadding - lineSpace;

				var offsetLeft = me.getPixelForTick(0) - me.left;
				var offsetRight = me.right - me.getPixelForTick(me._ticks.length - 1);

				// Ensure that our ticks are always inside the canvas. When rotated, ticks are right aligned
				// which means that the right padding is dominated by the font height
				me.paddingLeft = Math.max(paddingLeft - offsetLeft, 0) + 3; // add 3 px to move away from canvas edges
				me.paddingRight = Math.max(paddingRight - offsetRight, 0) + 3;
			} else {
				// A vertical axis is more constrained by the width. Labels are the
				// dominant factor here, so get that length first and account for padding
				var width = tickOpts.mirror
					? 0
					: labelWidth + tickPadding + lineSpace;

				minSize.width = Math.min(me.maxWidth, minSize.width + width);

				me.paddingTop = labelHeight / 2;
				me.paddingBottom = labelHeight / 2;
			}
		}

		me.handleMargins();

		me.width = minSize.width;
		me.height = minSize.height;
	},

	/**
	 * Handle margins and padding interactions
	 * @private
	 */
	handleMargins: function() {
		var me = this;
		if (me.margins) {
			me.paddingLeft = Math.max(me.paddingLeft - me.margins.left, 0);
			me.paddingTop = Math.max(me.paddingTop - me.margins.top, 0);
			me.paddingRight = Math.max(me.paddingRight - me.margins.right, 0);
			me.paddingBottom = Math.max(me.paddingBottom - me.margins.bottom, 0);
		}
	},

	afterFit: function() {
		helpers.callback(this.options.afterFit, [this]);
	},

	// Shared Methods
	isHorizontal: function() {
		return this.options.position === 'top' || this.options.position === 'bottom';
	},
	isFullWidth: function() {
		return (this.options.fullWidth);
	},

	// Get the correct value. NaN bad inputs, If the value type is object get the x or y based on whether we are horizontal or not
	getRightValue: function(rawValue) {
		// Null and undefined values first
		if (helpers.isNullOrUndef(rawValue)) {
			return NaN;
		}
		// isNaN(object) returns true, so make sure NaN is checking for a number; Discard Infinite values
		if ((typeof rawValue === 'number' || rawValue instanceof Number) && !isFinite(rawValue)) {
			return NaN;
		}
		// If it is in fact an object, dive in one more level
		if (rawValue) {
			if (this.isHorizontal()) {
				if (rawValue.x !== undefined) {
					return this.getRightValue(rawValue.x);
				}
			} else if (rawValue.y !== undefined) {
				return this.getRightValue(rawValue.y);
			}
		}

		// Value is good, return it
		return rawValue;
	},

	/**
	 * Used to get the value to display in the tooltip for the data at the given index
	 * @param index
	 * @param datasetIndex
	 */
	getLabelForIndex: helpers.noop,

	/**
	 * Returns the location of the given data point. Value can either be an index or a numerical value
	 * The coordinate (0, 0) is at the upper-left corner of the canvas
	 * @param value
	 * @param index
	 * @param datasetIndex
	 */
	getPixelForValue: helpers.noop,

	/**
	 * Used to get the data value from a given pixel. This is the inverse of getPixelForValue
	 * The coordinate (0, 0) is at the upper-left corner of the canvas
	 * @param pixel
	 */
	getValueForPixel: helpers.noop,

	/**
	 * Returns the location of the tick at the given index
	 * The coordinate (0, 0) is at the upper-left corner of the canvas
	 */
	getPixelForTick: function(index) {
		var me = this;
		var offset = me.options.offset;
		if (me.isHorizontal()) {
			var innerWidth = me.width - (me.paddingLeft + me.paddingRight);
			var tickWidth = innerWidth / Math.max((me._ticks.length - (offset ? 0 : 1)), 1);
			var pixel = (tickWidth * index) + me.paddingLeft;

			if (offset) {
				pixel += tickWidth / 2;
			}

			var finalVal = me.left + pixel;
			finalVal += me.isFullWidth() ? me.margins.left : 0;
			return finalVal;
		}
		var innerHeight = me.height - (me.paddingTop + me.paddingBottom);
		return me.top + (index * (innerHeight / (me._ticks.length - 1)));
	},

	/**
	 * Utility for getting the pixel location of a percentage of scale
	 * The coordinate (0, 0) is at the upper-left corner of the canvas
	 */
	getPixelForDecimal: function(decimal) {
		var me = this;
		if (me.isHorizontal()) {
			var innerWidth = me.width - (me.paddingLeft + me.paddingRight);
			var valueOffset = (innerWidth * decimal) + me.paddingLeft;

			var finalVal = me.left + valueOffset;
			finalVal += me.isFullWidth() ? me.margins.left : 0;
			return finalVal;
		}
		return me.top + (decimal * me.height);
	},

	/**
	 * Returns the pixel for the minimum chart value
	 * The coordinate (0, 0) is at the upper-left corner of the canvas
	 */
	getBasePixel: function() {
		return this.getPixelForValue(this.getBaseValue());
	},

	getBaseValue: function() {
		var me = this;
		var min = me.min;
		var max = me.max;

		return me.beginAtZero ? 0 :
			min < 0 && max < 0 ? max :
			min > 0 && max > 0 ? min :
			0;
	},

	/**
	 * Returns a subset of ticks to be plotted to avoid overlapping labels.
	 * @private
	 */
	_autoSkip: function(ticks) {
		var me = this;
		var isHorizontal = me.isHorizontal();
		var optionTicks = me.options.ticks.minor;
		var tickCount = ticks.length;
		var skipRatio = false;
		var maxTicks = optionTicks.maxTicksLimit;

		// Total space needed to display all ticks. First and last ticks are
		// drawn as their center at end of axis, so tickCount-1
		var ticksLength = me._tickSize() * (tickCount - 1);

		// Axis length
		var axisLength = isHorizontal
			? me.width - (me.paddingLeft + me.paddingRight)
			: me.height - (me.paddingTop + me.PaddingBottom);

		var result = [];
		var i, tick;

		if (ticksLength > axisLength) {
			skipRatio = 1 + Math.floor(ticksLength / axisLength);
		}

		// if they defined a max number of optionTicks,
		// increase skipRatio until that number is met
		if (tickCount > maxTicks) {
			skipRatio = Math.max(skipRatio, 1 + Math.floor(tickCount / maxTicks));
		}

		for (i = 0; i < tickCount; i++) {
			tick = ticks[i];

			if (skipRatio > 1 && i % skipRatio > 0) {
				// leave tick in place but make sure it's not displayed (#4635)
				delete tick.label;
			}
			result.push(tick);
		}
		return result;
	},

	/**
	 * @private
	 */
	_tickSize: function() {
		var me = this;
		var isHorizontal = me.isHorizontal();
		var optionTicks = me.options.ticks;
		var maxSize = me._maxLabelSize;

		// Calculate space needed by label in axis direction.
		var rot = helpers.toRadians(me.labelRotation);
		var cos = Math.abs(Math.cos(rot));
		var sin = Math.abs(Math.sin(rot));

		var padding = optionTicks.autoSkipPadding;
		var w = maxSize.w + padding || 0;
		var h = maxSize.h + padding || 0;

		// Calculate space needed for 1 tick in axis direction.
		return isHorizontal
			? h * cos > w * sin ? w / cos : h / sin
			: h * sin < w * cos ? h / cos : w / sin;
	},

	/**
	 * @private
	 */
	_isVisible: function() {
		var me = this;
		var chart = me.chart;
		var display = me.options.display;
		var i, ilen, meta;

		if (display !== 'auto') {
			return !!display;
		}

		// When 'auto', the scale is visible if at least one associated dataset is visible.
		for (i = 0, ilen = chart.data.datasets.length; i < ilen; ++i) {
			if (chart.isDatasetVisible(i)) {
				meta = chart.getDatasetMeta(i);
				if (meta.xAxisID === me.id || meta.yAxisID === me.id) {
					return true;
				}
			}
		}

		return false;
	},

	/**
	 * Actually draw the scale on the canvas
	 * @param {object} chartArea - the area of the chart to draw full grid lines on
	 */
	draw: function(chartArea) {
		var me = this;
		var options = me.options;

		if (!me._isVisible()) {
			return;
		}

		var chart = me.chart;
		var context = me.ctx;
		var globalDefaults = defaults.global;
		var defaultFontColor = globalDefaults.defaultFontColor;
		var optionTicks = options.ticks;
		var gridLines = options.gridLines;
		var scaleLabel = options.scaleLabel;
		var position = options.position;

		var isRotated = me.labelRotation !== 0;
		var isMirrored = optionTicks.mirror;
		var isHorizontal = me.isHorizontal();

		var ticks = optionTicks.autoSkip ? me._autoSkip(me.getTicks()) : me.getTicks();
		var tickPadding = optionTicks.padding;
		var labelOffset = optionTicks.labelOffset;

		var tl = getTickMarkLength(gridLines);

		var scaleLabelFontColor = valueOrDefault(scaleLabel.fontColor, defaultFontColor);
		var scaleLabelFont = parseFont(scaleLabel);
		var scaleLabelPadding = helpers.options.toPadding(scaleLabel.padding);
		var labelRotationRadians = helpers.toRadians(me.labelRotation);

		var itemsToDraw = [];

		var axisWidth = gridLines.drawBorder ? valueAtIndexOrDefault(gridLines.lineWidth, 0, 0) : 0;
		var alignPixel = helpers._alignPixel;
		var borderValue, tickStart, tickEnd;
		var textAnchor = getAnchor(options);

		if (position === 'top') {
			borderValue = alignPixel(chart, me.bottom, axisWidth);
			tickStart = me.bottom - tl;
			tickEnd = borderValue - axisWidth / 2;
		} else if (position === 'bottom') {
			borderValue = alignPixel(chart, me.top, axisWidth);
			tickStart = borderValue + axisWidth / 2;
			tickEnd = me.top + tl;
		} else if (position === 'left') {
			borderValue = alignPixel(chart, me.right, axisWidth);
			tickStart = me.right - tl;
			tickEnd = borderValue - axisWidth / 2;
		} else {
			borderValue = alignPixel(chart, me.left, axisWidth);
			tickStart = borderValue + axisWidth / 2;
			tickEnd = me.left + tl;
		}

		var epsilon = 0.0000001; // 0.0000001 is margin in pixels for Accumulated error.

		helpers.each(ticks, function(tick, index) {
			// autoskipper skipped this tick (#4635)
			if (helpers.isNullOrUndef(tick.label)) {
				return;
			}

			var lineWidth, lineColor, borderDash, borderDashOffset;
			if (index === me.zeroLineIndex && options.offset === gridLines.offsetGridLines) {
				// Draw the first index specially
				lineWidth = gridLines.zeroLineWidth;
				lineColor = gridLines.zeroLineColor;
				borderDash = gridLines.zeroLineBorderDash || [];
				borderDashOffset = gridLines.zeroLineBorderDashOffset || 0.0;
			} else {
				lineWidth = valueAtIndexOrDefault(gridLines.lineWidth, index);
				lineColor = valueAtIndexOrDefault(gridLines.color, index);
				borderDash = gridLines.borderDash || [];
				borderDashOffset = gridLines.borderDashOffset || 0.0;
			}

			// Common properties
			var tx1, ty1, tx2, ty2, x1, y1, x2, y2, labelX, labelY, textAlign;
			var lineValue = getPixelForGridLine(me, index, gridLines.offsetGridLines);

			if (isHorizontal) {
				var labelYOffset = tl + tickPadding;

				if (lineValue < me.left - epsilon) {
					lineColor = 'rgba(0,0,0,0)';
				}

				tx1 = tx2 = x1 = x2 = alignPixel(chart, lineValue, lineWidth);
				ty1 = tickStart;
				ty2 = tickEnd;
				labelX = me.getPixelForTick(index) + labelOffset; // x values for optionTicks (need to consider offsetLabel option)

				if (position === 'top') {
					y1 = alignPixel(chart, chartArea.top, axisWidth) + axisWidth / 2;
					y2 = chartArea.bottom;
					textAlign = !isRotated ? 'center' : 'left';
					labelY = me.bottom - labelYOffset;
				} else {
					y1 = chartArea.top;
					y2 = alignPixel(chart, chartArea.bottom, axisWidth) - axisWidth / 2;
					textAlign = !isRotated ? 'center' : 'right';
					labelY = me.top + labelYOffset;
				}
			} else {
				var labelXOffset = (isMirrored ? 0 : tl) + tickPadding;

				if (lineValue < me.top - epsilon) {
					lineColor = 'rgba(0,0,0,0)';
				}

				tx1 = tickStart;
				tx2 = tickEnd;
				ty1 = ty2 = y1 = y2 = alignPixel(chart, lineValue, lineWidth);
				labelY = me.getPixelForTick(index) + labelOffset;

				if (position === 'left') {
					x1 = alignPixel(chart, chartArea.left, axisWidth) + axisWidth / 2;
					x2 = chartArea.right;
					textAlign = isMirrored ? 'left' : 'right';
					labelX = me.right - labelXOffset;
				} else {
					x1 = chartArea.left;
					x2 = alignPixel(chart, chartArea.right, axisWidth) - axisWidth / 2;
					textAlign = isMirrored ? 'right' : 'left';
					labelX = me.left + labelXOffset;
				}
			}

			itemsToDraw.push({
				tx1: tx1,
				ty1: ty1,
				tx2: tx2,
				ty2: ty2,
				x1: x1,
				y1: y1,
				x2: x2,
				y2: y2,
				labelX: labelX,
				labelY: labelY,
				glWidth: lineWidth,
				glColor: lineColor,
				glBorderDash: borderDash,
				glBorderDashOffset: borderDashOffset,
				rotation: -1 * labelRotationRadians,
				label: tick._label,
				textAlign: textAlign,
				textAnchor: textAnchor
			});
		});

		// Draw all of the tick labels, tick marks, and grid lines at the correct places
		helpers.each(itemsToDraw, function(item) {
			var glWidth = item.glWidth;
			var glColor = item.glColor;

			if (gridLines.display && glWidth && glColor) {
				context.save();
				context.lineWidth = glWidth;
				context.strokeStyle = glColor;
				if (context.setLineDash) {
					context.setLineDash(item.glBorderDash);
					context.lineDashOffset = item.glBorderDashOffset;
				}

				context.beginPath();

				if (gridLines.drawTicks) {
					context.moveTo(item.tx1, item.ty1);
					context.lineTo(item.tx2, item.ty2);
				}

				if (gridLines.drawOnChartArea) {
					context.moveTo(item.x1, item.y1);
					context.lineTo(item.x2, item.y2);
				}

				context.stroke();
				context.restore();
			}

			if (optionTicks.display) {
				item.label.draw(
					item.labelX,
					item.labelY,
					item.rotation,
					item.textAlign,
					item.textAnchor);
			}
		});

		if (scaleLabel.display) {
			// Draw the scale label
			var scaleLabelX;
			var scaleLabelY;
			var rotation = 0;
			var halfLineHeight = scaleLabelFont.lineHeight / 2;

			if (isHorizontal) {
				scaleLabelX = me.left + ((me.right - me.left) / 2); // midpoint of the width
				scaleLabelY = position === 'bottom'
					? me.bottom - halfLineHeight - scaleLabelPadding.bottom
					: me.top + halfLineHeight + scaleLabelPadding.top;
			} else {
				var isLeft = position === 'left';
				scaleLabelX = isLeft
					? me.left + halfLineHeight + scaleLabelPadding.top
					: me.right - halfLineHeight - scaleLabelPadding.top;
				scaleLabelY = me.top + ((me.bottom - me.top) / 2);
				rotation = isLeft ? -0.5 * Math.PI : 0.5 * Math.PI;
			}

			context.save();
			context.translate(scaleLabelX, scaleLabelY);
			context.rotate(rotation);
			context.textAlign = 'center';
			context.textBaseline = 'middle';
			context.fillStyle = scaleLabelFontColor; // render in correct colour
			context.font = scaleLabelFont.string;
			context.fillText(scaleLabel.labelString, 0, 0);
			context.restore();
		}

		if (axisWidth) {
			// Draw the line at the edge of the axis
			var firstLineWidth = axisWidth;
			var lastLineWidth = valueAtIndexOrDefault(gridLines.lineWidth, ticks.length - 1, 0);
			var x1, x2, y1, y2;

			if (isHorizontal) {
				x1 = alignPixel(chart, me.left, firstLineWidth) - firstLineWidth / 2;
				x2 = alignPixel(chart, me.right, lastLineWidth) + lastLineWidth / 2;
				y1 = y2 = borderValue;
			} else {
				y1 = alignPixel(chart, me.top, firstLineWidth) - firstLineWidth / 2;
				y2 = alignPixel(chart, me.bottom, lastLineWidth) + lastLineWidth / 2;
				x1 = x2 = borderValue;
			}

			context.lineWidth = axisWidth;
			context.strokeStyle = valueAtIndexOrDefault(gridLines.color, 0);
			context.beginPath();
			context.moveTo(x1, y1);
			context.lineTo(x2, y2);
			context.stroke();
		}
	}
});
