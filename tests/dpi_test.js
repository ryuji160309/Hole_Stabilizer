const fs = require('fs');
global.self = global;
require('../dpi.js');
const D = global.PegDpi;
(async () => {
  const cases = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  for (const c of cases) {
    const srcBlob = new Blob([fs.readFileSync(c.src)]);
    const info = await D.read(srcBlob, c.name);
    console.log(c.name, 'read:', JSON.stringify(info), D.describe(info));
    const plain = new Uint8Array(fs.readFileSync(c.plain));
    const kind = D.kind(c.name);
    const blob = info ? (kind === 'png' ? D._t.writePng(plain, info) : D._t.writeJpeg(plain, info)) : new Blob([plain]);
    fs.writeFileSync(c.dst, Buffer.from(await blob.arrayBuffer()));
  }
})();
