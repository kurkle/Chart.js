const Chart = require('chart.js');

Chart.register({
  id: 'TEST_PLUGIN',
  dummyValue: Chart.helpers.valueOrDefault(0, 1)
});
