const fs = require('fs'), path = require('path');
const core = require('../core.js');
const meta = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const pages = meta.map(m => {
  const buf = fs.readFileSync(m.raw);
  const data = new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.length);
  const t = Date.now();
  const det = core.detect(data, m.w, m.h, { tryRotate: true });
  console.log(m.name, m.w + 'x' + m.h, (Date.now() - t) + 'ms', det ? JSON.stringify({
    k: det.k, S1: det.S1, C: det.C, S2: det.S2, score: det.score.toFixed(3), info: det.info }) : 'NOT FOUND');
  return { name: m.name, w: m.w, h: m.h, det };
});
const plan = core.plan(pages, { translate: true, rotate: true, scale: true, outRot: 0 });
console.log('canvas', JSON.stringify(plan.canvas), 'ref', plan.ref, 'failures', JSON.stringify(plan.failures));
plan.ok.forEach(o => console.log(o.index, 'scale', o.scale.toFixed(4), 'angle', o.angleDeg.toFixed(3)));
fs.writeFileSync(path.join(path.dirname(process.argv[2]), 'result.json'), JSON.stringify({ plan }));
