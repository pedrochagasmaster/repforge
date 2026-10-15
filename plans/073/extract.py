"""Extract a minimal public supplement from the existing decoded research files."""
import argparse
import hashlib
import json
from pathlib import Path
from verify import strict_json_loads

FILES = ['source-manifest.json','screenshots.transcribed.json','programs.normalized.json',
         'gym-profile.normalized.json','auto-split.decoded.json','duration.decoded.json']
SPLIT = 'continuation-20261015-split-contract/upperLowerFull.decoded.json'

def extract(source):
    paths=[source/n for n in FILES]+[source.parent/SPLIT]
    raw=[p.read_bytes() for p in paths]
    manifest, answers, programs, gym, auto, duration, split=map(strict_json_loads,raw)
    sources=[{'id':n,'sha256':hashlib.sha256(b).hexdigest()} for n,b in zip(FILES+['upperLowerFull.decoded.json'],raw)]
    sources.append({'id':'Godmode2 archive','sha256':manifest['sha256']})
    sources.extend({'id':f['name'],'sha256':f['sha256']} for f in manifest['files'])
    questionnaire={n:{'value':answers[n]['value'],'sources':answers[n].get('sources',[answers[n].get('source')])} for n in ['creation_mode','goal','days_per_week','split_preference','periodization','experience']}
    questionnaire['workout_length']={'enum':answers['workout_length']['enum'],'label':answers['workout_length']['label'],'source':answers['workout_length']['source']}
    questionnaire['muscle_emphasis']={n:answers['muscle_emphasis'][n] for n in ['prioritized','deprioritized','sources']}
    questionnaire['deload']={'value':answers['deload']['final_observed_value'],'source':answers['deload']['source']}
    p=next(p for p in programs if p['name']=='Godmode2')
    days=[]
    for d in p['blocks'][0]['cycles'][0]['days']:
        day={'kind':d['kind'],'source':d['source']}
        if d['kind']=='training':
            day.update(name=d['label'].split(' @ ')[0],exercises=[{'name':e['name'],'source':e['source'],'sets':[{'type':s['type'],'reps':s['reps'],'rir':s['rir'],'source':s['source']} for s in e['sets']]} for e in d['exercises']])
        days.append(day)
    return {'version':1,'sources':sources,'questionnaire':questionnaire,
        'equipment':[{'name':e['name'],'source':e['source']} for e in gym['equipment']],
        'observation':{'name':p['name'],'source':p['source'],'declaredCycles':p['declared_cycles'],'observedCycles':1,'deload':p['deload'],'days':days},
        'contracts':{'automatic':[{'days':c['days'],'split':c['resolved_split']} for c in auto['automatic_cases']],
            'duration':[{'enum':c['enum'],'rawMicroseconds':c['duration_field_0x08_raw'],'minutes':c['minutes_assuming_Dart_Duration_microseconds']} for c in duration['cases']],
            'splitDays':[{'allocationPc':d['allocation_call_pc'],'fields':{f:[x['name'] for x in v] if isinstance(v,list) else [] for f,v in d['fields'].items() if f in ['0xc','0x10','0x14']}} for d in split['days']]},
        'unknowns':['generation inputs not transactionally controlled','gym selection not shown','post-generation edits unknown','PRNG state unknown','app version not shown','cycles 2 through 7 not exported','distribution and target formulas unresolved','deprioritization is not exclusion','explicit split UI compatibility not established']}

def main():
    a=argparse.ArgumentParser(description=__doc__);a.add_argument('--source-dir',type=Path,required=True);a.add_argument('--out',type=Path,required=True);args=a.parse_args()
    source=args.source_dir.resolve();out=args.out.resolve()
    if out==source.parent or source.parent in out.parents or out in source.parents:
        a.error('output must be outside the private research tree')
    if out.exists(): a.error('output already exists; choose a fresh directory')
    data=extract(source)
    from verify import validate
    validate(data)
    out.mkdir(parents=True)
    (out/'supplement.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    print('extracted supplement.json')

if __name__=='__main__': main()
