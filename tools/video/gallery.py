from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, shutil
G='gal/'; OUT='/mnt/user-data/outputs/devpost-gallery/'
W,H=1800,1200
Q=ImageFont.truetype('fonts/Quicksand.ttf',50); QS=ImageFont.truetype('fonts/Quicksand.ttf',38)
def crop32(im, cx=0.5):
    W0,H0=im.size; tw=int(H0*3/2); x=int(max(0,min(W0-tw,cx*W0-tw/2))); return im.crop((x,0,x+tw,H0))
def load(n): return Image.open(G+n+'.png').convert('RGB')
def band(im, text, font=Q, margin=48):
    im=im.convert('RGBA'); d=ImageDraw.Draw(im)
    w=d.textlength(text,font=font); asc,desc=font.getmetrics(); th=asc+desc
    x=(im.size[0]-w)/2; y=im.size[1]-margin-th
    box=Image.new('RGBA',im.size,(0,0,0,0)); ImageDraw.Draw(box).rounded_rectangle((x-30,y-14,x+w+30,y+th+10),radius=(th+24)//2,fill=(22,15,10,165))
    im=Image.alpha_composite(im,box); ImageDraw.Draw(im).text((x,y),text,font=font,fill=(255,248,236,255))
    return im
def single(n,cx,text,name):
    im=crop32(load(n),cx).resize((W,H),Image.LANCZOS); band(im,text).convert('RGB').save(OUT+name,quality=92)
def pair(a,ca,ta,b,cb,tb,name):
    S=Image.new('RGB',(W,H),(20,14,10))
    for i,(n,c,t) in enumerate(((a,ca,ta),(b,cb,tb))):
        im=load(n); W0,H0=im.size; tw=int(H0*0.75); x=int(max(0,min(W0-tw,c*W0-tw/2)))
        half=im.crop((x,0,x+tw,H0)).resize((W//2-3,H),Image.LANCZOS)
        S.paste(band(half,t,QS,40).convert('RGB'),(i*(W//2+3),0))
    S.save(OUT+name,quality=92)
def grid(items,name):
    S=Image.new('RGB',(W,H),(20,14,10))
    for i,(n,c,t) in enumerate(items):
        im=crop32(load(n),c).resize((W//2-3,H//2-3),Image.LANCZOS)
        S.paste(band(im,t,QS,28).convert('RGB'),((i%2)*(W//2+3),(i//2)*(H//2+3)))
    S.save(OUT+name,quality=92)
shutil.copy('/mnt/user-data/outputs/video/thumbnail-3x2.jpg',OUT+'01-cover.jpg')
single('open',0.5,'A little garden on a table: seated, hands only','02-arrival.jpg')
single('prune2',0.55,'Trim the glowing shoots to shape your bonsai','03-pruning.jpg')
pair('wilt',0.45,'Too much water: it droops','recover',0.45,'One breath later: well again','04-wilted-and-recovered.jpg')
single('cut',0.5,'A wrong cut leaves a stump. The tree never dies.','05-wrong-cut.jpg')
pair('invite',0.5,'A short break, offered','eyes',0.5,'Eyes closed, a few guided breaths','06-breathing-break.jpg')
grid([('spring',0.5,'Spring'),('summer',0.5,'Summer'),('autumn',0.5,'Autumn'),('winter',0.5,'Winter')],'07-four-seasons.jpg')
single('night',0.5,'Night, rain and fireflies follow your real clock','08-night-rain.jpg')
pair('comfort',0.3,'High contrast, one hand, a movable table','hold',0.55,'Hold to select: no pinch needed','09-comfort.jpg')
single('ret',0.5,'Come back: a daily gift and days in a row','10-return.jpg')
single('shared',0.55,'One tree shared by every visitor','11-shared-tree.jpg')
for f in sorted(os.listdir(OUT)): print(f, Image.open(OUT+f).size, round(os.path.getsize(OUT+f)/1e6,2))
