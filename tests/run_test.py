"""サンプル画像で core.js を検証し、位置合わせ結果のプレビューを tests/out に出力する。
使い方: python tests/run_test.py [画像フォルダ]
"""
import sys, os, json, subprocess, glob
import numpy as np
from PIL import Image

root = os.path.dirname(os.path.abspath(__file__))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, '..', 'samples')
out = os.path.join(root, 'out'); os.makedirs(out, exist_ok=True)
files = sorted(f for f in glob.glob(os.path.join(src, '*')) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp')))

# Node 側へ渡す raw 画像
meta = []
for i, f in enumerate(files):
    im = Image.open(f).convert('RGBA')
    p = os.path.join(out, f'raw{i}.bin')
    open(p, 'wb').write(im.tobytes())
    meta.append({'name': os.path.basename(f), 'w': im.width, 'h': im.height, 'raw': p})
json.dump(meta, open(os.path.join(out, 'meta.json'), 'w'))
r = subprocess.run(['node', os.path.join(root, 'run_test.js'), os.path.join(out, 'meta.json')], capture_output=True, text=True, encoding='utf-8')
print(r.stdout, r.stderr)
res = json.load(open(os.path.join(out, 'result.json')))
if not res['plan']['canvas']:
    sys.exit('no plan')
W, H = res['plan']['canvas']['w'], res['plan']['canvas']['h']
for ok in res['plan']['ok']:
    im = Image.open(files[ok['index']]).convert('RGB')
    a, b, c, d, e, f = ok['matrix']
    det = a * d - b * c
    # PIL は 出力->入力 の逆行列を要求
    ia, ib, ic, id_ = d / det, -b / det, -c / det, a / det
    ie = -(ia * e + ic * f); if_ = -(ib * e + id_ * f)
    o = im.transform((W, H), Image.AFFINE, (ia, ic, ie, ib, id_, if_), resample=Image.BICUBIC, fillcolor=(255, 255, 255))
    o.save(os.path.join(out, f'aligned{ok["index"]}.png'))
# 上辺の重ね合わせ確認用(全ページの最小値合成)
stack = [np.array(Image.open(os.path.join(out, f'aligned{o["index"]}.png'))) for o in res['plan']['ok']]
Image.fromarray(np.min(stack, axis=0).astype(np.uint8)).save(os.path.join(out, 'overlay_min.png'))
print('canvas', W, H)
