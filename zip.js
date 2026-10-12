/* 最小ZIPライタ(無圧縮/STORE, UTF-8ファイル名)。依存なし。 */
(function (root) {
  'use strict';
  var table = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(buf) { var c = 0xFFFFFFFF; for (var i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

  function ZipWriter() { this.files = []; }
  ZipWriter.prototype.add = async function (name, blob) {
    var data = new Uint8Array(await blob.arrayBuffer());
    this.files.push({ name: new TextEncoder().encode(name), data: data, crc: crc32(data) });
  };
  ZipWriter.prototype.toBlob = function () {
    var parts = [], central = [], offset = 0;
    var d = new Date();
    var time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    this.files.forEach(function (f) {
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, f.crc, true);
      h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true);
      h.setUint16(26, f.name.length, true); h.setUint16(28, 0, true);
      parts.push(h.buffer, f.name, f.data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(10, 0, true); c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, f.crc, true);
      c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, f.name.length, true);
      c.setUint32(42, offset, true);
      central.push(c.buffer, f.name);
      offset += 30 + f.name.length + f.data.length;
    });
    var csize = 0; central.forEach(function (p) { csize += p.byteLength || p.length; });
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, this.files.length, true); e.setUint16(10, this.files.length, true);
    e.setUint32(12, csize, true); e.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [e.buffer]), { type: 'application/zip' });
  };
  root.ZipWriter = ZipWriter;
})(self);
