import json, subprocess, os, soundfile as sf
from kokoro_onnx import Kokoro
NEW = {
  'breakLengthAsk': ('firefly', 'How long is your break today? Choose a time.'),
  'breakAlmostOver': ('firefly', 'One more minute. Finish what you are doing.'),
  'breakEnd': ('narrator', 'Your break is over. Take this calm with you.'),
  'seeYouTomorrow': ('firefly', 'See you tomorrow. Your tree will be waiting.'),
  'keepGoing': ('firefly', 'Want more time? You can stay as long as you like.'),
  'streakUp': ('firefly', 'Another day in a row! Your tree loves the routine.'),
  'tableHint': ('firefly', 'Table too high or far? Poke Comfort to move it.'),
}
OUT = '/mnt/user-data/outputs/voci/pack2'
os.makedirs(OUT + '/narrator', exist_ok=True); os.makedirs(OUT + '/firefly', exist_ok=True)
man = json.load(open('/mnt/user-data/uploads/Documents/zen-garden-vr/public/voices/manifest.json'))
k = Kokoro("kokoro-v1.0.int8.onnx", "voices-v1.0.bin")
trim = "silenceremove=start_periods=1:start_threshold=-50dB:stop_periods=1:stop_threshold=-50dB:stop_duration=0.3"
for id_, (d, text) in NEW.items():
    nar = d == 'narrator'
    s, sr = k.create(text, voice='af_nicole' if nar else 'am_puck', speed=0.85 if nar else 1.1, lang='en-us')
    sf.write('tmp.wav', s, sr)
    af = f"{trim},highpass=f=70,lowpass=f=9500,aecho=0.8:0.5:60:0.12,loudnorm=I=-18" if nar else f"{trim},asetrate=24000*1.38,aresample=24000,atempo=0.7246,aecho=0.7:0.4:35:0.18,loudnorm=I=-18"
    p = f"{OUT}/{d}/{id_}.mp3"
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', 'tmp.wav', '-af', af, '-ac', '1', '-ar', '24000', '-b:a', '64k', p], check=True)
    dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p]))
    man[id_] = {'voice': d, 'file': f"{d}/{id_}.mp3", 'seconds': round(dur, 2)}
    print(id_, d, round(dur, 1), flush=True)
json.dump(man, open(OUT + '/manifest.json', 'w'), indent=1)
print(len(man))
