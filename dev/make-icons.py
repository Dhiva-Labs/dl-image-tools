#!/usr/bin/env python3
"""Generate DL Image Tools icons: rounded indigo tile with a white photo glyph."""
from PIL import Image, ImageDraw

SIZES = [16, 32, 48, 128, 512]
BG_TOP = (79, 70, 229)     # indigo-600
BG_BOTTOM = (124, 58, 237) # violet-600
S = 512

img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# vertical gradient background
grad = Image.new('RGBA', (S, S))
gd = ImageDraw.Draw(grad)
for y in range(S):
    t = y / S
    c = tuple(int(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM)) + (255,)
    gd.line([(0, y), (S, y)], fill=c)
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=104, fill=255)
img.paste(grad, (0, 0), mask)

# photo frame glyph
d = ImageDraw.Draw(img)
fx0, fy0, fx1, fy1 = 108, 128, 404, 384
d.rounded_rectangle([fx0, fy0, fx1, fy1], radius=28, outline=(255, 255, 255, 255), width=22)
# sun
d.ellipse([160, 178, 226, 244], fill=(255, 255, 255, 255))
# mountains (clipped inside frame)
inner = Image.new('L', (S, S), 0)
ImageDraw.Draw(inner).rounded_rectangle([fx0 + 11, fy0 + 11, fx1 - 11, fy1 - 11], radius=18, fill=255)
mount = Image.new('RGBA', (S, S), (0, 0, 0, 0))
md = ImageDraw.Draw(mount)
md.polygon([(fx0, fy1), (232, 236), (330, 340), (388, 282), (fx1, 330), (fx1, fy1)], fill=(255, 255, 255, 255))
img.paste(mount, (0, 0), Image.composite(mount.split()[3], Image.new('L', (S, S), 0), inner))

for size in SIZES:
    out = img.resize((size, size), Image.LANCZOS)
    out.save(f'public/icons/icon{size}.png')
print('icons written:', SIZES)
