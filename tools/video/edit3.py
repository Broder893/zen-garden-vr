"""Bloom Break demo v3: narration (Nicole), captions = narration, game audio ducked, soft dissolves.
Usage: python3 edit3.py <clip_dir> <narr_dir> <out.mp4>"""
import subprocess, os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
SRC, NARR, OUTFILE = sys.argv[1], sys.argv[2], sys.argv[3]
HERE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(HERE, 'build3'); os.makedirs(B, exist_ok=True)
import importlib.util
# reuse caption/title helpers from edit2 without running it
src2 = open(os.path.join(HERE, 'edit2.py')).read()
helpers = src2[src2.index('def alpha('):src2.index('def encode(')]
SHIP, QUICK = HERE + '/fonts/Shippori.ttf', HERE + '/fonts/Quicksand.ttf'
CAP = '/usr/share/fonts/opentype/inter/Inter-Medium.otf'
from PIL import Image, ImageDraw, ImageFont, ImageFilter
exec(helpers)
NJ = json.load(open(os.path.join(NARR, 'narr.json')))
XF, XF_SEASON = 0.6, 0.9

# clip, src_start, src_dur, speed, captions[(a,b,text)], narration[(id, at)]
SEG = json.load(open(os.path.join(HERE, 'seg3.json')))
SEASON_IDX = set(json.load(open(os.path.join(HERE, 'seg3_seasons.json'))))

def encode(i, clip, ss, dur, speed, caps, overlay=None, ov_in=0, ov_out=0):
    out_d = dur / speed
    vf = [f"setpts=(PTS-STARTPTS)/{speed}", "fps=30", "scale=1920:1080", "format=yuv420p"]
    vf += [caption(f'{B}/c{i}_{k}.txt', t, a, b) for k, (a, b, t) in enumerate(caps)]
    af = [f"atempo={speed}" if speed != 1 else "anull", "aresample=48000"]
    out = f'{B}/seg{i:02d}.mp4'
    path = f'{SRC}/{clip}.mp4' if os.path.exists(f'{SRC}/{clip}.mp4') else f'{SRC}/{clip}.webm'
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(ss), '-t', str(dur), '-i', path]
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
                  ("Recorded in Meta's IWER WebXR emulator with simulated hands. Narration: Kokoro TTS.", 28, 960, (250, 250, 250, 245))])
parts, narr = [], []
for i, s in enumerate(SEG):
    clip, ss, dur, speed, caps, nar = s
    o = encode(i, clip, ss, dur, speed, caps, overlay=f'{B}/title.png' if i == 0 else None, ov_in=1.8, ov_out=7.0)
    parts.append(o); narr.append(nar)
    print('seg', i, clip, round(o[1], 2), flush=True)
end_out = f'{B}/seg99.mp4'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '2.5', '-t', '7.5', '-i', f'{SRC}/v08-season-spring.webm',
    '-loop', '1', '-t', '7.5', '-i', f'{B}/end.png', '-filter_complex',
    "[0:v]fps=30,scale=1920:1080,boxblur=16:2,eq=brightness=-0.12:saturation=0.85,format=yuv420p[b];"
    "[1:v]format=rgba,fade=t=in:st=0.5:d=1.0:alpha=1[t];[b][t]overlay=0:0:format=auto,fade=t=out:st=6.3:d=1.2,format=yuv420p[v]",
    '-map', '[v]', '-map', '0:a', '-af', 'aresample=48000,volume=0.6,afade=t=out:st=5.5:d=2.0',
    '-t', '7.5', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-ar', '48000', end_out], check=True)
parts.append((end_out, 7.5)); narr.append([['n17', 1.2]])

# picture + game audio with dissolves; record each segment's start on the final timeline
inputs = []
for p, _ in parts: inputs += ['-i', p]
fc, vlast, alast, t, starts = [], '[0:v]', '[0:a]', parts[0][1], [0.0]
for k in range(1, len(parts)):
    d = XF_SEASON if (k in SEASON_IDX or k - 1 in SEASON_IDX) else XF
    off = t - d; starts.append(off)
    fc.append(f"{vlast}[{k}:v]xfade=transition=fade:duration={d}:offset={off:.3f}[v{k}]")
    fc.append(f"{alast}[{k}:a]acrossfade=d={d}:c1=tri:c2=tri[a{k}]")
    vlast, alast = f'[v{k}]', f'[a{k}]'
    t = off + parts[k][1]
total = t
fc.append(f"{vlast}fade=t=in:st=0:d=1.2[vout]")
# narration track
n_in, n_lbl, idx = [], [], len(parts)
for k, lst in enumerate(narr):
    for nid, at in lst:
        ms = int((starts[k] + at) * 1000)
        n_in += ['-i', os.path.join(NARR, nid + '.wav')]
        fc.append(f"[{idx}:a]aresample=48000,adelay={ms}|{ms}[n{idx}]")
        n_lbl.append(f'[n{idx}]'); idx += 1
        print('narr', nid, round(starts[k] + at, 2), '->', round(starts[k] + at + NJ[nid]['sec'], 2))
fc.append(f"{''.join(n_lbl)}amix=inputs={len(n_lbl)}:normalize=0,apad,atrim=0:{total:.3f},asplit=2[nar][key]")
fc.append(f"{alast}afade=t=in:st=0:d=1.2,volume=0.55[game]")
fc.append("[game][key]sidechaincompress=threshold=0.02:ratio=6:attack=80:release=600[duck]")
fc.append("[duck][nar]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]")
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, *n_in, '-filter_complex', ';'.join(fc), '-map', '[vout]', '-map', '[aout]',
                '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-r', '30', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', OUTFILE], check=True)
dd = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', OUTFILE]))
print('DURATION', round(dd, 2), 'MB', round(os.path.getsize(OUTFILE) / 1e6, 1))
