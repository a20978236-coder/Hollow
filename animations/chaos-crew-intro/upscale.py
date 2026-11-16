"""2x Lanczos upscale + mild unsharp of every layer (the source characters are only ~230-370 px wide), and the moon crop."""
from PIL import Image, ImageFilter, ImageDraw
for n in ['echo', 'luck', 'hollow', 'light', 'title']:
    im = Image.open(f'layers/{n}.png')
    big = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
    r, g, b, a = big.split()
    rgb = Image.merge('RGB', (r, g, b)).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    Image.merge('RGBA', (*rgb.split(), a)).save(f'layers/{n}@2x.png')
ref = Image.open('refs/chaos-crew-reference.png').convert('RGBA')
cx, cy, r = 834, 158, 70
m = Image.new('L', ref.size, 0); ImageDraw.Draw(m).ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
ref.putalpha(m.filter(ImageFilter.GaussianBlur(2))); ref.crop((cx - r - 4, cy - r - 4, cx + r + 4, cy + r + 4)).save('layers/moon.png')
