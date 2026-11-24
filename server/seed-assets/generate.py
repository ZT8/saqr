# Generates flat illustrated demo photos for seed posts (no external assets).
from PIL import Image, ImageDraw, ImageFilter
import random, sys
out = sys.argv[1]
W, H = 1080, 1350
def bg(c1, c2):
    im = Image.new('RGB', (W, H), c1)
    d = ImageDraw.Draw(im)
    # table surface
    d.rectangle([0, int(H*0.62), W, H], fill=c2)
    return im, d
def cup(d, cx, cy, s, body, lid, sleeve):
    d.polygon([(cx-140*s, cy-200*s), (cx+140*s, cy-200*s), (cx+105*s, cy+220*s), (cx-105*s, cy+220*s)], fill=body)
    d.rounded_rectangle([cx-160*s, cy-250*s, cx+160*s, cy-195*s], radius=int(20*s), fill=lid)
    d.polygon([(cx-128*s, cy-40*s), (cx+128*s, cy-40*s), (cx+116*s, cy+90*s), (cx-116*s, cy+90*s)], fill=sleeve)
def iced(d, cx, cy, s):
    d.polygon([(cx-130*s, cy-230*s), (cx+130*s, cy-230*s), (cx+100*s, cy+230*s), (cx-100*s, cy+230*s)], fill=(238,236,230))
    d.polygon([(cx-122*s, cy-60*s), (cx+122*s, cy-60*s), (cx+102*s, cy+222*s), (cx-102*s, cy+222*s)], fill=(160,110,70))
    d.polygon([(cx-126*s, cy-150*s), (cx+126*s, cy-150*s), (cx+122*s, cy-60*s), (cx-122*s, cy-60*s)], fill=(244,236,220))
    for i in range(5):
        x = cx + random.randint(-80,80)*s; y = cy + random.randint(-140,-70)*s
        d.rounded_rectangle([x-28*s, y-28*s, x+28*s, y+28*s], radius=int(8*s), fill=(250,250,252))
    d.rectangle([cx+30*s, cy-380*s, cx+52*s, cy-150*s], fill=(242,140,40))
def burger(d, cx, cy, s):
    d.chord([cx-220*s, cy-230*s, cx+220*s, cy+40*s], 180, 360, fill=(214,150,70))
    for i in range(14):
        x = cx + random.randint(-150,150)*s; y = cy + random.randint(-170,-110)*s
        d.ellipse([x-8*s, y-5*s, x+8*s, y+5*s], fill=(250,236,200))
    d.rounded_rectangle([cx-235*s, cy-95*s, cx+235*s, cy-55*s], radius=int(20*s), fill=(110,170,60))
    d.rounded_rectangle([cx-215*s, cy-60*s, cx+215*s, cy-25*s], radius=int(12*s), fill=(250,200,40))
    d.rounded_rectangle([cx-225*s, cy-30*s, cx+225*s, cy+40*s], radius=int(30*s), fill=(95,55,35))
    d.rounded_rectangle([cx-210*s, cy+40*s, cx+210*s, cy+120*s], radius=int(30*s), fill=(214,150,70))
def croissant(d, cx, cy, s):
    for i, w in enumerate([260, 210, 160, 110]):
        off = i*70*s
        d.ellipse([cx-w*s, cy-70*s+0, cx+w*s, cy+70*s], fill=(218,150,70) if i%2==0 else (200,130,55))
    d.ellipse([cx-260*s, cy-70*s, cx+260*s, cy+70*s], outline=(170,105,40), width=int(6*s))
def juice(d, cx, cy, s, color):
    d.polygon([(cx-120*s, cy-240*s), (cx+120*s, cy-240*s), (cx+95*s, cy+230*s), (cx-95*s, cy+230*s)], fill=(240,240,236))
    d.polygon([(cx-112*s, cy-170*s), (cx+112*s, cy-170*s), (cx+97*s, cy+222*s), (cx-97*s, cy+222*s)], fill=color)
    d.ellipse([cx+60*s, cy-300*s, cx+200*s, cy-160*s], fill=(250,210,60)); d.ellipse([cx+80*s, cy-280*s, cx+180*s, cy-180*s], fill=(255,236,150))
def cake(d, cx, cy, s):
    d.rounded_rectangle([cx-200*s, cy-120*s, cx+200*s, cy+140*s], radius=int(24*s), fill=(245,225,200))
    d.rectangle([cx-200*s, cy-10*s, cx+200*s, cy+20*s], fill=(150,90,60))
    d.rounded_rectangle([cx-205*s, cy-150*s, cx+205*s, cy-100*s], radius=int(24*s), fill=(242,140,40))
    for i in range(6):
        x = cx-160*s + i*64*s
        d.ellipse([x-18*s, cy-190*s, x+18*s, cy-150*s], fill=(200,40,60))
def plate(d, cx, cy, s):
    d.ellipse([cx-330*s, cy+120*s, cx+330*s, cy+260*s], fill=(250,250,248))
scenes = [
 ('latte', (232,224,210), (196,170,140), lambda d: (plate(d,540,780,1.1), cup(d,540,700,1.2,(250,248,244),(20,32,27),(176,122,74)))),
 ('iced', (210,226,220), (120,150,140), lambda d: (iced(d,540,760,1.25))),
 ('burger', (250,230,200), (90,60,45), lambda d: (plate(d,540,770,1.2), burger(d,540,820,1.3))),
 ('croissant', (236,226,206), (160,120,90), lambda d: (plate(d,540,780,1), croissant(d,540,860,1.1))),
 ('juice', (255,236,220), (220,150,110), lambda d: (juice(d,540,760,1.25,(242,140,40)))),
 ('cake', (246,232,236), (180,140,150), lambda d: (plate(d,540,770,1.1), cake(d,540,820,1.2))),
 ('karak', (240,230,214), (120,90,70), lambda d: (cup(d,420,760,0.9,(250,248,244),(242,140,40),(122,62,6)), cup(d,700,780,0.9,(250,248,244),(242,140,40),(122,62,6)))),
 ('green', (220,232,222), (60,90,80), lambda d: (juice(d,540,760,1.25,(110,170,80)))),
]
random.seed(7)
for name, c1, c2, draw in scenes:
    im, d = bg(c1, c2)
    draw(d)
    im = im.filter(ImageFilter.GaussianBlur(0.6))
    im.save(f'{out}/{name}.jpg', quality=86)
print('ok')
