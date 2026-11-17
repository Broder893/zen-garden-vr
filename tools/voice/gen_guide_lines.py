import json, subprocess, os, soundfile as sf
from kokoro_onnx import Kokoro
L=json.load(open('lines.json'))
N={'breatheIntro','breatheIntroEyes','openEyes','breatheIn','breatheHold','breatheOut','breatheSoften','breatheNotice','meditatePaused','meditatePausedDwell','meditateDone','resumed','rest','restDwell','restGaze','meditateHint','meditateHintDwell','recovered','rainStarts','breezeStarts','welcomeBack','welcomeGift'}
OUT='/mnt/user-data/outputs/voci/pack'
os.makedirs(OUT+'/narrator',exist_ok=True);os.makedirs(OUT+'/firefly',exist_ok=True)
k=Kokoro("kokoro-v1.0.int8.onnx","voices-v1.0.bin")
trim="silenceremove=start_periods=1:start_threshold=-50dB:stop_periods=1:stop_threshold=-50dB:stop_duration=0.3"
man={}
for i,(id_,text) in enumerate(L.items()):
    nar=id_ in N
    s,sr=k.create(text,voice='af_nicole' if nar else 'am_puck',speed=0.85 if nar else 1.1,lang='en-us')
    sf.write('tmp.wav',s,sr)
    if nar: af=f"{trim},highpass=f=70,lowpass=f=9500,aecho=0.8:0.5:60:0.12,loudnorm=I=-18"
    else: af=f"{trim},asetrate=24000*1.38,aresample=24000,atempo=0.7246,aecho=0.7:0.4:35:0.18,loudnorm=I=-18"
    d='narrator' if nar else 'firefly'
    p=f"{OUT}/{d}/{id_}.mp3"
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i','tmp.wav','-af',af,'-ac','1','-ar','24000','-b:a','64k',p],check=True)
    dur=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p]))
    man[id_]={'voice':d,'file':f"{d}/{id_}.mp3",'seconds':round(dur,2)}
    print(i,id_,round(dur,1),flush=True)
json.dump(man,open(OUT+'/manifest.json','w'),indent=1)
print('DONE')
