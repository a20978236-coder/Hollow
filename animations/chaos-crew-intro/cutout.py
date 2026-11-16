"""Separate the four characters from the flattened reference into RGBA layers (layers/<name>.png).
Guide polygons are hand-traced in reference-pixel coordinates; GrabCut refines the edge to the white sticker outline."""
import cv2, numpy as np, json
from PIL import Image
ref = cv2.imread('refs/chaos-crew-reference.png')
H, W = ref.shape[:2]
POLY = {
 'echo':  [(173,396),(205,404),(232,420),(250,450),(247,474),(255,520),(265,567),(265,595),(255,615),(256,682),(95,682),(92,613),(48,598),(52,540),(78,505),(98,458),(110,428),(137,408)],
 'luck':  [(335,428),(352,395),(390,374),(470,370),(520,392),(545,425),(556,452),(558,500),(572,541),(596,562),(609,614),(597,660),(588,714),(560,735),(512,742),(502,815),(298,815),(290,728),(238,705),(237,668),(256,622),(284,553),(306,518),(330,512),(325,468),(320,445)],
 'hollow':[(686,400),(708,400),(716,412),(782,413),(816,442),(836,480),(860,520),(886,575),(884,640),(882,700),(848,752),(822,764),(816,800),(774,800),(768,760),(720,722),(700,692),(647,665),(646,626),(668,598),(646,545),(656,493),(675,450),(690,425)],
 'light': [(962,430),(1000,455),(1040,440),(1062,412),(1088,412),(1110,436),(1150,450),(1185,462),(1197,500),(1197,552),(1172,606),(1180,655),(1170,735),(1197,756),(1172,820),(1040,820),(1015,800),(936,800),(930,764),(850,760),(848,712),(884,672),(888,596),(960,588),(952,548),(956,500)],
}
# saturated doodles/labels (red marks, blue ?!, white crosses outside) are never character pixels near edges
hsv = cv2.cvtColor(ref, cv2.COLOR_BGR2HSV)
red = (((hsv[...,0] < 8) | (hsv[...,0] > 172)) & (hsv[...,1] > 170) & (hsv[...,2] > 150))
info = {}
for name, pts in POLY.items():
    poly = np.zeros((H, W), np.uint8); cv2.fillPoly(poly, [np.array(pts, np.int32)], 255)
    grow = cv2.dilate(poly, np.ones((15,15), np.uint8)); core = cv2.erode(poly, np.ones((31,31), np.uint8))
    mask = np.full((H, W), cv2.GC_BGD, np.uint8)
    mask[grow > 0] = cv2.GC_PR_BGD
    mask[poly > 0] = cv2.GC_PR_FGD
    mask[core > 0] = cv2.GC_FGD
    if name in ('luck', 'light'):  # red doodle marks sit right against their outlines
        mask[(red) & (core == 0)] = cv2.GC_BGD
    bg = np.zeros((1,65), np.float64); fg = np.zeros((1,65), np.float64)
    cv2.grabCut(ref, mask, None, bg, fg, 6, cv2.GC_INIT_WITH_MASK)
    alpha = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    alpha[grow == 0] = 0
    # keep the largest component, fill holes, soften the edge 1px
    n, lab, st, _ = cv2.connectedComponentsWithStats(alpha)
    if n > 1: alpha = np.where(lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]), 255, 0).astype(np.uint8)
    inv = cv2.bitwise_not(alpha); n, lab, st, _ = cv2.connectedComponentsWithStats(inv)
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if a < 4000 and x > 0 and y > 0 and x + w < W and y + h < H: alpha[lab == i] = 255
    alpha = cv2.GaussianBlur(alpha, (3,3), 0)
    ys, xs = np.nonzero(alpha); x0, x1, y0, y1 = xs.min(), xs.max()+1, ys.min(), ys.max()+1
    rgba = np.dstack([cv2.cvtColor(ref, cv2.COLOR_BGR2RGB), alpha])[y0:y1, x0:x1]
    Image.fromarray(rgba).save(f'layers/{name}.png')
    info[name] = {'x': int(x0), 'y': int(y0), 'w': int(x1-x0), 'h': int(y1-y0)}
    print(name, info[name])
json.dump(info, open('layers/placement.json', 'w'), indent=1)
