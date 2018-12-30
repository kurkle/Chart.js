describe('Test tickLabel', function() {
	// formatters are used as default config values so users want to be able to reference them
	it('Should expose formatters api', function() {
		expect(typeof Chart.tickLabel).toBeDefined();
		expect(typeof Chart.tickLabel.prototype.size).toBe('function');
		expect(typeof Chart.tickLabel.prototype.draw).toBe('function');
	});

	it('Should calculate size at initialization', function() {
		var data = [0, 1, 2, 3, 4, 5];
		var chart = acquireChart({
			type: 'line',
			data: {
				datasets: [{
					data: data
				}]
			}
		});
		var font = {string: '10px sans-serif', lineHeight: 12};
		var label = new Chart.tickLabel(chart.ctx, font, '#fff', 'test label');
		expect(label.h).toEqual(12);
		expect(label.w).toBeGreaterThanOrEqual(40);
		expect(label.w).toBeLessThanOrEqual(43);
		var sizes = [
			{r: 0, w: label.w, h: label.h},
			{r: 0.5 * Math.PI, w: label.h, h: label.w},
			{r: -0.5 * Math.PI, w: label.h, h: label.w},
			{r: Math.PI, w: label.w, h: label.h}
		];
		sizes.forEach(function(s) {
			var size = label.size(s.r);
			expect(size.h).toBeCloseTo(s.h);
			expect(size.w).toBeCloseTo(s.w);
		});
	});
});
