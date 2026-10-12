/*
 * OLM Peg Hole Stabilizer (web) - core
 * ACMEタップ(スタジアム形バー2個 + 中央の丸穴)の検出と位置合わせ計算。
 * 依存ライブラリなし。ブラウザ/Node 両対応。
 */
(function (root) {
  'use strict';

  var DEFAULTS = {
    bandRatio: 0.28,      // 上辺から探索する高さの割合
    detectMaxWidth: 2400, // 検出用に縮小する最大幅
    minScale: 0.5, maxScale: 2.0, // これを超える拡縮は異常値として未検出扱い
    maxAngleDeg: 10       // これを超える傾きは異常値として未検出扱い
  };

  // ---------- 基本ユーティリティ ----------
  function rotateCW(data, w, h) {
    var out = new Uint8ClampedArray(data.length);
    var nw = h, nh = w;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var s = (y * w + x) * 4;
        var nx = h - 1 - y, ny = x; // (x,y) -> (h-1-y, x)
        var d = (ny * nw + nx) * 4;
        out[d] = data[s]; out[d + 1] = data[s + 1]; out[d + 2] = data[s + 2]; out[d + 3] = data[s + 3];
      }
    }
    return { data: out, w: nw, h: nh };
  }

  function medianOf(arr) {
    var a = Array.prototype.slice.call(arr).sort(function (p, q) { return p - q; });
    return a[a.length >> 1];
  }

  function otsu(hist, total) {
    var sum = 0, i;
    for (i = 0; i < 256; i++) sum += i * hist[i];
    var sumB = 0, wB = 0, best = 0, thr = 0;
    for (i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue;
      var wF = total - wB; if (!wF) break;
      sumB += i * hist[i];
      var mB = sumB / wB, mF = (sum - sumB) / wF;
      var v = wB * wF * (mB - mF) * (mB - mF);
      if (v > best) { best = v; thr = i; }
    }
    return thr;
  }

  // 上辺の帯を縮小(箱平均)して RGB 配列として取り出す
  function extractBand(data, w, h, bandH, f) {
    var bw = Math.floor(w / f), bh = Math.floor(bandH / f);
    var out = new Uint8Array(bw * bh * 3);
    var n = f * f;
    for (var y = 0; y < bh; y++) {
      for (var x = 0; x < bw; x++) {
        var r = 0, g = 0, b = 0;
        for (var yy = 0; yy < f; yy++) {
          var rowBase = ((y * f + yy) * w + x * f) * 4;
          for (var xx = 0; xx < f; xx++) {
            var i = rowBase + xx * 4;
            r += data[i]; g += data[i + 1]; b += data[i + 2];
          }
        }
        var o = (y * bw + x) * 3;
        out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
      }
    }
    return { rgb: out, w: bw, h: bh };
  }

  // 連結成分ラベリング(8近傍, 反復BFS)
  function label(mask, w, h) {
    var labels = new Int32Array(w * h);
    var stack = new Int32Array(w * h);
    var n = 0;
    for (var s = 0; s < w * h; s++) {
      if (!mask[s] || labels[s]) continue;
      n++;
      var sp = 0; stack[sp++] = s; labels[s] = n;
      while (sp) {
        var p = stack[--sp];
        var px = p % w, py = (p - px) / w;
        for (var dy = -1; dy <= 1; dy++) {
          var ny = py + dy; if (ny < 0 || ny >= h) continue;
          for (var dx = -1; dx <= 1; dx++) {
            var nx = px + dx; if (nx < 0 || nx >= w) continue;
            var q = ny * w + nx;
            if (mask[q] && !labels[q]) { labels[q] = n; stack[sp++] = q; }
          }
        }
      }
    }
    return { labels: labels, n: n };
  }

  // 各成分のモーメントと主軸方向の外接寸法
  function analyze(labels, n, w, h) {
    var area = new Float64Array(n + 1), sx = new Float64Array(n + 1), sy = new Float64Array(n + 1);
    var sxx = new Float64Array(n + 1), syy = new Float64Array(n + 1), sxy = new Float64Array(n + 1);
    var touch = new Uint8Array(n + 1);
    var x, y, i, l;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        l = labels[y * w + x]; if (!l) continue;
        area[l]++; sx[l] += x; sy[l] += y; sxx[l] += x * x; syy[l] += y * y; sxy[l] += x * y;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touch[l] = 1;
      }
    }
    var cx = new Float64Array(n + 1), cy = new Float64Array(n + 1), ang = new Float64Array(n + 1);
    for (i = 1; i <= n; i++) {
      if (!area[i]) continue;
      cx[i] = sx[i] / area[i]; cy[i] = sy[i] / area[i];
      var m20 = sxx[i] / area[i] - cx[i] * cx[i];
      var m02 = syy[i] / area[i] - cy[i] * cy[i];
      var m11 = sxy[i] / area[i] - cx[i] * cy[i];
      ang[i] = 0.5 * Math.atan2(2 * m11, m20 - m02);
    }
    var umin = new Float64Array(n + 1).fill(1e9), umax = new Float64Array(n + 1).fill(-1e9);
    var vmin = new Float64Array(n + 1).fill(1e9), vmax = new Float64Array(n + 1).fill(-1e9);
    var cosA = new Float64Array(n + 1), sinA = new Float64Array(n + 1);
    for (i = 1; i <= n; i++) { cosA[i] = Math.cos(ang[i]); sinA[i] = Math.sin(ang[i]); }
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        l = labels[y * w + x]; if (!l) continue;
        var dx = x - cx[l], dy = y - cy[l];
        var u = dx * cosA[l] + dy * sinA[l], v = -dx * sinA[l] + dy * cosA[l];
        if (u < umin[l]) umin[l] = u; if (u > umax[l]) umax[l] = u;
        if (v < vmin[l]) vmin[l] = v; if (v > vmax[l]) vmax[l] = v;
      }
    }
    var comps = [];
    for (i = 1; i <= n; i++) {
      if (area[i] < 6) continue;
      var L = umax[i] - umin[i] + 1, Wd = vmax[i] - vmin[i] + 1;
      if (Wd > L) { var t = L; L = Wd; Wd = t; } // 常に L>=Wd
      var a = ang[i];
      if (vmax[i] - vmin[i] + 1 > umax[i] - umin[i] + 1) a += Math.PI / 2; // 長軸方向
      while (a > Math.PI / 2) a -= Math.PI;
      while (a < -Math.PI / 2) a += Math.PI;
      comps.push({ cx: cx[i], cy: cy[i], area: area[i], L: L, Wd: Wd, angle: a,
                   fill: area[i] / (L * Wd), aspect: L / Wd, touch: !!touch[i] });
    }
    return comps;
  }

  // ---------- 形状分類 ----------
  function classify(comps, bw, lenient) {
    var bars = [], circles = [];
    var fillMin = !lenient ? 0.80 : 0.55;
    var cFill = !lenient ? [0.68, 0.90] : [0.5, 0.98];
    comps.forEach(function (c) {
      if (c.touch) return;
      if (c.aspect >= 2.2 && c.aspect <= 12 && c.fill >= fillMin && c.fill <= 1.0 &&
          c.L >= 0.02 * bw && c.L <= 0.15 * bw && c.Wd >= 0.004 * bw && c.Wd <= 0.05 * bw) bars.push(c);
      else if (c.aspect <= 1.4 && c.fill >= cFill[0] && c.fill <= cFill[1] &&
          c.L >= 0.008 * bw && c.L <= 0.06 * bw) circles.push(c);
    });
    return { bars: bars, circles: circles };
  }

  // bar - circle - bar の組を探す
  function findTriple(bars, circles, bandH) {
    var best = null, maxA = 12 * Math.PI / 180;
    for (var ci = 0; ci < circles.length; ci++) {
      var c = circles[ci];
      for (var i = 0; i < bars.length; i++) {
        for (var j = 0; j < bars.length; j++) {
          if (i === j) continue;
          var b1 = bars[i], b2 = bars[j];
          if (b1.cx >= b2.cx) continue;
          var dx = b2.cx - b1.cx, dy = b2.cy - b1.cy, D = Math.hypot(dx, dy);
          var ang = Math.atan2(dy, dx);
          if (Math.abs(ang) > maxA) continue;
          if (D < 2.5 * Math.max(b1.L, b2.L)) continue;
          var mx = (b1.cx + b2.cx) / 2, my = (b1.cy + b2.cy) / 2;
          var dm = Math.hypot(c.cx - mx, c.cy - my);
          if (dm > 0.12 * D) continue;
          if (Math.abs(b1.angle - ang) > maxA || Math.abs(b2.angle - ang) > maxA) continue;
          var dL = Math.abs(b1.L - b2.L) / Math.max(b1.L, b2.L);
          var dW = Math.abs(b1.Wd - b2.Wd) / Math.max(b1.Wd, b2.Wd);
          if (dL > 0.25 || dW > 0.35) continue;
          var wbar = (b1.Wd + b2.Wd) / 2;
          if (c.L < 0.7 * wbar || c.L > 3.5 * wbar) continue;
          var score = dm / D * 4 + dL + dW * 0.5 + Math.abs(ang) + (c.cy / bandH) * 0.1;
          if (!best || score < best.score) best = { S1: b1, C: c, S2: b2, score: score };
        }
      }
    }
    return best;
  }

  // 正方形カーネルでの膨張/収縮(分離型)。細い鉛筆線を消してバー・円だけを残すオープニングに使う
  function morph(src, w, h, r, doMax) {
    var tmp = new Uint8Array(w * h), out = new Uint8Array(w * h), x, y, k, v;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      v = doMax ? 0 : 1;
      for (k = -r; k <= r; k++) {
        var xx = x + k, s = (xx < 0 || xx >= w) ? 0 : src[y * w + xx];
        if (doMax) { if (s) { v = 1; break; } } else if (!s) { v = 0; break; }
      }
      tmp[y * w + x] = v;
    }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      v = doMax ? 0 : 1;
      for (k = -r; k <= r; k++) {
        var yy = y + k, s2 = (yy < 0 || yy >= h) ? 0 : tmp[yy * w + x];
        if (doMax) { if (s2) { v = 1; break; } } else if (!s2) { v = 0; break; }
      }
      out[y * w + x] = v;
    }
    return out;
  }
  function openMask(mask, w, h, r) { return morph(morph(mask, w, h, r, false), w, h, r, true); }

  // 円 + 片側のバーだけ確実に見つかった場合、反対側のバーを円を中心に点対称で推定する(最後の手段)
  function findPartial(bars, circles, bw, bandH) {
    var best = null, maxA = 12 * Math.PI / 180;
    circles.forEach(function (c) {
      if (c.cy > 0.6 * bandH) return;
      bars.forEach(function (b) {
        var dx = b.cx - c.cx, dy = b.cy - c.cy, D = Math.hypot(dx, dy);
        var ang = dx >= 0 ? Math.atan2(dy, dx) : Math.atan2(-dy, -dx);
        if (Math.abs(ang) > maxA) return;
        if (D < 0.2 * bw || D > 0.45 * bw || D < 1.2 * b.L) return;
        if (Math.abs(b.angle - ang) > maxA) return;
        if (c.L < 0.7 * b.Wd || c.L > 3.5 * b.Wd) return;
        var mirror = { cx: 2 * c.cx - b.cx, cy: 2 * c.cy - b.cy, L: b.L, Wd: b.Wd, angle: b.angle };
        var score = 1 + Math.abs(ang) + (c.cy / bandH) * 0.1;
        if (!best || score < best.score) {
          best = dx >= 0 ? { S1: mirror, C: c, S2: b, score: score } : { S1: b, C: c, S2: mirror, score: score };
        }
      });
    });
    return best;
  }

  // 1方向(画像の上辺)だけ検出
  function detectTop(data, w, h, opts) {
    var bandH = Math.round(h * opts.bandRatio);
    var f = Math.max(1, Math.ceil(w / opts.detectMaxWidth));
    var band = extractBand(data, w, h, bandH, f);
    var bw = band.w, bh = band.h, rgb = band.rgb, N = bw * bh;
    // 紙色(帯の中央値)
    var sample = { r: [], g: [], b: [] };
    for (var k = 0; k < N; k += 7) { sample.r.push(rgb[k * 3]); sample.g.push(rgb[k * 3 + 1]); sample.b.push(rgb[k * 3 + 2]); }
    var paper = [medianOf(sample.r), medianOf(sample.g), medianOf(sample.b)];
    var diff = new Uint8Array(N), hist = new Array(256).fill(0);
    for (var i = 0; i < N; i++) {
      var d = Math.max(Math.abs(rgb[i * 3] - paper[0]), Math.abs(rgb[i * 3 + 1] - paper[1]), Math.abs(rgb[i * 3 + 2] - paper[2]));
      diff[i] = d; hist[d]++;
    }
    var t0 = Math.min(110, Math.max(35, otsu(hist, N)));
    var thresholds = [t0, 45, 80, 120].filter(function (v, idx, a) { return a.indexOf(v) === idx; });
    // 鉛筆の線を消すためのカーネル半径(バー幅より十分小さく)
    var rOpen = Math.max(1, Math.round(bw * 0.0028));
    // 段階: 厳しい形状判定 → 線除去してから厳しい判定 → 線除去+緩い判定 → 生マスク+緩い判定
    var levels = [{ open: 0, lenient: false }, { open: rOpen, lenient: false }, { open: rOpen, lenient: true }, { open: 0, lenient: true }];
    var sc = function (c) { return { x: (c.cx + 0.5) * f - 0.5, y: (c.cy + 0.5) * f - 0.5 }; };
    var partial = null;
    for (var li = 0; li < levels.length; li++) {
      var lv = levels[li];
      for (var ti = 0; ti < thresholds.length; ti++) {
        var T = thresholds[ti];
        for (var pol = 0; pol < 2; pol++) { // 0:通常(穴=前景) 1:白抜き(穴=紙色領域)
          var mask = new Uint8Array(N);
          for (var m = 0; m < N; m++) mask[m] = pol === 0 ? (diff[m] > T ? 1 : 0) : (diff[m] <= T ? 1 : 0);
          if (lv.open) mask = openMask(mask, bw, bh, lv.open);
          var lab = label(mask, bw, bh);
          var comps = analyze(lab.labels, lab.n, bw, bh);
          var cl = classify(comps, bw, lv.lenient);
          var tr = findTriple(cl.bars, cl.circles, bh);
          if (tr) {
            return { S1: sc(tr.S1), C: sc(tr.C), S2: sc(tr.S2), score: tr.score, paper: paper,
                     info: { threshold: T, polarity: pol ? 'inverted' : 'normal', level: li, inferred: false } };
          }
          if (!lv.lenient) { // 推定候補は厳しい判定のものだけ
            var pt = findPartial(cl.bars, cl.circles, bw, bh);
            if (pt && (!partial || pt.score < partial.score)) { pt.T = T; pt.pol = pol; pt.li = li; partial = pt; }
          }
        }
      }
    }
    if (partial) {
      return { S1: sc(partial.S1), C: sc(partial.C), S2: sc(partial.S2), score: partial.score, paper: paper,
               info: { threshold: partial.T, polarity: partial.pol ? 'inverted' : 'normal', level: partial.li, inferred: true } };
    }
    return null;
  }

  /**
   * 画像から タップを検出。上→(tryRotate時) 時計回りに90度ずつ回して再探索。
   * 戻り値: { k, w, h, S1, C, S2, paper, info } (座標は k回時計回りに回した後の画像座標) か null
   */
  function detect(data, w, h, options) {
    var opts = Object.assign({}, DEFAULTS, options || {});
    var cur = { data: data, w: w, h: h };
    var maxK = opts.tryRotate ? 4 : 1;
    for (var k = 0; k < maxK; k++) {
      if (k > 0) cur = rotateCW(cur.data, cur.w, cur.h);
      var r = detectTop(cur.data, cur.w, cur.h, opts);
      if (r) { r.k = k; r.w = cur.w; r.h = cur.h; return r; }
    }
    return null;
  }

  // ---------- アフィン行列 [a,b,c,d,e,f] (canvas 形式: x'=a x + c y + e, y'=b x + d y + f) ----------
  function compose(m2, m1) { // m1 を適用した後 m2
    return [
      m2[0] * m1[0] + m2[2] * m1[1], m2[1] * m1[0] + m2[3] * m1[1],
      m2[0] * m1[2] + m2[2] * m1[3], m2[1] * m1[2] + m2[3] * m1[3],
      m2[0] * m1[4] + m2[2] * m1[5] + m2[4], m2[1] * m1[4] + m2[3] * m1[5] + m2[5]
    ];
  }
  function apply(m, x, y) { return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] }; }
  function rotMatrix(k, w, h) { // 元画像(w,h)を時計回りにk回
    k = ((k % 4) + 4) % 4;
    if (k === 0) return [1, 0, 0, 1, 0, 0];
    if (k === 1) return [0, 1, -1, 0, h, 0];
    if (k === 2) return [-1, 0, 0, -1, w, h];
    return [0, -1, 1, 0, 0, w];
  }
  function rotDims(k, w, h) { return (k % 2) ? { w: h, h: w } : { w: w, h: h }; }

  /**
   * 全ページの検出結果から位置合わせ計画を作る。
   * pages: [{ name, w, h(元寸法), det }] det=detect()の結果 or null
   * opts: { translate, rotate, scale, outRot(0..3: 穴の出力方向 上/右/下/左) }
   * 戻り値: { ok:[{index, matrix, ...}], canvas:{w,h}, ref:index, failures:[{index,reason}] }
   */
  function plan(pages, options) {
    var o = Object.assign({ translate: true, rotate: true, scale: true, outRot: 0 }, DEFAULTS, options || {});
    var failures = [], cand = [];
    pages.forEach(function (p, i) {
      if (!p.det) { failures.push({ index: i, reason: 'not found' }); return; }
      var d = p.det;
      var theta = Math.atan2(d.S2.y - d.S1.y, d.S2.x - d.S1.x);
      var dist = Math.hypot(d.S2.x - d.S1.x, d.S2.y - d.S1.y);
      if (Math.abs(theta) > o.maxAngleDeg * Math.PI / 180) { failures.push({ index: i, reason: 'angle out of range' }); return; }
      cand.push({ index: i, theta: theta, dist: dist, C: d.C, rd: rotDims(d.k, p.w, p.h), k: d.k, w: p.w, h: p.h });
    });
    if (!cand.length) return { ok: [], canvas: null, ref: -1, failures: failures };
    // 基準: 最大面積のページ
    var ref = cand[0];
    cand.forEach(function (c) { if (c.rd.w * c.rd.h > ref.rd.w * ref.rd.h) ref = c; });
    var good = [];
    cand.forEach(function (c) {
      var s = o.scale ? ref.dist / c.dist : 1;
      if (o.scale && (s < o.minScale || s > o.maxScale)) { failures.push({ index: c.index, reason: 'scale out of range' }); return; }
      good.push(c);
      c.s = s;
    });
    // 各ページの「基準点(Cref)原点」相対の変換 (rot k 後の座標 → アンカー相対)
    var minX = 1e18, minY = 1e18, maxX = -1e18, maxY = -1e18;
    good.forEach(function (c) {
      var th = o.rotate ? c.theta : 0, cos = Math.cos(th), sin = Math.sin(th);
      var off = o.translate ? { x: 0, y: 0 } : { x: c.C.x - ref.C.x, y: c.C.y - ref.C.y };
      // 回転(-th) + 拡縮 を C 周りに、その後 off (相対)
      var a = c.s * cos, b = -c.s * sin, cc = c.s * sin, d = c.s * cos;
      var e = off.x - (a * c.C.x + cc * c.C.y), f = off.y - (b * c.C.x + d * c.C.y);
      c.rel = [a, b, cc, d, e, f]; // (回転k後の座標) → アンカー相対(Cref原点)
      [[0, 0], [c.rd.w, 0], [0, c.rd.h], [c.rd.w, c.rd.h]].forEach(function (q) {
        var r = apply(c.rel, q[0], q[1]);
        if (r.x < minX) minX = r.x; if (r.x > maxX) maxX = r.x;
        if (r.y < minY) minY = r.y; if (r.y > maxY) maxY = r.y;
      });
    });
    var cw = Math.ceil(maxX - minX), ch = Math.ceil(maxY - minY);
    var outDims = rotDims(o.outRot, cw, ch);
    var outM = rotMatrix(o.outRot, cw, ch);
    var results = good.map(function (c) {
      var toCanvas = compose([1, 0, 0, 1, -minX, -minY], c.rel);
      var m = compose(outM, compose(toCanvas, rotMatrix(c.k, c.w, c.h)));
      return { index: c.index, matrix: m, scale: c.s, angleDeg: (o.rotate ? c.theta : 0) * 180 / Math.PI, k: c.k };
    });
    return { ok: results, canvas: { w: outDims.w, h: outDims.h }, ref: ref.index, failures: failures };
  }

  var api = { detect: detect, plan: plan, compose: compose, apply: apply, rotMatrix: rotMatrix, rotateCW: rotateCW, DEFAULTS: DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PegCore = api;
})(typeof self !== 'undefined' ? self : this);
