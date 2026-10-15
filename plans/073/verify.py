"""Validate the public S0 artifact without private files or extractor imports."""
import argparse
import hashlib
import json
import re
from pathlib import Path

def strict_json_loads(raw):
    def unique_object(pairs):
        result={}
        for key,value in pairs:
            if key in result:
                raise ValueError('duplicate JSON key')
            result[key]=value
        return result
    return json.loads(raw,object_pairs_hook=unique_object)

def require(ok,message):
    if not ok: raise ValueError(message)

def shape(value,schema,path='root'):
    if isinstance(schema,dict):
        require(type(value) is dict and set(value)==set(schema),path+' exact fields')
        for k,s in schema.items(): shape(value[k],s,path+'.'+k)
    elif isinstance(schema,list):
        require(type(value) is list,path+' list')
        for v in value: shape(v,schema[0],path+'[]')
    elif schema=='number': require(type(value) in (int,float),path+' number')
    elif schema=='nullable': require(value is None or type(value) in (str,int),path+' nullable')
    else: require(type(value) is schema,path+' type')

SOURCES = [{'id': 'source-manifest.json', 'sha256': '73bd826c17864b6039d527cff9598df071cf09abfb1783fe1bc2cdc8549a56e9'}, {'id': 'screenshots.transcribed.json', 'sha256': '563ffd6a4d3eb75d110011c5a314e008f60aa73432b25c63492474246ca05cca'}, {'id': 'programs.normalized.json', 'sha256': 'a408002f2f3688cd4fd399770bd6f53c39c5fcd4a9c8de693a4317e42afade39'}, {'id': 'gym-profile.normalized.json', 'sha256': 'b0376507de827eefb1fd0c97e26d955bd186b56eeae6595500482a0550dc66c8'}, {'id': 'auto-split.decoded.json', 'sha256': 'e66c7b4271cfc2f7757258fd65867ca29d564554335a539af28c08a5465ac101'}, {'id': 'duration.decoded.json', 'sha256': '4009a64c6161b8fbcac68a0835376bf3f6e8bc91d71395d092fac09d7bb07960'}, {'id': 'upperLowerFull.decoded.json', 'sha256': '39cbcce53afc9b5fa17a9f18b8896b1ba0ad5a53e6d4004ecfcce97dc7425d70'}, {'id': 'Godmode2 archive', 'sha256': 'aa01f483cdc697d4b1f169402c62fd3eb00c9be73373b6e027f5e1ab23dda52b'}, {'id': 'Screenshot_20261015_070054.jpg', 'sha256': '1224148d5b346851b9e32b14488614a5d3de93e6da1dc257057a1627744037cc'}, {'id': 'Screenshot_20261015_070106.jpg', 'sha256': '2ef68c9f3f2f1729865566753cfaab5161c4c86e94a1d2f61b232a9b3a15c60e'}, {'id': 'Screenshot_20261015_070154.jpg', 'sha256': 'd5b1b409257a98d37f814f1d7ca41fa530bdc7dbae39cc7a585f487e3eeffd13'}, {'id': 'Screenshot_20261015_070204.jpg', 'sha256': '9633ab3fb51e5997e7b7e35f826e0b3ed1172652ba6faaff50a9ceeb3d49fcb4'}, {'id': 'Screenshot_20261015_070209.jpg', 'sha256': '52eedb21318f0750f717279081feab01afc0f60e96883c33c4b226c07502ba31'}, {'id': 'Screenshot_20261015_070215.jpg', 'sha256': '4c623fc704bae8a596d9fe2624bd856b82fc5241782102602c667b9f480a5401'}, {'id': 'Screenshot_20261015_070307.jpg', 'sha256': 'c8b4a9d1072b9b0984fd188abca35d17f8196157ed23b1af5e16e5792e9d3269'}, {'id': 'Screenshot_20261015_070318.jpg', 'sha256': '099f6988917309bcba87a7e13e020cc165e0fe715cc1a9a888f9b7da217a0a9a'}, {'id': 'Screenshot_20261015_070325.jpg', 'sha256': '09375dbebacc084d922515dd03370384d7f550cf2c11b2764f7021c945f08960'}, {'id': 'Screenshot_20261015_070332.jpg', 'sha256': '49313f68ddb013f77b664269d05a215860629a60264502f94ea105e221fbdda7'}, {'id': 'Screenshot_20261015_070336.jpg', 'sha256': '70d511fc8206ef8ebdc548fe3db8d0d3b8594cd3ce70096c36e62f71ff56ed32'}, {'id': 'MacroFactor-20261015070505.xlsx', 'sha256': '059d9566ba2eb5347daa3683d772606ef3595eb7896d8190d6b2508192cf0bf8'}]
PINS = {'questionnaire': 'fd5eb87b5498607f8e05ff292a53b1a17cfd11b81391b2ffecac1797214d1f24', 'equipment': 'b6f5663b1b4442a12c67882f8474a7107f933e9e6797f96b2e9e34f7288601b4', 'unknowns': '9c629e923baf013b1c0d40398ab274c1af8c945fbb5bcfafde8919b5b7aa3168'}
NAMES=[['Pause Barbell Bench Press','Pendlay Row','Pause Barbell Overhead Press','Neutral Grip Weighted Pull-Up','Seated Dumbbell Lateral Raise'],['Barbell Back Squat','Conventional Deadlift','Hack Squat','Seated Single Leg Hamstring Curl','Dumbbell Reverse Lunge','Machine Back Extension'],['Plate-Loaded Machine Hip Thrust (Starting From The Bottom)','Standing Dumbbell Biceps Curl','Pec Deck Fly','Leg Extension','Lying Hamstring Curl','Cable Straight Bar Overhead Triceps Extension','Standing Pin-Loaded Machine Glute Kickback']]
DOSES=[[(4,[3,2,1]),(7,[2,1,0]),(4,[3,2,1]),(7,[2,1,0]),(14,[1,0,0])],[(4,[3,2,1]),(4,[2,1]),(9,[2,1]),(14,[0,0]),(14,[0,0]),(14,[0,0])],[(9,[2,1]),(14,[1,0,0]),(14,[1,0,0]),(14,[0,0]),(14,[0,0]),(14,[1,0,0]),(14,[0,0])]]
FIELDS=[{'0xc':['primaryPushCompounds','primaryPullCompounds','secondaryHorizontalPush','upperBodyAccessories'],'0x10':['secondaryVerticalPush','secondaryHorizontalPull','secondaryVerticalPull'],'0x14':[]},{'0xc':['primarySquat','primaryHinge','secondarySquat','lowerBodyAccessories'],'0x10':['secondaryHinge'],'0x14':[]},{'0xc':['secondaryPullCompounds','secondaryVerticalPush','secondaryHinge','allAccessories'],'0x10':['secondaryHorizontalPush'],'0x14':[]}]

def validate(d):
    answer={'value':'nullable','sources':[str]}
    questionnaire={n:answer for n in ['creation_mode','goal','days_per_week','split_preference','periodization','experience']}
    questionnaire.update(workout_length={'enum':str,'label':str,'source':str},muscle_emphasis={'prioritized':[str],'deprioritized':[str],'sources':[str]},deload={'value':bool,'source':str})
    schema={'version':int,'sources':[{'id':str,'sha256':str}],'questionnaire':questionnaire,'equipment':[{'name':str,'source':str}],'observation':{'name':str,'source':str,'declaredCycles':int,'observedCycles':int,'deload':str,'days':[dict]},'contracts':{'automatic':[{'days':int,'split':str}],'duration':[{'enum':str,'rawMicroseconds':int,'minutes':'number'}],'splitDays':[{'allocationPc':str,'fields':{k:[str] for k in ['0xc','0x10','0x14']}}]},'unknowns':[str]}
    shape(d,schema)
    for day in d['observation']['days']:
        s={'kind':str,'source':str}
        if day['kind']=='training': s.update(name=str,exercises=[{'name':str,'source':str,'sets':[{'type':str,'reps':[int],'rir':'number','source':str}]}])
        shape(day,s)
    require(d['version']==1,'version')
    require(d['sources']==SOURCES,'provenance pins')
    q=d['questionnaire']
    require([q[n]['value'] for n in ['creation_mode','goal','days_per_week','split_preference','periodization','experience']]==['smart','both',3,None,'static','Advanced'],'observed answers')
    require(q['deload']['value'] is False and q['workout_length']['enum']=='max60' and q['workout_length']['label']=='40 to 60 minutes','observed time/deload')
    require(q['muscle_emphasis']['prioritized']==[] and q['muscle_emphasis']['deprioritized']==['Abs','Obliques','Serratus','Neck','Calves','Abductors','Adductors','Tibialis'],'observed emphasis')
    c=d['contracts']
    require(c['automatic']==[{'days':n,'split':s} for n,s in zip(range(2,7),['fullBody','upperLowerFull','upperLowerUpperLower','pushPullLegsUpperLower','pushPullLegsPushPullLegs'])],'automatic mapping')
    require(c['duration']==[{'enum':e,'rawMicroseconds':m*60000000,'minutes':m} for e,m in zip(['max20','max40','max60','max90','max120','over120'],[18,30,50,75,105,125])],'duration conversion')
    require(c['splitDays']==[{'allocationPc':p,'fields':f} for p,f in zip(['0xecf8c4','0xecf9b0','0xecfa9c'],FIELDS)],'split field order')
    o=d['observation'];require((o['name'],o['source'],o['declaredCycles'],o['observedCycles'],o['deload'])==('Godmode2','Training Programs!A1',7,1,'None'),'observed structure')
    require([v['kind'] for v in o['days']]==['training','rest','training','rest','training','rest','rest'],'week structure')
    training=[v for v in o['days'] if v['kind']=='training']
    require([v['name'] for v in training]==['Upper','Lower','Full'],'day names/order')
    require([v['source'] for v in o['days']]==['Training Programs!A'+str(r) for r in [4,9,10,16,17,24,25]],'day cells')
    for day,names,doses,rows in zip(training,NAMES,DOSES,[range(4,9),range(10,16),range(17,24)]):
        require([e['name'] for e in day['exercises']]==names,'exercise names/order')
        for exercise,(lo,rirs),row in zip(day['exercises'],doses,rows):
            require(exercise['source']=='Training Programs!B'+str(row),'exercise cell')
            require([s['source'] for s in exercise['sets']]==['Training Programs!'+a+str(row)+':'+b+str(row) for a,b in [('E','H'),('I','L'),('M','P')][:len(rirs)]],'dose cells')
            require([(s['reps'],s['rir'],s['type']) for s in exercise['sets']]==[([lo,lo+2],r,'Standard Set') for r in rirs],'observed slot dose')
    # Independent semantic anchors above distinguish plausible wrong rules/doses.
    # Remaining pins protect transcription cells, equipment and limitation wording.
    for field in ['questionnaire','equipment','unknowns']:
        digest=hashlib.sha256(json.dumps(d[field],sort_keys=True,ensure_ascii=False).encode()).hexdigest()
        require(digest==PINS[field],field+' reviewed transcription pin')
    def cells(v):
        if isinstance(v,dict):
            for k,x in v.items():
                if k=='source': require(re.fullmatch(r'(Training Programs![A-Z]+\d+(?::[A-Z]+\d+)?)',x) is not None,'cell provenance')
                else: cells(x)
        elif isinstance(v,list):
            for x in v: cells(x)
    cells(o)
    return {'observedCycles':1,'declaredCycles':7,'trainingDays':3,'exercises':18,'sets':45}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('artifact',nargs='?',type=Path,default=Path(__file__).parent/'data/supplement.json');a=p.parse_args()
    print(json.dumps(validate(strict_json_loads(a.artifact.read_text())),sort_keys=True))

if __name__=='__main__': main()
