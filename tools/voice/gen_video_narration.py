import json, subprocess, soundfile as sf
from kokoro_onnx import Kokoro
OUT='/tmp/claude-0/-home-claude/d75070d6-7e31-5318-8cc2-7094951c1321/scratchpad/video/narr'
L = [
 ('n01','This is Bloom Break. A breathing break, with a little bonsai.'),
 ('n02','A small garden, all around you. You stay seated, and use only your hands.'),
 ('n03','A firefly shows each gesture in light. Pinch the seed to plant it.'),
 ('n04','Tilt the can to pour, and your tree begins to grow.'),
 ('n05','Trim the glowing shoots, one by one, to shape your bonsai.'),
 ('n06','In less than three minutes, it blooms.'),
 ('n07','Care matters. Too much water, and the leaves turn yellow and droop.'),
 ('n08','Cut a healthy branch, and the tree grows tense.'),
 ('n09','But it never dies. Breathing with it brings it back.'),
 ('n10','Every few minutes, a short pause. Close your eyes, and breathe.'),
 ('n11','When you open them, the garden has changed.'),
 ('n12','It follows your real season, and your time of day.'),
 ('n13','Choose a three, five, or ten minute break. Hold to select, one hand, high contrast. Subtitles, always on.'),
 ('n14','No pinch? Just look, or hold your hand still.'),
 ('n15','Come back tomorrow, for a daily gift, and new levels.'),
 ('n16','And one big tree, shared by everyone who visits.'),
 ('n17','Bloom Break. Take a breath.'),
]
k=Kokoro("kokoro-v1.0.int8.onnx","voices-v1.0.bin")
trim="silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,adelay=0|0"
man={}
for i,t in L:
    s,sr=k.create(t,voice='af_nicole',speed=0.9,lang='en-us'); sf.write('tmp.wav',s,sr)
    p=f'{OUT}/{i}.wav'
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i','tmp.wav','-af',trim+',highpass=f=80,lowpass=f=10000,aecho=0.8:0.4:50:0.08,loudnorm=I=-16','-ar','48000','-ac','2',p],check=True)
    d=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p]))
    man[i]={'text':t,'sec':round(d,2)}; print(i,round(d,1),flush=True)
json.dump(man,open(OUT+'/narr.json','w'),indent=1)
print('total',round(sum(v['sec'] for v in man.values()),1))
