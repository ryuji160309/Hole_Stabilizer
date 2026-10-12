(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var EXT = /\.(jpe?g|png|bmp)$/i;
  var DEFAULT_NF = '_not_founds';
  var DEFAULT_OUT_DIR = 'stabilized';

  // ---------- 言語 ----------
  var I18N = {
    ja: { title:'Peg Hole Stabilizer', input:'入力', drop:'ここに親フォルダをドラッグ&ドロップ(サブフォルダも最下層まで処理)', pickDir:'親フォルダを選択…', pickFiles:'ファイルを選択…',
      output:'出力', pickOut:'出力フォルダを選択…', orient:'出力画像のタップ穴の方向:', o:['上','右','下','左'], opts:'オプション',
      try_:'見つからなければ画像を回転して探す', xform:'画像の変換:', trans:'平行移動', rot:'回転', scale:'拡大縮小', bg:'余白の色:', white:'白', paper:'各ページの紙色',
      nfName:'タップ未検出フォルダ名:', del:'処理後に元ファイルを削除する(出力に成功したファイルのみ)', delHint:'※ フォルダを選択した場合のみ使用可(Chrome/Edge)',
      start:'スタート', result:'結果', folder:'フォルダ', file:'ファイル', state:'状態', scaleH:'拡縮', angle:'傾き補正', dpi:'DPI',
      files:function (n, f) { return n + ' 枚の画像 / ' + f + ' フォルダ'; }, none:'画像が選択されていません',
      outHint_fs:'未選択の場合: 入力フォルダ内に「stabilized」フォルダを作って保存します(ドラッグ入力でフォルダ権限が取れない場合はZIP保存)。出力フォルダを選ぶと元と同じフォルダ構成で保存します。',
      outHint_zip:'このブラウザはフォルダへの直接保存に対応していないため、元と同じフォルダ構成のZIPで保存されます(Chrome/Edge推奨)。',
      outSel:function (n) { return '出力先: ' + n; }, outDefault:'出力先: <入力フォルダ>/stabilized',
      inferred:'推定', detecting:'解析中', rendering:'出力中', done:'完了', ok:'OK', nf:'タップ未検出', zip:'ZIPをダウンロード',
      warnOverwrite:'出力先が入力フォルダと同じです。元の画像が上書きされます。続けますか?',
      warnDelete:'処理後に元ファイルを削除します。よろしいですか?', fail:'処理中に問題が発生しました: ', deleted:'元ファイル削除',
      reasons:{ 'not found':'タップ未検出', 'angle out of range':'傾きが異常', 'scale out of range':'拡縮が異常' }, badName:'フォルダ名に使えない文字が含まれています: ' },
    en: { title:'Peg Hole Stabilizer', input:'Input', drop:'Drag & drop a parent folder here (all sub-folders are processed)', pickDir:'Select parent folder…', pickFiles:'Select files…',
      output:'Output', pickOut:'Select output folder…', orient:'Peg holes orientation in output:', o:['Top','Right','Bottom','Left'], opts:'Options',
      try_:'Try rotating images when peg holes are not found', xform:'Images transformation:', trans:'Translation', rot:'Rotation', scale:'Scaling', bg:'Margin color:', white:'White', paper:'Paper color of each page',
      nfName:'Not-found folder name:', del:'Delete source files after processing (only files written successfully)', delHint:'* Only available when a folder is selected (Chrome/Edge)',
      start:'Start', result:'Result', folder:'Folder', file:'File', state:'Status', scaleH:'Scale', angle:'Deskew', dpi:'DPI',
      files:function (n, f) { return n + ' image(s) / ' + f + ' folder(s)'; }, none:'No images selected',
      outHint_fs:'If not selected: a "stabilized" folder is created inside the input folder (ZIP if folder access is unavailable). With an output folder, the source folder structure is reproduced.',
      outHint_zip:'This browser cannot write to folders directly; results are saved as a ZIP keeping the folder structure (Chrome/Edge recommended).',
      outSel:function (n) { return 'Output: ' + n; }, outDefault:'Output: <input folder>/stabilized',
      inferred:'estimated', detecting:'Analyzing', rendering:'Writing', done:'Done', ok:'OK', nf:'Peg holes not found', zip:'Download ZIP',
      warnOverwrite:'The output directory is the same as the source. Source files will be overwritten. Continue?',
      warnDelete:'Source files will be deleted after processing. Continue?', fail:'A problem occurred: ', deleted:'source deleted',
      reasons:{ 'not found':'Peg holes not found', 'angle out of range':'Angle out of range', 'scale out of range':'Scale out of range' }, badName:'Invalid characters in folder name: ' }
  };
  var lang = localStorage.getItem('peg.lang') || ((navigator.language || 'ja').indexOf('ja') === 0 ? 'ja' : 'en');
  var T = function () { return I18N[lang]; };
  var HAS_FS = typeof window.showDirectoryPicker === 'function';

  function applyLang() {
    var t = T();
    document.documentElement.lang = lang;
    $('t_title').textContent = t.title; $('t_input').textContent = t.input; $('t_drop').textContent = t.drop;
    $('pickDir').textContent = t.pickDir; $('pickFiles').textContent = t.pickFiles;
    $('t_output').textContent = t.output; $('pickOut').textContent = t.pickOut; $('t_orient').textContent = t.orient;
    t.o.forEach(function (s, i) { document.querySelector('.o' + i).textContent = s; });
    $('t_opts').textContent = t.opts; $('t_try').textContent = t.try_; $('t_xform').textContent = t.xform;
    $('t_trans').textContent = t.trans; $('t_rot').textContent = t.rot; $('t_scale').textContent = t.scale;
    $('t_bg').textContent = t.bg; $('t_white').textContent = t.white; $('t_paper').textContent = t.paper;
    $('t_nf').textContent = t.nfName; $('t_del').textContent = t.del; $('t_delHint').textContent = t.delHint;
    $('start').textContent = t.start; $('t_result').textContent = t.result;
    $('th_folder').textContent = t.folder; $('th_file').textContent = t.file; $('th_state').textContent = t.state;
    $('th_scale').textContent = t.scaleH; $('th_angle').textContent = t.angle; $('th_dpi').textContent = t.dpi;
    $('langBtn').textContent = lang === 'ja' ? 'English' : '日本語';
    $('t_outHint').textContent = HAS_FS ? t.outHint_fs : t.outHint_zip;
    $('pickOut').style.display = HAS_FS ? '' : 'none';
    refreshInfo();
  }

  // ---------- 設定の保存 ----------
  var SAVED = ['optTry', 'optTrans', 'optRot', 'optScale'];
  function loadPrefs() {
    $('nfName').value = localStorage.getItem('peg.nf') || DEFAULT_NF;
    SAVED.forEach(function (id) { var v = localStorage.getItem('peg.' + id); if (v !== null) $(id).checked = v === '1'; });
  }
  function savePrefs() {
    localStorage.setItem('peg.nf', $('nfName').value);
    SAVED.forEach(function (id) { localStorage.setItem('peg.' + id, $(id).checked ? '1' : '0'); });
    localStorage.setItem('peg.lang', lang);
  }
  function sanitizeName(s) {
    s = (s || '').trim();
    if (!s || s === '.' || s === '..') return DEFAULT_NF;
    return s;
  }
  $('nfName').addEventListener('change', function () {
    var v = $('nfName').value.trim();
    if (/[\\\/:*?"<>|]/.test(v)) { alert(T().badName + v); v = v.replace(/[\\\/:*?"<>|]/g, '_'); }
    $('nfName').value = sanitizeName(v); savePrefs();
  });
  SAVED.forEach(function (id) { $(id).addEventListener('change', savePrefs); });

  // ---------- 状態 ----------
  // items: [{ parts:[サブフォルダ名...], name, getFile, parent:(DirectoryHandle|null) }]
  var items = [];
  var inDirHandle = null, outDirHandle = null, running = false;

  function log(s) { var l = $('log'); l.textContent += s + '\n'; l.scrollTop = l.scrollHeight; }
  function folderCount() { var s = {}; items.forEach(function (i) { s[i.parts.join('/')] = 1; }); return Object.keys(s).length; }
  function refreshInfo() {
    var t = T();
    $('inputInfo').textContent = items.length ? t.files(items.length, folderCount()) : t.none;
    $('outInfo').textContent = outDirHandle ? t.outSel(outDirHandle.name) : (HAS_FS ? t.outDefault : '');
    var canDelete = items.length && items.every(function (i) { return !!i.parent; });
    $('optDel').disabled = !canDelete;
    if (!canDelete) $('optDel').checked = false;
    $('start').disabled = running || !items.length;
  }
  function natural(a, b) {
    var pa = a.parts.join('/'), pb = b.parts.join('/');
    if (pa !== pb) return pa.localeCompare(pb, undefined, { numeric: true, sensitivity: 'base' });
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  }
  function setItems(list) {
    items = list.filter(function (i) { return EXT.test(i.name) && i.name.charAt(0) !== '.' && i.parts.every(function (p) { return p.charAt(0) !== '.'; }); }).sort(natural);
    refreshInfo();
  }

  // ---------- 入力(最下層まで再帰) ----------
  async function walkHandle(h, parts, acc) {
    for await (var entry of h.values()) {
      if (entry.name.charAt(0) === '.') continue;
      if (entry.kind === 'file') (function (e) { acc.push({ parts: parts, name: e.name, parent: h, getFile: function () { return e.getFile(); } }); })(entry);
      else if (entry.kind === 'directory') await walkHandle(entry, parts.concat(entry.name), acc);
    }
    return acc;
  }
  function entryFile(entry) { return new Promise(function (res, rej) { entry.file(res, rej); }); }
  async function walkEntry(dirEntry, parts, acc) {
    var reader = dirEntry.createReader(), all = [];
    for (;;) {
      var batch = await new Promise(function (res, rej) { reader.readEntries(res, rej); });
      if (!batch.length) break; all = all.concat(batch);
    }
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      if (e.name.charAt(0) === '.') continue;
      if (e.isFile) (function (e2) { acc.push({ parts: parts, name: e2.name, parent: null, getFile: function () { return entryFile(e2); } }); })(e);
      else if (e.isDirectory) await walkEntry(e, parts.concat(e.name), acc);
    }
    return acc;
  }
  function fromFileList(files) {
    return Array.prototype.map.call(files, function (f) {
      var rel = (f.webkitRelativePath || '').split('/');
      var parts = rel.length > 1 ? rel.slice(1, -1) : []; // 先頭は選択した親フォルダ名
      return { parts: parts, name: f.name, parent: null, getFile: function () { return Promise.resolve(f); } };
    });
  }

  $('pickDir').onclick = async function () {
    if (HAS_FS) {
      try {
        var h = await window.showDirectoryPicker({ mode: 'readwrite' });
        inDirHandle = h; outDirHandle = null;
        setItems(await walkHandle(h, [], []));
      } catch (e) { if (e.name !== 'AbortError') log(String(e)); }
    } else $('dirInput').click();
  };
  $('dirInput').onchange = function (e) { inDirHandle = null; setItems(fromFileList(e.target.files)); };
  $('pickFiles').onclick = function () { $('fileInput').click(); };
  $('fileInput').onchange = function (e) { inDirHandle = null; setItems(fromFileList(e.target.files)); };

  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', async function (e) {
    var dt = e.dataTransfer, list = [];
    inDirHandle = null; outDirHandle = null;
    var its = Array.prototype.slice.call(dt.items || []);
    // ハンドルは同期的に先に取り出す(非同期後は無効になるため)
    var handles = its.map(function (it) { return it.getAsFileSystemHandle ? it.getAsFileSystemHandle() : null; });
    var entries = its.map(function (it) { return it.webkitGetAsEntry ? it.webkitGetAsEntry() : null; });
    var dirCount = entries.filter(function (x) { return x && x.isDirectory; }).length;
    for (var i = 0; i < entries.length; i++) {
      var en = entries[i]; if (!en) continue;
      if (en.isDirectory) {
        var hp = handles[i] ? await handles[i] : null;
        if (hp && hp.kind === 'directory' && dirCount === 1 && entries.length === 1) {
          inDirHandle = hp; list = list.concat(await walkHandle(hp, [], []));   // ハンドル経由(削除・直接保存が可能)
        } else {
          list = list.concat(await walkEntry(en, dirCount > 1 || entries.length > 1 ? [en.name] : [], []));
        }
      } else if (en.isFile) {
        (function (en2) { list.push({ parts: [], name: en2.name, parent: null, getFile: function () { return entryFile(en2); } }); })(en);
      }
    }
    if (!list.length) list = fromFileList(dt.files);
    setItems(list);
  });

  $('pickOut').onclick = async function () {
    try { outDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' }); refreshInfo(); }
    catch (e) { if (e.name !== 'AbortError') log(String(e)); }
  };
  $('langBtn').onclick = function () { lang = lang === 'ja' ? 'en' : 'ja'; savePrefs(); applyLang(); };

  // ---------- 出力シンク(元と同じフォルダ構成で書き出す) ----------
  async function ensureWritable(h) {
    if (h.requestPermission) { var p = await h.requestPermission({ mode: 'readwrite' }); if (p !== 'granted') throw new Error('permission denied'); }
  }
  async function makeSink() {
    var base = outDirHandle, defaultDir = false;
    if (!base && inDirHandle) { await ensureWritable(inDirHandle); base = await inDirHandle.getDirectoryHandle(DEFAULT_OUT_DIR, { create: true }); defaultDir = true; }
    if (base) {
      await ensureWritable(base);
      var sameAsSource = false;
      if (inDirHandle && base.isSameEntry) sameAsSource = await base.isSameEntry(inDirHandle);
      var cache = {};
      return {
        sameAsSource: sameAsSource, zip: null, label: base.name, defaultDir: defaultDir,
        write: async function (parts, name, blob) {
          var d = base, key = '';
          for (var i = 0; i < parts.length; i++) {
            key += '/' + parts[i];
            d = cache[key] || (cache[key] = await d.getDirectoryHandle(parts[i], { create: true }));
          }
          var fh = await d.getFileHandle(name, { create: true });
          var w = await fh.createWritable(); await w.write(blob); await w.close();
        }
      };
    }
    var zip = new ZipWriter();
    return { sameAsSource: false, zip: zip, label: 'ZIP', defaultDir: false, write: function (parts, name, blob) { return zip.add(parts.concat(name).join('/'), blob); } };
  }

  // ---------- 処理 ----------
  function yieldUI() { return new Promise(function (r) { setTimeout(r, 0); }); }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  async function analyze(file, opts) {
    var bmp = await createImageBitmap(file);
    var c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    var ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0);
    var id = ctx.getImageData(0, 0, c.width, c.height);
    var det = PegCore.detect(id.data, c.width, c.height, opts);
    var w = bmp.width, h = bmp.height; bmp.close();
    return { w: w, h: h, det: det };
  }
  async function render(file, entry, plan, paperColor, bg) {
    var bmp = await createImageBitmap(file);
    var c = document.createElement('canvas'); c.width = plan.canvas.w; c.height = plan.canvas.h;
    var ctx = c.getContext('2d');
    var p = paperColor;
    ctx.fillStyle = bg === 'paper' && p ? 'rgb(' + p[0] + ',' + p[1] + ',' + p[2] + ')' : '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    var m = entry.matrix; ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.drawImage(bmp, 0, 0); bmp.close();
    return c;
  }

  // 出力先に実際に書いたものだけ削除(ZIPでは削除しない)
  async function deleteSource(item) {
    if (!item.parent) return false;
    await item.parent.removeEntry(item.name);
    return true;
  }

  $('start').onclick = async function () {
    if (running || !items.length) return;
    var t = T();
    var nfName = sanitizeName($('nfName').value); $('nfName').value = nfName; savePrefs();
    running = true; refreshInfo(); $('resSec').hidden = true; $('resBody').innerHTML = ''; $('zipArea').innerHTML = '';
    try {
      var sink = await makeSink();
      var doDelete = $('optDel').checked && !sink.zip;
      if (sink.sameAsSource && !confirm(t.warnOverwrite)) { running = false; refreshInfo(); return; }
      if (doDelete) {
        if (!confirm(t.warnDelete)) { running = false; refreshInfo(); return; }
        await ensureWritable(inDirHandle);
      }

      // 処理対象から出力済みフォルダ/未検出フォルダを除外(再実行時の二重処理防止)
      var excludePrefix = null;
      if (inDirHandle && outDirHandle && inDirHandle.resolve) excludePrefix = await inDirHandle.resolve(outDirHandle); // 出力が入力の内側にある場合
      var work = items.filter(function (it) {
        if (it.parts.indexOf(nfName) >= 0) return false;
        if (sink.defaultDir && it.parts[0] === DEFAULT_OUT_DIR) return false;
        if (excludePrefix && excludePrefix.length && excludePrefix.every(function (p, i) { return it.parts[i] === p; })) return false;
        return true;
      });

      // フォルダごとにグループ化
      var groups = [], gmap = {};
      work.forEach(function (it) {
        var k = it.parts.join('/');
        if (!gmap[k]) { gmap[k] = { parts: it.parts, items: [] }; groups.push(gmap[k]); }
        gmap[k].items.push(it);
      });

      var opts = { tryRotate: $('optTry').checked };
      var bg = document.querySelector('input[name=bg]:checked').value;
      var pOpts = { translate: $('optTrans').checked, rotate: $('optRot').checked, scale: $('optScale').checked,
                    outRot: +document.querySelector('input[name=orient]:checked').value };
      var prog = $('prog'), status = $('status'); prog.max = work.length * 2; prog.value = 0;
      var csv = ['folder,file,status,scale,angle_deg,rotation_cw90,dpi'];
      var done = 0;

      for (var g = 0; g < groups.length; g++) {
        var grp = groups[g], gname = grp.parts.join('/') || '(root)';
        // パス1: このフォルダの全画像を解析
        var pages = [];
        for (var i = 0; i < grp.items.length; i++) {
          status.textContent = t.detecting + ' [' + gname + '] ' + (i + 1) + '/' + grp.items.length + ' ' + grp.items[i].name;
          var file = await grp.items[i].getFile();
          try { var a = await analyze(file, opts); pages.push({ name: grp.items[i].name, w: a.w, h: a.h, det: a.det }); }
          catch (e) { log(gname + '/' + grp.items[i].name + ': ' + e); pages.push({ name: grp.items[i].name, w: 0, h: 0, det: null }); }
          prog.value++; await yieldUI();
        }
        var plan = PegCore.plan(pages, pOpts);
        var okBy = {}; plan.ok.forEach(function (o) { okBy[o.index] = o; });
        var failBy = {}; plan.failures.forEach(function (f) { failBy[f.index] = f.reason; });
        log('[' + gname + '] canvas ' + (plan.canvas ? plan.canvas.w + 'x' + plan.canvas.h : '-') + ', ref=' + (plan.ref >= 0 ? pages[plan.ref].name : '-'));

        // パス2: 出力(元と同じフォルダ構成)
        for (var j = 0; j < grp.items.length; j++) {
          var it = grp.items[j];
          status.textContent = t.rendering + ' [' + gname + '] ' + (j + 1) + '/' + grp.items.length + ' ' + it.name;
          var f2 = await it.getFile();
          var row, wroteSamePath = false, dpi = null;
          try {
            dpi = await PegDpi.read(f2, it.name);
            if (okBy[j]) {
              var o = okBy[j];
              var cv = await render(f2, o, plan, pages[j].det.paper, bg);
              await sink.write(grp.parts, it.name, await PegDpi.encode(cv, it.name, dpi));
              cv.width = cv.height = 1;
              wroteSamePath = sink.sameAsSource; // 元ファイルを上書きしている場合は削除しない
              var inf = pages[j].det.info && pages[j].det.info.inferred;
              row = ['<span class="ok">' + t.ok + '</span>' + (inf ? ' <span class="ng">(' + t.inferred + ')</span>' : ''), o.scale.toFixed(4), o.angleDeg.toFixed(3) + '°'];
              csv.push([gname, it.name, inf ? 'ok_inferred' : 'ok', o.scale.toFixed(4), o.angleDeg.toFixed(3), o.k, PegDpi.describe(dpi)].join(','));
            } else {
              await sink.write(grp.parts.concat(nfName), it.name, f2);
              row = ['<span class="ng">' + esc(t.reasons[failBy[j]] || t.reasons['not found']) + ' → ' + esc(nfName) + '</span>', '-', '-'];
              csv.push([gname, it.name, 'not_found:' + (failBy[j] || 'not found'), '', '', '', PegDpi.describe(dpi)].join(','));
            }
            if (doDelete && !wroteSamePath) { await deleteSource(it); row[0] += ' <span class="mut">(' + t.deleted + ')</span>'; }
          } catch (e) {
            log(t.fail + gname + '/' + it.name + ': ' + e);
            row = ['<span class="ng">' + esc(e) + '</span>', '-', '-'];
          }
          var tr = document.createElement('tr');
          tr.innerHTML = [++done, esc(gname), esc(it.name), row[0], row[1], row[2], esc(PegDpi.describe(dpi))].map(function (x) { return '<td>' + x + '</td>'; }).join('');
          $('resBody').appendChild(tr); $('resSec').hidden = false;
          prog.value++; await yieldUI();
        }
      }
      await sink.write([], 'report.csv', new Blob([csv.join('\n')], { type: 'text/csv' }));
      status.textContent = t.done + ' (' + sink.label + ')';
      if (sink.zip) {
        var url = URL.createObjectURL(sink.zip.toBlob());
        var aEl = document.createElement('a'); aEl.href = url; aEl.download = 'stabilized.zip'; aEl.textContent = t.zip;
        $('zipArea').appendChild(aEl); aEl.click();
      }
    } catch (e) { log(t.fail + e); alert(t.fail + e); }
    running = false; refreshInfo();
  };

  loadPrefs(); applyLang();
})();
