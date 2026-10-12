/*
 * DPI(解像度メタデータ)の読み取りと書き戻し。依存なし。
 * canvas.toBlob() で出力した画像にはDPI情報が入らない(JPEGは1:1、PNGはpHYsなし)ため、
 * 元ファイルのDPI情報を読み取って出力へそのまま書き込む。DPIの値は一切変更しない。
 *   JPEG: JFIF(APP0) と EXIF(APP1: XResolution/YResolution/ResolutionUnit) を元のまま再現
 *   PNG : pHYs チャンクを元の値のままコピー
 *   BMP : biXPelsPerMeter / biYPelsPerMeter をそのままコピー(BMPは自前エンコード)
 */
(function (root) {
  'use strict';

  var crcTable = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(buf, start, end) {
    var c = 0xFFFFFFFF;
    for (var i = start; i < end; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function ext(name) { var m = /\.([^.]+)$/.exec(name); return m ? m[1].toLowerCase() : ''; }
  function kind(name) { var e = ext(name); return e === 'jpg' || e === 'jpeg' ? 'jpeg' : e === 'png' ? 'png' : e === 'bmp' ? 'bmp' : ''; }

  // ---------- 読み取り ----------
  function readJpeg(b) {
    var info = { kind: 'jpeg', jfif: null, exif: null };
    var p = 2;
    while (p + 4 <= b.length) {
      if (b[p] !== 0xFF) break;
      var mk = b[p + 1];
      if (mk === 0xFF) { p++; continue; }
      if (mk === 0xD8 || mk === 0x01 || (mk >= 0xD0 && mk <= 0xD7)) { p += 2; continue; }
      if (mk === 0xDA || mk === 0xD9) break;
      var len = (b[p + 2] << 8) | b[p + 3], d = p + 4;
      if (mk === 0xE0 && b[d] === 0x4A && b[d + 1] === 0x46 && b[d + 2] === 0x49 && b[d + 3] === 0x46 && b[d + 4] === 0) {
        info.jfif = { units: b[d + 7], x: (b[d + 8] << 8) | b[d + 9], y: (b[d + 10] << 8) | b[d + 11] };
      } else if (mk === 0xE1 && b[d] === 0x45 && b[d + 1] === 0x78 && b[d + 2] === 0x69 && b[d + 3] === 0x66 && !info.exif) {
        info.exif = parseExif(b, d + 6, p + 2 + len);
      }
      p += 2 + len;
    }
    return (info.jfif || info.exif) ? info : null;
  }
  function parseExif(b, t, end) {
    var le = b[t] === 0x49;
    function u16(o) { return le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]; }
    function u32(o) { return (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3])) >>> 0; }
    if (t + 8 > end) return null;
    var ifd = t + u32(t + 4); if (ifd + 2 > end) return null;
    var n = u16(ifd), r = { x: null, y: null, unit: null };
    for (var i = 0; i < n; i++) {
      var e = ifd + 2 + i * 12; if (e + 12 > end) break;
      var tag = u16(e), type = u16(e + 2);
      if ((tag === 0x011A || tag === 0x011B) && type === 5) {
        var o = t + u32(e + 8); if (o + 8 > end) continue;
        var v = [u32(o), u32(o + 4)];
        if (tag === 0x011A) r.x = v; else r.y = v;
      } else if (tag === 0x0128 && type === 3) r.unit = u16(e + 8);
    }
    return (r.x || r.y) ? r : null;
  }
  function readPng(b) {
    var p = 8;
    while (p + 12 <= b.length) {
      var len = ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0;
      var type = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
      if (type === 'pHYs' && len === 9) return { kind: 'png', phys: Array.prototype.slice.call(b, p + 8, p + 17) };
      if (type === 'IDAT' || type === 'IEND') break;
      p += 12 + len;
    }
    return null;
  }
  function readBmp(b) {
    if (b.length < 46) return null;
    var dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    var x = dv.getInt32(38, true), y = dv.getInt32(42, true);
    return (x || y) ? { kind: 'bmp', x: x, y: y } : null;
  }
  // File/Blob と ファイル名から DPI情報を取得(なければ null)
  async function read(blob, name) {
    var k = kind(name); if (!k) return null;
    var buf = new Uint8Array(await blob.slice(0, k === 'jpeg' ? 1 << 20 : 1 << 16).arrayBuffer());
    try { return k === 'jpeg' ? readJpeg(buf) : k === 'png' ? readPng(buf) : readBmp(buf); } catch (e) { return null; }
  }

  // ---------- 書き込み ----------
  function buildJfif(j) {
    var s = new Uint8Array([0xFF, 0xE0, 0, 16, 0x4A, 0x46, 0x49, 0x46, 0, 1, 1, j.units, j.x >> 8, j.x & 255, j.y >> 8, j.y & 255, 0, 0]);
    return s;
  }
  function buildExif(x) {
    var buf = new Uint8Array(2 + 2 + 6 + 66), dv = new DataView(buf.buffer);
    buf[0] = 0xFF; buf[1] = 0xE1; dv.setUint16(2, 2 + 6 + 66, false);
    buf.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4);
    var t = 10; // TIFF header (big endian)
    buf[t] = 0x4D; buf[t + 1] = 0x4D; dv.setUint16(t + 2, 0x002A, false); dv.setUint32(t + 4, 8, false);
    dv.setUint16(t + 8, 3, false);
    var e = t + 10, dataOff = 50;
    function ent(i, tag, type, count, valOrOff) {
      var o = e + i * 12; dv.setUint16(o, tag, false); dv.setUint16(o + 2, type, false); dv.setUint32(o + 4, count, false);
      if (type === 3) dv.setUint16(o + 8, valOrOff, false); else dv.setUint32(o + 8, valOrOff, false);
    }
    ent(0, 0x011A, 5, 1, dataOff); ent(1, 0x011B, 5, 1, dataOff + 8); ent(2, 0x0128, 3, 1, x.unit || 2);
    dv.setUint32(t + 8 + 2 + 36, 0, false);
    var xr = x.x || x.y, yr = x.y || x.x;
    dv.setUint32(t + dataOff, xr[0], false); dv.setUint32(t + dataOff + 4, xr[1], false);
    dv.setUint32(t + dataOff + 8, yr[0], false); dv.setUint32(t + dataOff + 12, yr[1], false);
    return buf;
  }
  function writeJpeg(out, info) {
    var parts = [], p = 2;
    // 出力から既存の JFIF/EXIF を除去
    while (p + 4 <= out.length && out[p] === 0xFF) {
      var mk = out[p + 1];
      if (mk === 0xDA || mk === 0xD9) break;
      var len = (out[p + 2] << 8) | out[p + 3];
      var isJfif = mk === 0xE0 && out[p + 4] === 0x4A && out[p + 5] === 0x46;
      var isExif = mk === 0xE1 && out[p + 4] === 0x45 && out[p + 5] === 0x78;
      if (!isJfif && !isExif) parts.push(out.subarray(p, p + 2 + len));
      p += 2 + len;
    }
    var head = [new Uint8Array([0xFF, 0xD8])];
    if (info.jfif) head.push(buildJfif(info.jfif));
    if (info.exif) head.push(buildExif(info.exif));
    return new Blob(head.concat(parts, [out.subarray(p)]), { type: 'image/jpeg' });
  }
  function writePng(out, info) {
    var dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
    var ihdrLen = dv.getUint32(8, false), ins = 8 + 12 + ihdrLen; // IHDR の直後
    var chunk = new Uint8Array(21), cdv = new DataView(chunk.buffer);
    cdv.setUint32(0, 9, false); chunk.set([0x70, 0x48, 0x59, 0x73], 4); chunk.set(info.phys, 8);
    cdv.setUint32(17, crc32(chunk, 4, 17), false);
    // 既存の pHYs を除外
    var pieces = [out.subarray(0, ins)], p = ins;
    while (p + 12 <= out.length) {
      var len = dv.getUint32(p, false);
      var type = String.fromCharCode(out[p + 4], out[p + 5], out[p + 6], out[p + 7]);
      if (type !== 'pHYs') pieces.push(out.subarray(p, p + 12 + len));
      p += 12 + len;
      if (type === 'IEND') break;
    }
    pieces.splice(1, 0, chunk);
    return new Blob(pieces, { type: 'image/png' });
  }
  // canvas から BMP(24bit)を生成。DPIは元の値をそのままコピー
  function encodeBmp(canvas, info) {
    var w = canvas.width, h = canvas.height;
    var id = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    var stride = (w * 3 + 3) & ~3, size = 54 + stride * h;
    var buf = new Uint8Array(size), dv = new DataView(buf.buffer);
    buf[0] = 0x42; buf[1] = 0x4D; dv.setUint32(2, size, true); dv.setUint32(10, 54, true);
    dv.setUint32(14, 40, true); dv.setInt32(18, w, true); dv.setInt32(22, h, true);
    dv.setUint16(26, 1, true); dv.setUint16(28, 24, true); dv.setUint32(34, stride * h, true);
    dv.setInt32(38, info ? info.x : 0, true); dv.setInt32(42, info ? info.y : 0, true);
    for (var y = 0; y < h; y++) {
      var src = (h - 1 - y) * w * 4, dst = 54 + y * stride;
      for (var x = 0; x < w; x++) { buf[dst + x * 3] = id[src + x * 4 + 2]; buf[dst + x * 3 + 1] = id[src + x * 4 + 1]; buf[dst + x * 3 + 2] = id[src + x * 4]; }
    }
    return new Blob([buf], { type: 'image/bmp' });
  }

  // canvas を元ファイルと同形式にエンコードし、DPI情報を再現する
  async function encode(canvas, name, dpi) {
    var k = kind(name);
    if (k === 'bmp') return encodeBmp(canvas, dpi);
    var type = k === 'png' ? 'image/png' : 'image/jpeg';
    var blob = await new Promise(function (res) { canvas.toBlob(res, type, 0.95); });
    if (!dpi) return blob;
    var bytes = new Uint8Array(await blob.arrayBuffer());
    return k === 'png' ? writePng(bytes, dpi) : writeJpeg(bytes, dpi);
  }

  root.PegDpi = { read: read, encode: encode, kind: kind, _t: { writeJpeg: writeJpeg, writePng: writePng, readJpeg: readJpeg, readPng: readPng }, describe: function (d) {
    if (!d) return '-';
    if (d.kind === 'jpeg') {
      var s = [];
      if (d.jfif) s.push('JFIF ' + d.jfif.x + 'x' + d.jfif.y + ' u' + d.jfif.units);
      if (d.exif) s.push('EXIF ' + (d.exif.x ? (d.exif.x[0] / d.exif.x[1]) : '?'));
      return s.join(' / ');
    }
    if (d.kind === 'png') { var px = (d.phys[0] << 24 | d.phys[1] << 16 | d.phys[2] << 8 | d.phys[3]) >>> 0; return d.phys[8] ? Math.round(px * 0.0254) + 'dpi' : 'aspect'; }
    return Math.round(d.x * 0.0254) + 'dpi';
  } };
})(typeof self !== 'undefined' ? self : this);
