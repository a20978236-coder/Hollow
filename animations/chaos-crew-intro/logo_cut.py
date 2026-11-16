"""Extract the CHAOS CREW logo (incl. crown, star, sparks) from the reference as layers/title.png."""
import cv2, numpy as np
from PIL import Image
ref = cv2.imread('refs/chaos-crew-reference.png'); hsv = cv2.cvtColor(ref, cv2.COLOR_BGR2HSV)
H, W = ref.shape[:2]
zone = np.zeros((H, W), np.uint8)
cv2.fillPoly(zone, [np.array([(225,850),(330,835),(820,770),(905,770),(1000,830),(1060,860),(1070,1010),(900,1070),(880,1215),(330,1215),(250,1050)], np.int32)], 255)
h, s, v = hsv[...,0], hsv[...,1], hsv[...,2]
white = (s < 60) & (v > 150)
blue = (h > 95) & (h < 130) & (s > 90) & (v > 110)
zone[760:848, 520:770] = 0; zone[1192:, :] = 0
ink = ((white | blue) & (zone > 0)).astype(np.uint8) * 255
# pull in the black outline around strokes, then fill enclosed gaps
grown = cv2.dilate(ink, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13,13)))
grown = cv2.morphologyEx(grown, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9,9)))
inv = cv2.bitwise_not(grown); n, lab, st, _ = cv2.connectedComponentsWithStats(inv)
for i in range(1, n):
    if st[i, cv2.CC_STAT_AREA] < 2500: grown[lab == i] = 255
# drop specks
n, lab, st, _ = cv2.connectedComponentsWithStats(grown)
keep = np.zeros_like(grown)
for i in range(1, n):
    if st[i, cv2.CC_STAT_AREA] > 300: keep[lab == i] = 255
alpha = cv2.GaussianBlur(keep, (5,5), 0)
ys, xs = np.nonzero(alpha); x0, x1, y0, y1 = xs.min(), xs.max()+1, ys.min(), ys.max()+1
rgb = cv2.cvtColor(ref, cv2.COLOR_BGR2RGB)
Image.fromarray(np.dstack([rgb, alpha])[y0:y1, x0:x1]).save('layers/title.png')
print('title bbox', x0, y0, x1-x0, y1-y0)
im = Image.open('layers/title.png'); bg = Image.new('RGB', im.size, (255,0,255)); bg.paste(im, (0,0), im); bg.save('work/title_check.png')
