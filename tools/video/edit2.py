"""Bloom Break demo, v2: Shippori Mincho title, soft cross-dissolves. Usage: python3 edit2.py <clip_dir> <out.mp4>"""
import subprocess, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
SRC, OUTFILE = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(HERE, 'build2'); os.makedirs(B, exist_ok=True)
SHIP, QUICK = HERE + '/fonts/Shippori.ttf', HERE + '/fonts/Quicksand.ttf'
CAP = '/usr/share/fonts/opentype/inter/Inter-Medium.otf'
XF = 0.6          # cross-dissolve length
XF_SEASON = 0.9   # slower between the seasons

SEG = [  # clip, src_start, src_dur, speed, captions[(a,b,text)]
 ('v01-open', 0, 8, 1.0, []),
 ('v02-look-around', 2, 6.5, 1.0, [(0.8, 5.8, 'A small garden, all around you.')]),
 ('v03-plant', 0, 12.5, 1.0, [(0.8, 5.6, 'Hands only. No controllers.'), (6.1, 11.8, 'The firefly shows each gesture in light.')]),
 ('v04-water-grow', 0, 20, 1.5, [(0.8, 5.2, 'Tilt to pour, and it grows.'), (5.8, 12.6, 'The first breath comes within a minute.')]),
 ('v05-prune', 0, 20, 1.6, [(0.8, 6.0, 'Trim the glowing shoots.'), (6.5, 11.8, 'Every gesture answers back.')]),
 ('v06-bloom', 1.25, 14.25, 1.25, [(3.5, 10.8, 'In bloom within three minutes.')]),
 ('v07-breath-break', 0, 14.5, 1.0, [(0.8, 5.0, 'Every few minutes, a short break.'), (6.0, 13.6, 'Close your eyes. Breathe.')]),
 ('v07-breath-break', 33.5, 10.9, 1.0, [(1.2, 10.0, 'The garden changes while you rest.')]),
 ('v08-season-spring', 1.5, 4, 1.0, [(0.9, 3.2, 'Spring')]),
 ('v09-season-summer', 1.5, 4, 1.0, [(0.9, 3.2, 'Summer')]),
 ('v10-season-autumn', 1.5, 4, 1.0, [(0.9, 3.2, 'Autumn')]),
 ('v11-season-winter', 1.5, 4, 1.0, [(0.9, 3.2, 'Winter')]),
 ('v12-night-rain', 1.5, 4.5, 1.0, [(0.9, 4.0, 'It follows your real season and time of day.')]),
 ('v13-comfort', 0, 20.5, 1.25, [(0.8, 5.4, 'Choose your break: 3, 5 or 10 minutes.'), (5.9, 11.6, 'Hold to select, one hand, high contrast, large text.'), (12.1, 15.8, 'Subtitles are always on.')]),
 ('v14-onehand-gaze', 3, 8.5, 1.0, [(0.8, 7.8, 'No pinch? Hold your hand still, or just look.')]),
 ('v15-wilted-recovery', 0, 20.5, 1.4, [(0.8, 6.8, 'Too much water? It droops, but never dies.'), (7.3, 14.0, 'Breathing with it brings it back.')]),
 ('v16-return', 0, 12.5, 1.0, [(0.8, 11.8, 'Come back tomorrow: a daily gift, days in a row, new levels.')]),
 ('v17-shared-tree', 4, 8, 1.0, [(0.8, 7.4, 'One tree, shared by everyone who visits.')]),
]
SEASON_IDX = {8, 9, 10, 11, 12}

def alpha(a, b, f=0.35):
    return f"if(lt(t,{a}),0,if(lt(t,{a+f}),(t-{a})/{f},if(lt(t,{b-f}),1,if(lt(t,{b}),({b}-t)/{f},0))))"

def caption(path, text, a, b):
    open(path, 'w').write(text)
    return (f"drawtext=fontfile={CAP}:textfile={path}:fontcolor=white:fontsize=44:x=(w-text_w)/2:y=h*0.84-text_h/2"
            f":box=1:boxcolor=black@0.40:boxborderw=22:alpha='{alpha(a, b)}'")

def title_card(path, title_y=104, sub_y=330, sub='a breathing break with a little bonsai', extra=None, band_c=200):
    im = Image.new('RGBA', (1920, 1080), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for y in range(1080):   # soft dark band for legibility, no hard edges
        a = int(120 * max(0.0, 1 - abs(y - band_c) / 260) ** 1.5)
        a2 = int(130 * max(0.0, 1 - abs(y - 985) / 120) ** 1.5) if band_c > 300 else 0
        d.line([(0, y), (1920, y)], fill=(18, 12, 8, max(a, a2)))
    def put(txt, font, y, col):
        nonlocal im
        w = ImageDraw.Draw(im).textlength(txt, font=font)
        sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).text(((1920 - w) / 2, y + 4), txt, font=font, fill=(0, 0, 0, 160))
        im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(7)))
        ImageDraw.Draw(im).text(((1920 - w) / 2, y), txt, font=font, fill=col)
    put('Bloom Break', ImageFont.truetype(SHIP, 156), title_y, (255, 248, 236, 255))
    put(sub, ImageFont.truetype(QUICK, 52), sub_y, (242, 234, 216, 255))
    for txt, size, y, col in (extra or []):
        put(txt, ImageFont.truetype(QUICK, size), y, col)
    im.save(path)

def encode(i, clip, ss, dur, speed, caps, overlay=None, ov_in=0, ov_out=0):
    out_d = dur / speed
    vf = [f"setpts=(PTS-STARTPTS)/{speed}", "fps=30", "scale=1920:1080", "format=yuv420p"]
    vf += [caption(f'{B}/c{i}_{k}.txt', t, a, b) for k, (a, b, t) in enumerate(caps)]
    af = [f"atempo={speed}" if speed != 1 else "anull", "aresample=48000"]
    out = f'{B}/seg{i:02d}.mp4'
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(ss), '-t', str(dur), '-i', f'{SRC}/{clip}.webm']
    if overlay:
        cmd += ['-loop', '1', '-t', f'{out_d:.3f}', '-i', overlay]
        fc = (f"[0:v]{','.join(vf)}[v0];[1:v]format=rgba,fade=t=in:st={ov_in}:d=0.9:alpha=1,"
              f"fade=t=out:st={ov_out}:d=0.9:alpha=1[t];[v0][t]overlay=0:0:format=auto,format=yuv420p[v]")
        cmd += ['-filter_complex', fc, '-map', '[v]', '-map', '0:a', '-af', ','.join(af)]
    else:
        cmd += ['-vf', ','.join(vf), '-af', ','.join(af)]
    cmd += ['-t', f'{out_d:.3f}', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', '30',
            '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-ar', '48000', out]
    subprocess.run(cmd, check=True)
    return out, out_d

title_card(f'{B}/title.png')
title_card(f'{B}/end.png', title_y=236, sub_y=462, sub='Hands only  ·  Seated  ·  5–10 minutes', band_c=420,
           extra=[('broder893.github.io/zen-garden-vr', 46, 560, (255, 226, 160, 255)),
                  ("Recorded in Meta's IWER WebXR emulator with simulated hands.", 30, 960, (250, 250, 250, 245))])

parts = []
for i, s in enumerate(SEG):
    if i == 0:
        parts.append(encode(i, *s, overlay=f'{B}/title.png', ov_in=2.6, ov_out=6.9))
    else:
        parts.append(encode(i, *s))
    print('seg', i, s[0], flush=True)
# end card: blurred spring garden with the closing text
end_out = f'{B}/seg99.mp4'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '2.5', '-t', '7.5', '-i', f'{SRC}/v08-season-spring.webm',
    '-loop', '1', '-t', '7.5', '-i', f'{B}/end.png', '-filter_complex',
    "[0:v]fps=30,scale=1920:1080,boxblur=16:2,eq=brightness=-0.12:saturation=0.85,format=yuv420p[b];"
    "[1:v]format=rgba,fade=t=in:st=0.5:d=1.0:alpha=1[t];[b][t]overlay=0:0:format=auto,fade=t=out:st=6.3:d=1.2,format=yuv420p[v]",
    '-map', '[v]', '-map', '0:a', '-af', 'aresample=48000,volume=0.6,afade=t=out:st=5.5:d=2.0',
    '-t', '7.5', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-ar', '48000', end_out], check=True)
parts.append((end_out, 7.5))

# chain soft cross-dissolves (video) and crossfades (audio)
inputs = []
for p, _ in parts:
    inputs += ['-i', p]
fc, vlast, alast, t = [], '[0:v]', '[0:a]', parts[0][1]
for k in range(1, len(parts)):
    d = XF_SEASON if (k in SEASON_IDX or k - 1 in SEASON_IDX) and k <= 13 else XF
    off = t - d
    fc.append(f"{vlast}[{k}:v]xfade=transition=fade:duration={d}:offset={off:.3f}[v{k}]")
    fc.append(f"{alast}[{k}:a]acrossfade=d={d}:c1=tri:c2=tri[a{k}]")
    vlast, alast = f'[v{k}]', f'[a{k}]'
    t = off + parts[k][1]
fc.append(f"{vlast}fade=t=in:st=0:d=1.2[vout]")
fc.append(f"{alast}afade=t=in:st=0:d=1.2,loudnorm=I=-14:TP=-1.5:LRA=11[aout]")
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(fc), '-map', '[vout]', '-map', '[aout]',
                '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-r', '30', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', OUTFILE], check=True)
dd = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', OUTFILE]))
print('DURATION', round(dd, 2), 'MB', round(os.path.getsize(OUTFILE) / 1e6, 1))
