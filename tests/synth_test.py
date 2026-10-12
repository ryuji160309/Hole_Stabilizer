"""合成テスト: 鉛筆の重なり・片側バー欠損・高解像度での検出を確認する。"""
import os, subprocess, random
from PIL import Image, ImageDraw

root = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(root, 'out', 'synth'); os.makedirs(out, exist_ok=True)
for f in os.listdir(out): os.remove(os.path.join(out, f))
base = Image.open(os.path.join(root, '..', 'samples', 'sample1.jpg')).convert('RGB')   # きれいな原本
random.seed(1)

# a) 左バーを消す(推定フォールバック)
a = base.copy(); ImageDraw.Draw(a).rectangle((120, 20, 210, 55), fill=(255, 255, 255)); a.save(os.path.join(out, 'a_left_bar_missing.png'))
# b) 左バーに濃い鉛筆線を何本も重ねる
b = base.copy(); d = ImageDraw.Draw(b)
for _ in range(14):
    x0 = random.randint(120, 215); y0 = random.randint(10, 60); x1 = random.randint(100, 240); y1 = random.randint(10, 70)
    d.line((x0, y0, x1, y1), fill=(60, 60, 60), width=3)
b.save(os.path.join(out, 'b_scribble_on_bar.png'))
# c) 円の周りにも鉛筆
c = b.copy(); d = ImageDraw.Draw(c)
for _ in range(6):
    d.line((random.randint(480, 540), random.randint(15, 60), random.randint(470, 560), random.randint(10, 70)), fill=(90, 90, 90), width=2)
c.save(os.path.join(out, 'c_scribble_bar_and_circle.png'))
# d) 3倍の高解像度 + 線
dd = b.resize((b.width * 3, b.height * 3), Image.LANCZOS); dd.save(os.path.join(out, 'd_hires_scribble.png'))
# e) 右バーを消す
e = base.copy(); ImageDraw.Draw(e).rectangle((810, 20, 910, 55), fill=(255, 255, 255)); e.save(os.path.join(out, 'e_right_bar_missing.png'))
# f) タップなし(白紙+罫線)→ 未検出になるべき
f = Image.new('RGB', (1024, 719), (255, 255, 255)); ImageDraw.Draw(f).rectangle((100, 170, 920, 630), outline=(0, 0, 0), width=2); f.save(os.path.join(out, 'f_no_peg.png'))
print(subprocess.run(['python', os.path.join(root, 'run_test.py'), out], capture_output=True, text=True, encoding='utf-8').stdout)
