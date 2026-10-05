#!/usr/bin/env python3
"""Validate published evidence, including deliberate corruptions of its meaning."""
import argparse
import collections
import copy
import hashlib
import json
import re
from pathlib import Path

EXPECTED_COUNTS = {'alternativeName':2069,'appEquipmentCategory':13,'equipment':297,
 'exclusionGroupings':340,'exercise':1345,'exerciseDescriptor':20,'exerciseGroup':321,
 'exerciseMetric':11,'exerciseNote':280,'exerciseType':3,'featureMuscleGroup':23,
 'jointAction':150,'laterality':3,'movementPattern':43,'muscle':233,
 'plateCalculatorLaterality':2,'preconditions':46,'regionTrained':4,
 'resistanceEquipmentGroup':35,'rom':5,'stability':5,'supportEquipmentGroup':53}
ROLES = ['strengthPrimaryCompound','strengthSecondaryCompound','strengthAccessory',
 'hypertrophyPrimaryCompound','hypertrophySecondaryCompound','hypertrophyAccessory']


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate(corpus):
    db, ontology = corpus['app_file.json'], corpus['ontology.json']
    index = db['uuidIndex']
    exercises = {v['id']:v for v in db['exercises']}
    require(len(exercises) == len(db['exercises']) == 1345, 'exercise identity/count')
    require(len(index) == 5301, 'ontology object count')
    require(dict(collections.Counter(v['type'] for v in index.values())) == EXPECTED_COUNTS, 'ontology type counts')
    require(ontology == {'counts':EXPECTED_COUNTS,'uuidIndex':index}, 'normalized ontology differs')
    require({k for k,v in index.items() if v['type']=='exercise'} == set(exercises), 'exercise index coverage')
    def refs(value):
        if isinstance(value,dict):
            for v in value.values(): refs(v)
        elif isinstance(value,list):
            for v in value: refs(v)
        elif isinstance(value,str) and re.fullmatch('[0-9a-f]{32}',value):
            require(value in index, 'dangling UUID reference')
    refs(db)
    expected = [{'exerciseId':ex['id'],'role':role,'tier':ex[role+'RecommendationLevel']}
                for ex in db['exercises'] for role in ROLES if ex[role+'RecommendationLevel'] is not None]
    require(corpus['recommendation-tiers.json'] == expected and len(expected)==3057, 'tier assignment mismatch')
    for ex in exercises.values():
        for field in ['emphasizedAgonist','deemphasizedAgonist']:
            require(all(index[v]['type']=='featureMuscleGroup' for v in ex[field]), 'agonist reference type')
        for field,group in [('resistanceEquipmentGroupIds','resistanceEquipmentGroup'),('supportEquipmentGroupIds','supportEquipmentGroup')]:
            require(all(index[v]['type'] in ['equipment',group] for v in ex[field]), 'equipment reference type')
        require(all(index[v]['type']=='exerciseMetric' for v in ex['exerciseMetrics']), 'metric reference type')
    require(sum(not ex['exerciseMetrics'] for ex in exercises.values())==3,'incomplete metric records')
    gym = corpus['gym.json']
    require(gym['settings']=={'Bodyweight Contribution':'Yes','Expand Rep Range':'Yes','Weight Match':'No',
                            'Initial log fill':'Smart Progression values','Apply in session':'Yes'}, 'settings allowlist/value')
    require(set(gym)=={'equipment','settings'}, 'gym allowlist')
    available = {v['equipmentId'] for v in gym['equipment']}
    require(len(gym['equipment'])==len(available)==82, 'gym equipment count/identity')
    for v in gym['equipment']:
        require(set(v)=={'equipmentId','exportName','exportWeights'},'equipment allowlist')
        require(index[v['equipmentId']]['type']=='equipment', 'gym equipment type')
    while True:
        expanded = available | {index[k]['pluralOf'] for k in available if index[k].get('pluralOf')}
        if expanded == available: break
        available = expanded
    require(len(available)==89, 'plural equipment closure')
    require(available=={k for k,v in index.items() if v['type']=='equipment' and v.get('commercialGym')==1}, 'commercial profile closure')
    def eligible(ex):
        def fits(options):
            return not options or any(k in available if index[k]['type']=='equipment' else set(index[k]['equipment']) <= available for k in options)
        return fits(ex['resistanceEquipmentGroupIds']) and fits(ex['supportEquipmentGroupIds'])
    programs = corpus['programs.json']
    require(set(programs)=={'P1','P2','P3','P4'}, 'program allowlist')
    signatures = {}
    for name,program in programs.items():
        require(set(program)=={'name','cycles','deload','exportedCycles','schedule','days','generationContext'}, 'program fields allowlist')
        require(program['cycles']==7 and program['exportedCycles']==[1] and program['deload']=='None','export scope')
        require(program['schedule']==['Upper A','Rest','Lower A','Rest','Upper B','Lower B','Rest'], 'schedule')
        expected_lengths = [4,3,5,3] if name=='P4' else [6,5,6,5]
        expected_sets = [9,9,10,9] if name=='P4' else [16,15,16,15]
        require([len(d['exercises']) for d in program['days']]==expected_lengths, 'day exercise counts')
        require([sum(len(e['sets']) for e in d['exercises']) for d in program['days']]==expected_sets, 'day set counts')
        signature=[]
        for day in program['days']:
            require(set(day)=={'name','exercises'},'day allowlist')
            for ex in day['exercises']:
                require(set(ex)=={'exerciseId','exportName','sourceRow','sets'},'exercise fixture allowlist')
                require(ex['exerciseId'] in exercises and eligible(exercises[ex['exerciseId']]),'selected exercise equipment')
                signature.append(ex['sets'])
                for s in ex['sets']:
                    require(set(s)=={'type','repMin','repMax','rir','restSeconds'},'set allowlist')
                    require(s['type']=='Standard Set' and 0 <= s['rir'] <= 3 and s['repMax']-s['repMin']==2 and s['restSeconds'] is None,'set prescription')
        signatures[name]=signature
    require(signatures['P1']==signatures['P2']==signatures['P3'], 'standard prescriptions differ')
    require(programs['P4']['days'][0]['exercises'][0]['sets'][0]['rir']==3,'compact primary gains third set')
    observation = corpus['progression-observation.json']
    require(observation['firstSet']=={'completed':True,'loadKg':110,'reps':6,'rir':2,'prescribedRepRange':[7,9]}, 'performed screenshot set')
    require(observation['secondSet']=={'completed':False,'recommendedLoadKg':105,'prescribedRepRange':[7,9],'prescribedRir':1,'prefilledReps':8}, 'unperformed screenshot recommendation')
    require(observation['exerciseId'] in exercises, 'screenshot exercise identity')
    return {'exercises':1345,'ontologyObjects':5301,'ontologyTypes':22,'tierAssignments':3057,
            'programSetCounts':{'P1':62,'P2':62,'P3':62,'P4':37},'gymEquipmentAfterClosure':89}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('data',nargs='?',type=Path,default=Path(__file__).parent/'data')
    parser.add_argument('--negative-controls',action='store_true')
    args=parser.parse_args()
    manifest=json.loads((args.data/'manifest.json').read_text())
    for name,record in manifest['artifacts'].items():
        data=(args.data/name).read_bytes()
        require(hashlib.sha256(data).hexdigest()==record['sha256'] and len(data)==record['bytes'],f'checksum: {name}')
    corpus={name:json.loads((args.data/name).read_text()) for name in manifest['artifacts'] if name.endswith('.json')}
    report=validate(corpus)
    if args.negative_controls:
        def dangling(c): c['app_file.json']['exercises'][0]['exerciseMetrics'].append('0'*32)
        def tier(c): c['recommendation-tiers.json'][0]['tier']=99
        def prescription(c): c['programs.json']['P4']['days'][0]['exercises'][0]['sets'].pop()
        def equipment(c): c['gym.json']['equipment'].pop()
        def privacy(c): c['programs.json']['P1']['email']='unexpected@example.invalid'
        for mutate in [dangling,tier,prescription,equipment,privacy]:
            bad=copy.deepcopy(corpus);mutate(bad)
            try: validate(bad)
            except ValueError: continue
            raise ValueError(f'Negative control escaped: {mutate.__name__}')
        report['negativeControlsRejected']=5
    print(json.dumps(report,sort_keys=True))

if __name__=='__main__':main()
