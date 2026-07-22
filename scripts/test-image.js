const fs = require('fs');
const { generateThermometerImage } = require('../lib/generateImage');

const buf = generateThermometerImage({
  total: 342,
  goal: 1000,
  lastSupporter: 'sire_fan_42',
  supporterCount: 17,
});

fs.writeFileSync(__dirname + '/../preview.png', buf);
console.log('wrote preview.png');
