"""DPI保持の検証: PILで 300dpi/72dpi/EXIF付きの元画像を作り、DPI情報なしの出力(canvas相当)へ dpi.js で書き戻して比較。"""
import os, subprocess, json, io
from PIL import Image

root = os.path.dirname(os.path.abspath(__file__)); out = os.path.join(root, 'out'); os.makedirs(out, exist_ok=True)
base = Image.open(os.path.join(root, '..', 'samples', 'sample1.jpg')).convert('RGB')
cases = []
for name, dpi, exif in [('a.jpg', (300, 300), False), ('b.jpg', (72, 72), False), ('c.jpg', (350, 350), True), ('d.png', (400, 400), False), ('e.png', (96, 96), False)]:
    src = os.path.join(out, 'src_' + name)
    kw = {'dpi': dpi}
    if exif:
        ex = Image.Exif(); ex[0x011A] = 350; ex[0x011B] = 350; ex[0x0128] = 2; kw['exif'] = ex
    base.save(src, **kw)
    plain = os.path.join(out, 'plain_' + name)      # DPI情報なし(canvas出力相当)
    base.save(plain)
    cases.append({'name': name, 'src': src, 'plain': plain, 'dst': os.path.join(out, 'dst_' + name)})
json.dump(cases, open(os.path.join(out, 'dpi_cases.json'), 'w'))
r = subprocess.run(['node', os.path.join(root, 'dpi_test.js'), os.path.join(out, 'dpi_cases.json')], capture_output=True, text=True, encoding='utf-8')
print(r.stdout, r.stderr)
for c in cases:
    s, d, p = Image.open(c['src']), Image.open(c['dst']), Image.open(c['plain'])
    sd = tuple(round(v) for v in s.info.get('dpi', (0, 0))); dd = tuple(round(v) for v in d.info.get('dpi', (0, 0)))
    print(c['name'], 'src', sd, 'plain', p.info.get('dpi'), 'dst', dd, 'OK' if sd == dd else 'MISMATCH', d.size == s.size)
