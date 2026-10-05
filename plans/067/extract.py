#!/usr/bin/env python3
"""Export the Plan 067 evidence corpus using only Python's standard library."""
import argparse
import collections
import hashlib
import io
import json
import re
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
APP_MEMBER = 'assets/flutter_assets/packages/macrofactor/assets/import/app_file.json'
ROLES = ['strengthPrimaryCompound', 'strengthSecondaryCompound', 'strengthAccessory',
         'hypertrophyPrimaryCompound', 'hypertrophySecondaryCompound', 'hypertrophyAccessory']


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + '\n').encode()


def sheet(path, name):
    """Read only an explicitly named worksheet, never User Profile."""
    with zipfile.ZipFile(path) as z:
        workbook = ET.fromstring(z.read('xl/workbook.xml'))
        relation = next(s for s in workbook.findall('s:sheets/s:sheet', NS) if s.get('name') == name)
        rid = relation.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        target = next(r.get('Target') for r in rels if r.get('Id') == rid)
        member = target.lstrip('/') if target.startswith('/') else 'xl/' + target
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(t.text or '' for t in item.findall('.//s:t', NS))
                       for item in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si', NS)]
        rows = []
        for row in ET.fromstring(z.read(member)).findall('.//s:row', NS):
            values = {}
            for cell in row.findall('s:c', NS):
                v = cell.find('s:v', NS)
                value = v.text if v is not None else ''.join(t.text or '' for t in cell.findall('.//s:t', NS))
                if cell.get('t') == 's':
                    value = strings[int(value)]
                if value:
                    values[re.sub(r'\d+', '', cell.get('r'))] = value
            rows.append((int(row.get('r')), values))
        return rows


def resolve(name, objects, kind):
    # Exact canonical names take precedence over aliases.
    matches = [k for k, v in objects.items() if v['type'] == kind and v['name'].casefold() == name.casefold()]
    if not matches:
        aliases = {k for k, v in objects.items() if v['type'] == 'alternativeName' and v['name'].casefold() == name.casefold()}
        matches = [k for k, v in objects.items() if v['type'] == kind and aliases.intersection(v.get('alternativeName', []))]
    if len(matches) != 1:
        raise ValueError(f'Ambiguous or missing {kind}: {name}')
    return matches[0]


def programs(path, objects, wanted):
    output = {}
    current = day = None
    for row_number, row in sheet(path, 'Training Programs'):
        heading = row.get('A', '')
        if heading.startswith('Program: '):
            name = heading.removeprefix('Program: ')
            current = {'name': name, 'cycles': int(row['B'].split(': ')[1]), 'deload': row['C'].split(': ')[1],
                       'exportedCycles': [1], 'schedule': [], 'days': []} if name in wanted else None
            if current is not None:
                output[name] = current
            day = None
            continue
        if current is None:
            continue
        if heading == 'Rest':
            current['schedule'].append('Rest')
        elif ' @ ' in heading:
            name = heading.split(' @ ')[0]
            current['schedule'].append(name)
            day = {'name': name, 'exercises': []}
            current['days'].append(day)
        if day is not None and row.get('B') and row.get('E') == 'Standard Set':
            sets = []
            for a, b, c, rest in [('E','F','G','H'), ('I','J','K','L'), ('M','N','O','P')]:
                if a not in row:
                    continue
                lo, hi = [int(v.strip()) for v in row[b].split('-')]
                sets.append({'type': row[a], 'repMin': lo, 'repMax': hi, 'rir': float(row[c]),
                             'restSeconds': float(row[rest]) if rest in row else None})
            day['exercises'].append({'exerciseId': resolve(row['B'], objects, 'exercise'),
                                     'exportName': row['B'], 'sourceRow': row_number, 'sets': sets})
    if set(output) != set(wanted):
        raise ValueError('Missing requested programs')
    return output


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--volume1', type=Path, required=True)
    p.add_argument('--volume2', type=Path, required=True)
    p.add_argument('--spec-pack', type=Path, required=True)
    p.add_argument('--baseline-workbook', type=Path, required=True)
    p.add_argument('--extended-workbook', type=Path, required=True)
    p.add_argument('--screenshot', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    args = p.parse_args()
    source = {}
    for key in ['volume1','volume2','spec_pack','baseline_workbook','extended_workbook','screenshot']:
        data = getattr(args, key).read_bytes()
        source[key] = {'sha256': digest(data), 'bytes': len(data)}
    with zipfile.ZipFile(args.volume1) as z:
        xapk = z.read(next(n for n in z.namelist() if n.endswith('.xapk')))
    with zipfile.ZipFile(io.BytesIO(xapk)) as master, zipfile.ZipFile(args.volume2) as unpacked:
        apks = {}
        for member in unpacked.namelist():
            if not member.endswith('.apk'):
                continue
            data = unpacked.read(member)
            name = Path(member).name
            original = next(n for n in master.namelist() if Path(n).name == name)
            if master.read(original) != data:
                raise ValueError(f'Original/extracted APK mismatch: {name}')
            source[name] = {'sha256': digest(data), 'bytes': len(data)}
            apks[name] = data
    source['original_xapk'] = {'sha256': digest(xapk), 'bytes': len(xapk)}
    with zipfile.ZipFile(io.BytesIO(apks['com.sbs.train.apk'])) as apk:
        raw = apk.read(APP_MEMBER)
    with zipfile.ZipFile(io.BytesIO(apks['config.arm64_v8a.apk'])) as apk:
        native = apk.read('lib/arm64-v8a/libapp.so')
    source['libapp.so'] = {'sha256': digest(native), 'bytes': len(native)}
    source['app_file.json'] = {'sha256': digest(raw), 'bytes': len(raw), 'member': APP_MEMBER}
    db = json.loads(raw)
    objects = dict(db['uuidIndex'])
    for ex in db['exercises']:
        objects[ex['id']] = dict(objects[ex['id']], **ex)
    counts = dict(sorted(collections.Counter(v['type'] for v in db['uuidIndex'].values()).items()))
    tiers = [{'exerciseId': ex['id'], 'role': role, 'tier': ex[role + 'RecommendationLevel']}
             for ex in db['exercises'] for role in ROLES if ex[role + 'RecommendationLevel'] is not None]
    baseline = programs(args.baseline_workbook, objects, ['P1','P2'])
    extended = programs(args.extended_workbook, objects, ['P1','P2','P3','P4'])
    # Source-row positions differ between exports; all other prescription data must agree.
    def without_rows(value):
        if isinstance(value, dict): return {k: without_rows(v) for k,v in value.items() if k != 'sourceRow'}
        if isinstance(value, list): return [without_rows(v) for v in value]
        return value
    for name in baseline:
        if without_rows(baseline[name]) != without_rows(extended[name]):
            raise ValueError(f'Baseline changed across exports: {name}')
    for name, program in extended.items():
        program['generationContext'] = {'evidence': 'owner-reported; P3/P4 requested experiment conditions',
            'goal': 'hypertrophy', 'experience': 'intermediate', 'trainingDays': 4,
            'split': 'upper/lower/upper/lower', 'sessionMinutes': [20,40] if name == 'P4' else [40,60],
            'competencyAnswers': ['Yes' if name == 'P3' else 'No'] * 7,
            'emphasis': [], 'excludedMuscles': [], 'periodization': 'static', 'gym': 'Commercial Gym'}
    gym_rows = sheet(args.extended_workbook, 'Gym Profiles')
    gym = [{'equipmentId': resolve(row['D'], objects, 'equipment'), 'exportName': row['D'],
            'exportWeights': row.get('E')} for _,row in gym_rows[1:] if row.get('D')]
    setting_rows = dict(sheet(args.extended_workbook, 'Workout Settings'))
    headers, values = setting_rows[1], setting_rows[2]
    allowed = {'Bodyweight Contribution', 'Expand Rep Range', 'Weight Match', 'Initial log fill', 'Apply in session'}
    selected = {name: values.get(c) for c, name in headers.items() if name in allowed}
    if set(selected) != allowed:
        raise ValueError('Missing allowlisted workout settings')
    with zipfile.ZipFile(args.spec_pack) as pack:
        supplied = json.loads(pack.read('macrofactor_engine_ontology.json'))
        if supplied['counts'] != counts:
            raise ValueError('Spec-pack ontology counts differ from APK')
        unknowns = json.loads(pack.read('macrofactor_workouts_1_4_0_unknowns_ledger.json'))
        reconstruction = json.loads(pack.read('macrofactor_generator_reconstruction.json'))
        static = pack.read('macrofactor_static_evidence.tsv')
    observation = {'evidenceClass': 'screenshot observation with owner interpretation',
        'sourceSha256': source['screenshot']['sha256'],
        'exerciseId': resolve('Close Grip Smith Machine Bench Press', objects, 'exercise'),
        'firstSet': {'completed': True, 'loadKg': 110, 'reps': 6, 'rir': 2, 'prescribedRepRange': [7,9]},
        'secondSet': {'completed': False, 'recommendedLoadKg': 105, 'prescribedRepRange': [7,9],
                      'prescribedRir': 1, 'prefilledReps': 8},
        'ownerInterpretation': 'Load decrease responds to reps below range; fatigue contribution suspected',
        'notEstablished': ['initial set-one recommendation', 'loading increments', 'bodyweight',
                           'history baseline', 'isolated fatigue contribution', 'exact formula']}
    files = {'progression-observation.json': json_bytes(observation), 'app_file.json': raw, 'ontology.json': json_bytes({'counts': counts, 'uuidIndex': db['uuidIndex']}),
             'recommendation-tiers.json': json_bytes(tiers), 'programs.json': json_bytes(extended),
             'gym.json': json_bytes({'equipment': gym, 'settings': selected}),
             'supplied-unknowns.json': json_bytes(unknowns),
             'supplied-reconstruction.json': json_bytes(reconstruction), 'static-evidence.tsv': static}
    manifest = {'package': 'com.sbs.train', 'version': '1.4.0', 'source': source,
        'counts': counts, 'recommendationRows': len(tiers),
        'evidenceClasses': {'progression-observation.json': 'screenshot observation; second set unperformed', 'app_file.json': 'exact bundled database bytes',
          'ontology.json': 'exact bundled index normalized as JSON', 'recommendation-tiers.json': 'exact raw assignments',
          'programs.json': 'export observations plus explicitly labeled owner context',
          'gym.json': 'allowlisted export settings and equipment',
          'supplied-unknowns.json': 'supplied analysis; not independently recovered control flow',
          'supplied-reconstruction.json': 'supplied analysis; claims require independent verification',
          'static-evidence.tsv': 'supplied static metadata; strings do not prove execution'},
        'artifacts': {name: {'sha256': digest(data), 'bytes': len(data)} for name,data in sorted(files.items())}}
    files['manifest.json'] = json_bytes(manifest)
    args.out.mkdir(parents=True, exist_ok=True)
    for name,data in files.items():
        (args.out / name).write_bytes(data)
    print(f'Exported {len(db["exercises"])} exercises, {len(db["uuidIndex"])} ontology objects, {len(tiers)} tier assignments')

if __name__ == '__main__':
    main()
