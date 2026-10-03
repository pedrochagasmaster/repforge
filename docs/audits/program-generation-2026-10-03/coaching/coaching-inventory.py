"""Descriptive inventory for the qualitative audit; no physiological pass/fail score.

Markers identify observed features, not diagnoses. Coaching interpretations and
classifications live in README.md. The source programs are never regenerated.
"""
import collections
import csv
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / 'programs.json'
source = json.loads(SOURCE.read_text())
programs = source['programs']
comparisons = {p['id']: p for p in json.loads((HERE / 'priority-counterfactuals.json').read_text())}

def counted_sets(slots, predicate, targets=None):
    return sum((targets.get(s['slotId'], s['prescription']['sets']) if targets is not None else s['prescription']['sets'])
               for s in slots if predicate(s))

def recipe(s):
    p=s['prescription']
    strategy=p['progression']['strategy']
    q=strategy['params']
    if strategy['id']=='anchor_backoff':
        return f"1 × {q['anchorRepMin']}–{q['anchorRepMax']} anchor at {q['anchorTargetRirMin']}–{q['anchorTargetRirMax']} RIR + {q['backoffSets']} × {q['backoffRepMin']}–{q['backoffRepMax']} at {q['backoffPercent']*100:g}% of anchor load"
    if strategy['id']=='effort_target':
        return f"{p['sets']} × {q['targetReps']} at {q['targetRirMin']}–{q['targetRirMax']} RIR"
    if strategy['id']=='rep_goal':
        return f"{p['sets']} sets, total-rep goal {q['repGoal']}, {q['repFloor']}–{q['repCeiling']} per set, {p['targetRirMin']}–{p['targetRirMax']} RIR"
    return f"{p['sets']} × {p['repMin']}–{p['repMax']} at {p['targetRirMin']}–{p['targetRirMax']} RIR"

def metrics(p):
    i, r = p['input'], p['result']
    all_slots = [s for d in r['days'] for s in d['slots']]
    markers = []
    observations = []
    days = []
    for d in r['days']:
        ss = d['slots']
        duplicates = []
        for eid, n in collections.Counter(s['exercise']['id'] for s in ss).items():
            if n < 2:
                continue
            matching = [s for s in ss if s['exercise']['id'] == eid]
            identical = collections.Counter((s['prescription']['sets'], s['prescription']['repMin'],
                s['prescription']['repMax'], s['prescription']['targetRirMin'], s['prescription']['targetRirMax'],
                s['prescription']['restSeconds']) for s in matching)
            duplicates.append({'exerciseId': eid, 'exercise': matching[0]['exercise']['name'],
                'entries': n, 'sets': sum(s['prescription']['sets'] for s in matching),
                'jobs': [s['templateId'] for s in matching],
                'identicalDoseEntries': max(identical.values())})
        if duplicates:
            markers.append('same_day_duplicate')
        if any(x['entries'] >= 3 for x in duplicates):
            markers.append('three_entries_same_exercise')
        if any(x['identicalDoseEntries'] >= 2 for x in duplicates):
            markers.append('same_day_identical_dose_duplicate')
        if any(x['entries'] >= 3 and any(s['exercise']['id'] == x['exerciseId'] and 'hinge' in s['exercise']['patterns'] for s in ss) for x in duplicates):
            markers.append('three_hinge_entries')
        if len(ss) >= 2 and len({s['exercise']['id'] for s in ss}) == 1:
            markers.append('single_exercise_multiple_job_day')
        for position, s in enumerate(ss):
            if s['templateId'] == 'home_posterior' and s['exercise']['id'] == 'sqs_bw':
                markers.append('posterior_sissy_squat')
            if s['templateId'] == 'home_posterior' and s['exercise']['id'] == 'ss_bw':
                markers.append('posterior_split_squat')
            if s['templateId'] == 'unilateral_knee' and not s['exercise']['unilateral']:
                markers.append('unilateral_job_bilateral')
            if s['templateId'] == 'incline_press' and 'incline_press' not in s['exercise']['patterns']:
                markers.append('incline_job_flat_press')
            if s['templateId'] == 'knee_volume' and any('hinge' in previous['exercise']['patterns'] for previous in ss[:position]):
                markers.append('hinge_before_knee_volume')
                if i['familyId'] == 'balanced' and i['frequency'] == 4:
                    markers.append('balanced4_hinge_before_squat_practice')
        days.append({'dayId': d['dayId'], 'label': d['label'], 'entries': len(ss),
            'sets': sum(s['prescription']['sets'] for s in ss), 'duplicates': duplicates,
            'kneeDominantSets': counted_sets(ss, lambda s: 'squat' in s['exercise']['patterns'] or 'leg_extension' in s['exercise']['patterns']),
            'hipHingeSets': counted_sets(ss, lambda s: 'hinge' in s['exercise']['patterns']),
            'kneeFlexionSets': counted_sets(ss, lambda s: 'leg_curl' in s['exercise']['patterns']),
            'horizontalPressSets': counted_sets(ss, lambda s: 'press' in s['exercise']['patterns'] or 'incline_press' in s['exercise']['patterns']),
            'horizontalPullSets': counted_sets(ss, lambda s: 'row' in s['exercise']['patterns']),
            'verticalPullSets': counted_sets(ss, lambda s: 'pulldown' in s['exercise']['patterns']),
            'isolationMovementSets': counted_sets(ss, lambda s: bool(set(s['exercise']['patterns']) & {'leg_extension','leg_curl','lateral_raise','rear_delt','curl','triceps','calves','core','chest_iso'})),
            'actualExerciseOrder': [{'exercise': s['exercise']['name'], 'id': s['exercise']['id'],
                'actualPrescription': recipe(s),
                'sets': s['prescription']['sets'], 'reps': [s['prescription']['repMin'],s['prescription']['repMax']],
                'rir': [s['prescription']['targetRirMin'],s['prescription']['targetRirMax']], 'restSeconds': s['prescription']['restSeconds']}
                for s in ss]})
    for s in all_slots:
        if i.get('profile') == 'foundation' and s['exercise']['id'] == 'lg_bb' and s['prescription']['repMax'] == 6:
            markers.append('foundation_heavy_barbell_lunge')
        if i.get('profile') == 'foundation' and s['exercise']['id'] == 'dp_bb':
            markers.append('foundation_decline_bench')
        if i.get('profile') == 'foundation' and s['prescription']['targetRirMin'] == 0:
            markers.append('foundation_zero_rir_allowed')
        if s['exercise']['id'] == 'ghr_bw': markers.append('glute_ham_raise')
        if s['exercise']['id'] == 'chn_bw': markers.append('unassisted_chinup')
        if s['exercise']['id'] == 'cd_bw': markers.append('unassisted_chest_dip')
    knee_flexion = any('leg_curl' in s['exercise']['patterns'] for s in all_slots)
    if not knee_flexion and i['familyId'] != 'home': markers.append('gym_no_knee_flexion')
    if not any('rear_delt' in s['exercise']['patterns'] for s in all_slots): markers.append('no_specific_rear_delt_movement')
    if not any('row' in s['exercise']['patterns'] for s in all_slots): markers.append('no_horizontal_pull')
    if i['sessionMinutes'] == 30 and any(s['prescription']['sets'] == 1 and
        (set(s['exercise']['patterns']) & {'press','row','pulldown','squat','hinge','shoulder_press','incline_press'}) for s in all_slots):
        markers.append('30minute_many_one_set_compounds')
    if 'band' in i['equipment'] and not any(s['exercise']['equipment'] == 'band' for s in all_slots): markers.append('bands_present_unused')
    week_metrics = []
    for w in r['weeks']:
        targets = {s['slotId']: s['sets'] for d in w['days'] for s in d['slots']}
        direct = collections.Counter()
        for s in all_slots:
            for muscle in s['exercise']['primaryMuscles']: direct[muscle] += targets[s['slotId']]
        week_metrics.append({'week': w['week'], 'sets': sum(targets.values()), 'directLabelSets': dict(direct),
            'protectedSets': counted_sets(all_slots, lambda s: s['protected'], targets),
            'heavySets': counted_sets(all_slots, lambda s: s['role']=='heavy_primary', targets),
            'sessionSets': {d['label']: sum(targets[s['slotId']] for s in d['slots']) for d in r['days']}})
    if i.get('reentryEnabled') and i.get('recentConsistency') == 'returning':
        markers.append('returning_lifter')
        if any(s['protected'] and s['prescription']['targetRirMin'] == 0 for s in all_slots):
            markers.append('returning_protected_zero_rir_allowed')
        if week_metrics[0]['protectedSets'] == week_metrics[2]['protectedSets']:
            markers.append('returning_protected_dose_unchanged')
    comparison = None
    if p['id'] in comparisons:
        b = comparisons[p['id']]['baseline']
        current_shape = [[(s['exercise']['id'],s['prescription']) for s in d['slots']] for d in r['days']]
        baseline_shape = [[(s['exercise']['id'],s['prescription']) for s in d['slots']] for d in b['days']]
        comparison = {'directLabelDeltas': {m:r['directIndirectExposure']['direct'].get(m,0)-b['directIndirectExposure']['direct'].get(m,0)
            for m in i['primaryMuscles']},'exactSamePrescription':current_shape == baseline_shape}
        if comparison['exactSamePrescription']: markers.append('muscle_priority_no_prescription_change')
        if all(v == 0 for v in comparison['directLabelDeltas'].values()): markers.append('muscle_priority_no_direct_label_increase')
    normal = week_metrics[2]
    strategies=sorted({s['prescription']['progression']['strategy']['id'] for s in all_slots})
    patterns = {}
    for field in ['kneeDominantSets','hipHingeSets','kneeFlexionSets','horizontalPressSets','horizontalPullSets','verticalPullSets','isolationMovementSets']:
        patterns[field] = {'sets':sum(d[field] for d in days),'days':sum(d[field]>0 for d in days)}
    return {'id':p['id'],'cohort':p['cohort'],'family':i['familyId'],'frequency':i['frequency'],'input':i,
        'markers':sorted(set(markers)),'normalWeeklySets':normal['sets'],'days':days,'weeks':week_metrics,
        'directLabelSets':r['directIndirectExposure']['direct'],'secondaryLabelSets':r['directIndirectExposure']['indirect'],
        'functionalExposure':patterns,'strategies':strategies,'priorityComparison':comparison}

inventory = [metrics(p) for p in programs]
names = sorted({m for p in inventory for m in p['markers']})
prevalence = {name:{'all':sum(name in p['markers'] for p in inventory),
    'representative':sum(name in p['markers'] and p['cohort']=='representative' for p in inventory),
    'stress':sum(name in p['markers'] and p['cohort']=='stress' for p in inventory),
    'ids':[p['id'] for p in inventory if name in p['markers']]} for name in names}
blueprints = {}
for family in ['growth','balanced','strength','home']:
    for frequency in range(2,7):
        matched = [p for p in inventory if p['family']==family and p['frequency']==frequency]
        blueprints[f'{family}_{frequency}'] = {'cases':len(matched),'ids':[p['id'] for p in matched],
            'normalWeeklySets':[p['normalWeeklySets'] for p in matched],
            'markerCounts':{m:sum(m in p['markers'] for p in matched) for m in names if any(m in p['markers'] for p in matched)}}

metadata = {'sourceSha':source['source']['sha'],'sourceProgramsFileSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'basis':'All 200 complete six-week prescriptions inspected; markers are descriptive, coaching judgments are qualified in README.md.',
    'accounting':'Direct/secondary labels are catalogue annotations, not physiological set equivalence. Functional pattern sets can overlap.',
    'calendar':'Ordered exposures are available; specific weekdays and spacing are not part of these generated prescriptions.'}
(HERE / 'coaching-evidence.json').write_text(json.dumps({'metadata':metadata,'prevalence':prevalence,'blueprints':blueprints,'programs':inventory},indent=2)+'\n')

with (HERE / 'coaching-inventory.csv').open('w',newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['id','cohort','family','days','minutes','profile','normal_weekly_sets','week1_sets','week2_sets','max_session_sets','knee_dominant_sets','hinge_sets','knee_flexion_sets','horizontal_pull_sets','vertical_pull_sets','markers'])
    for p in inventory:
        writer.writerow([p['id'],p['cohort'],p['family'],p['frequency'],p['input']['sessionMinutes'],p['input'].get('profile','standard'),
            p['normalWeeklySets'],p['weeks'][0]['sets'],p['weeks'][1]['sets'],max(d['sets'] for d in p['days']),
            p['functionalExposure']['kneeDominantSets']['sets'],p['functionalExposure']['hipHingeSets']['sets'],p['functionalExposure']['kneeFlexionSets']['sets'],
            p['functionalExposure']['horizontalPullSets']['sets'],p['functionalExposure']['verticalPullSets']['sets'],';'.join(p['markers'])])

print(json.dumps({m:{k:v for k,v in prevalence[m].items() if k!='ids'} for m in names},indent=2))
