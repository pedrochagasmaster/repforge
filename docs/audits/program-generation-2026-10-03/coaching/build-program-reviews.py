"""Publish case evidence and explicit, qualified coaching interpretations.

The complete prescriptions were reviewed before authoring these interpretations.
This renderer associates the documented observations with each case. It does not
estimate physiological effective sets, assign a numeric quality score, or turn
all descriptive markers into defects.
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
data = json.loads((HERE / 'coaching-evidence.json').read_text())
source = json.loads((HERE.parent / 'programs.json').read_text())
original = {p['id']: p for p in source['programs']}

def review(p):
    m = set(p['markers'])
    i = p['input']
    notes = []
    positives = []
    def note(code, classification, text):
        notes.append({'finding': code, 'classification': classification, 'judgment': text})
    if 'posterior_sissy_squat' in m:
        note('Q01', 'clear programming defect', 'Sissy squat fills posterior jobs despite being knee-dominant. The missing posterior function is obscured, and repeated knee work accumulates. Equipment scarcity does not justify the substitution.')
    if 'posterior_split_squat' in m:
        note('Q01', 'likely suboptimal programming / context-dependent', 'Split squats can provide meaningful glute work, so this is not absence of all posterior muscle stimulus. They do not establish a distinct hamstring function; the repeated knee/posterior jobs deserve review together.')
    if 'single_exercise_multiple_job_day' in m:
        note('Q02', 'clear programming defect in intended coverage', 'The Mixed coverage session contains only one exercise in multiple entries. Without a specialization request, these jobs do not supply the intended coverage and bias the week toward the ranking winner. The problem is more than display duplication.')
    if 'three_hinge_entries' in m:
        note('Q02', 'likely suboptimal programming', 'At least one session spends three entries on the same hinge. Different rep ranges can be useful, but duplicate assistance displaces complementary functions and concentrates local fatigue without an explicit posterior-specialization rationale.')
    elif 'same_day_duplicate' in m and 'single_exercise_multiple_job_day' not in m:
        note('Q02', 'acceptable but debatable / review required', 'Same-session repeated exercise is present. Heavy-to-volume repetition can be purposeful; matching assistance doses are less convincing. Inspect the entries below and substitute only where their intended functions or stimulus are redundant.')
    if 'foundation_heavy_barbell_lunge' in m:
        note('Q03', 'likely suboptimal programming', 'Foundation chooses a 3–6-rep barbell lunge as primary knee work and a decline barbell bench as primary press. The loading, balance/setup and generic entry profile are an awkward combination; these are not inherently bad exercises for a capable client.')
    if 'foundation_zero_rir_allowed' in m:
        note('Q04', 'likely suboptimal programming', 'An efficient prescription permits 0–2 RIR in Foundation. It does not mandate failure, but effort calibration near failure weakens the conservative entry intent. Prefer a reviewed conservative efficient recipe.')
    if '30minute_many_one_set_compounds' in m:
        note('Q04', 'acceptable but debatable coaching choice', 'The short program retains several compound setups with some one-set prescriptions. Low dose can work; review learning and setup costs rather than declaring one set ineffective. Removing redundant assistance may be a better compromise than distributing single sets everywhere.')
    c = p['priorityComparison']
    if c and c['exactSamePrescription']:
        note('Q05', 'clear customization defect', 'Removing only muscle priorities leaves all exercise choices and prescriptions unchanged. Existing work can still be good training, but these selected muscle priorities provide no incremental programming benefit in this context.')
    elif c and all(v == 0 for v in c['directLabelDeltas'].values()):
        note('Q05', 'acceptable but debatable / qualitative review', 'Muscle priorities change choices without increasing primary-labelled priority sets. Some substitutions can meaningfully favour the muscle through secondary exposure, so unchanged label totals alone do not establish failure. Assess the actual exercise and displaced function.')
    elif c:
        positives.append('A muscle-priority counterfactual shows added primary-labelled work; this is a tangible customization change, though its distribution and tradeoffs still matter.')
    if 'unilateral_job_bilateral' in m:
        note('Q05', 'likely suboptimal unless deliberate accommodation', 'A unilateral-knee job becomes bilateral. History/preferences can justify the movement, but the program should acknowledge the lost unilateral stimulus rather than treating the jobs as equivalent.')
    if 'incline_job_flat_press' in m:
        note('Q05', 'acceptable but debatable coaching choice', 'The incline job resolves to a flat chest press. That can favour the requested press movement, but reduces the intended angle distinction and may repeat existing flat pressing.')
    if 'gym_no_knee_flexion' in m:
        classification = 'likely suboptimal programming' if p['family']=='growth' and p['frequency']>=3 else 'acceptable but debatable coaching choice'
        note('Q06', classification, 'All hamstring work uses hip-extension patterns; no leg-curl/knee-flexion exercise is selected. Productive hinge work is present, but functions are not interchangeable. Consider substituting an existing hamstring-assistance entry, especially in a comprehensive hypertrophy plan; minimalist plans need not add work.')
    if 'no_specific_rear_delt_movement' in m and p['family']=='growth' and p['frequency']>=4:
        note('Q06', 'acceptable but debatable coaching choice', 'No specifically rear-delt-focused exercise is selected. Rows may provide meaningful rear-delt stimulus. If mixed-delt jobs repeat lateral raises, a complementary substitution would broaden coverage without adding volume.')
    if 'returning_lifter' in m:
        note('Q07', 'likely suboptimal for demanding combinations; otherwise debatable', 'The returning ramp reduces total sets but leaves total protected sets unchanged. Exercise continuity is useful; full protected dose and any efficient near-failure allowance need to match the actual layoff and present capacity. Review the week-one figures below rather than assuming normal-week totals apply immediately.')
        positives.append('Reentry changes set dose while retaining exercise identity and progression structure, avoiding needless exercise novelty during the return.')
    if m & {'unassisted_chinup','unassisted_chest_dip','glute_ham_raise'}:
        note('Q08', 'acceptable for capable clients; likely suboptimal unscreened default', 'The program includes unaided chin-ups, chest dips or glute-ham raises in an 8–12-rep prescription. Coarse pulling/support permission does not prove strength, exact apparatus or assistance feasibility. Confirm capability or use a vetted available alternative.')
    if 'bands_present_unused' in m:
        note('Q08', 'benign artifact unless a needed function is missing', 'Owned bands are unused because the catalogue has no band candidates. Using every implement is unnecessary; this becomes consequential if the remaining exercises cannot deliver a required function.')
    if 'balanced4_hinge_before_squat_practice' in m:
        note('Q09', 'likely suboptimal default / debatable with hinge priority', 'Lower volume places hinging before knee-volume work. When the latter is paired squat practice, earlier hinge fatigue may reduce useful practice quality. Leg press is less skill-sensitive. Preserve posterior-first order only when that purpose is explicit.')
    if p['family']=='balanced' and 'anchor_backoff' in p['strategies'] and p['frequency']==3:
        positives.append('Primary and volume sessions preserve the same squat/bench for useful practice with different prescriptions; this repetition is purposeful rather than a diversity deficit.')
    if p['family']=='growth' and p['frequency']<=3 and 'posterior_sissy_squat' not in m:
        positives.append('The full-body layout distributes knee/hip work and pressing/pulling across the week; stable machine choices support repeatable loading and keep the main jobs recognizable.')
    if p['family']!='home' and p['frequency']>=4:
        positives.append('The split provides separate upper/lower emphases and recurring main muscle exposures. Its main weakness is the composition of some assistance jobs rather than absence of a useful weekly scaffold.')
    if i.get('profile')=='foundation' and not m & {'foundation_zero_rir_allowed','foundation_heavy_barbell_lunge','posterior_sissy_squat','single_exercise_multiple_job_day'}:
        positives.append('The entry profile uses ordinary ranges and conservative effort, with no heavy-lunge or efficient-zero-RIR defaults; evaluate the starting dose for the actual beginner rather than imposing a two-set rule.')
    if p['family']=='strength' and i.get('profile')!='foundation':
        positives.append('The primary strength movement is placed first and has a specific effort-target prescription; this is coherent general-strength work, not a promise of sport-specific powerlifting preparation.')
    if p['family']=='home' and 'dumbbell' in i['equipment'] and p['functionalExposure']['hipHingeSets']['sets']>0 and p['functionalExposure']['horizontalPullSets']['sets']>0:
        positives.append('Available dumbbells provide genuine hip and row work, helping the home plan preserve function despite limited apparatus.')
    if i['ignoredMuscles']:
        positives.append('Direct-work exclusions can sensibly reduce accessory scope while compounds retain secondary involvement; they should not be interpreted as eliminating all physiological use of those muscles.')
    if 'same_day_duplicate' not in m:
        positives.append('Within each session the exercise choices remain distinct; the layout avoids accidental repeated entries while still allowing useful across-week practice.')
    if i['sessionMinutes']<=45 and p['family']=='strength' and i.get('profile')!='foundation':
        positives.append('The constrained session keeps strength primaries and essential assistance while optional accessory work is a lower priority; absence of isolation is not automatically deficient.')
    if not positives:
        positives.append('Exercise identity and explicit dose remain stable and understandable; the functional and distribution concerns below need correction before this becomes a confident client prescription.')
    if 'posterior_sissy_squat' in m or 'single_exercise_multiple_job_day' in m:
        appraisal='Revise before issuing: a central function or coverage claim does not survive the actual selection.'
    elif 'foundation_heavy_barbell_lunge' in m or 'three_hinge_entries' in m:
        appraisal='Needs focused selection review: useful scaffolding, but default exercise demands or redundant assistance weaken the complete prescription.'
    elif 'posterior_split_squat' in m or 'foundation_zero_rir_allowed' in m:
        appraisal='Needs contextual coaching review: the profile or functional substitution is less convincing than its labels suggest.'
    else:
        appraisal='Broadly coherent in its stated context, with the qualified coverage, capability and customization considerations below.'
    return {'id':p['id'],'appraisal':appraisal,'positivePatterns':positives,'considerations':notes}

lines = ['# Individual qualitative coaching reviews — 200 complete programs', '',
    'These case reviews support the [ranked coaching report](README.md). They use the saved prescriptions, not regenerated substitutes. No numeric quality score or universal volume threshold is assigned. Counts are prescribed sets: catalogue primary/secondary labels are shown separately and do not establish physiological effective-set equivalence. Exact weekdays are unspecified. Normal-week exercise recipes below apply alongside the actual six-week set schedule; returning weeks reduce some entries.', '',
    'The narrative interpretations were authored after reviewing the complete cohort. The renderer associates those interpretations with documented observations; a descriptive marker is not automatically a defect.', '',
    'Index: ' + ' · '.join(f"[{p['id']}](#{p['id'].lower()})" for p in data['programs']), '']
assessments = []
for p in data['programs']:
    i=p['input']; a=review(p); assessments.append(a)
    eq=', '.join(i['equipment']) or 'bodyweight only'
    env=', '.join(i['environment']) or 'none'
    lines += [f"## {p['id']}", '',
        f"**Context:** {p['cohort']}; {p['family'].title()}, {p['frequency']} days/week, {i['sessionMinutes']} minutes/session; {i.get('profile','standard')}; {eq}; environment capabilities: {env}. Consistency: {i.get('recentConsistency')}; reentry: {i.get('reentryEnabled')}. Requested rest: {i.get('preferredRestSeconds') or 'default'}.", '',
        '**Choices:** muscle priorities: '+(', '.join(i['primaryMuscles']) or 'none')+'; movement priorities: '+(', '.join(i['priorityMovements']) or 'none')+'; de-emphasis: '+(', '.join(i['deEmphasizedMuscles']) or 'none')+'; direct-work exclusions: '+(', '.join(i['ignoredMuscles']) or 'none')+'. Preferences: '+(', '.join(i['preferences']) or 'none')+'; dislikes: '+(', '.join(i['dislikes']) or 'none')+'; history: '+(', '.join(h['libraryId'] for h in i['history']) or 'none')+'.', '',
        '**Coaching appraisal:** '+a['appraisal'], '', '**Positive patterns:**', '']
    lines += ['- '+t for t in a['positivePatterns']]
    lines += ['', '**Considerations:**', '']
    lines += [f"- **[{n['finding']}](README.md#{ {'Q01':'q01--a-knee-dominant-exercise-is-presented-as-posterior-chain-training','Q02':'q02--independent-selection-collapses-distinct-jobs-and-concentrates-redundant-work','Q03':'q03--foundation-ranking-selects-cumbersome-low-rep-defaults','Q04':'q04--time-compression-can-undermine-the-conservative-profile-and-retain-too-many-setups','Q05':'q05--priorities-and-preferences-do-not-reliably-improve-the-intended-prescription','Q06':'q06--posterior-and-shoulder-coverage-is-narrower-than-the-number-of-jobs-suggests','Q07':'q07--returning-lifter-relief-does-not-necessarily-reach-the-most-consequential-work','Q08':'q08--home-equipment-permission-is-treated-as-exercise-capability','Q09':'q09--default-ordering-can-fatigue-the-movement-the-session-is-meant-to-practise'}[n['finding']]}) — {n['classification']}:** {n['judgment']}" for n in a['considerations']]
    lines += ['', '**Week-level dose and distribution:**', '',
        '- Total prescribed sets, weeks 1–6: '+ ' → '.join(str(w['sets']) for w in p['weeks'])+'.',
        '- Protected sets, weeks 1–3: '+ ' → '.join(str(w['protectedSets']) for w in p['weeks'][:3])+'. Protected does not mean every set is equally heavy.',
        '- Normal-session sets, in order: '+', '.join(f"{d['label']}: {d['sets']}" for d in p['days'])+'.',
        '- Primary-labelled muscle sets: '+', '.join(f'{k}: {v}' for k,v in p['directLabelSets'].items())+'.',
        '- Secondary-labelled exposures (not added as equivalent direct sets): '+(', '.join(f'{k}: {v}' for k,v in p['secondaryLabelSets'].items()) or 'none')+'.',
        '- Movement function, sets / exposure days: '+', '.join(f"{k.replace('Sets','')}: {v['sets']} / {v['days']}" for k,v in p['functionalExposure'].items() if k!='isolationMovementSets')+'.',
        '- Order, rest and effort are shown below. Specific weekdays are not prescribed, so recovery between adjacent exposures cannot be established from frequency alone.', '']
    if p['priorityComparison']:
        lines += ['**Priority comparison:** '+json.dumps(p['priorityComparison'])+'. Primary-label deltas are descriptive; exact unchanged prescriptions are stronger evidence of a customization no-op.', '']
    for index,d in enumerate(p['days']):
        os=original[p['id']]['result']['days'][index]['slots']
        lines += [f"### Session {index+1}: {d['label']}", '', '| Order | Exercise | Intended job | Actual normal-week prescription | Rest | Sets W1 / W2 / W3 |', '|---:|---|---|---|---:|---|']
        for position,(s,raw) in enumerate(zip(d['actualExerciseOrder'],os)):
            ws=[next(x['sets'] for wd in w['days'] for x in wd['slots'] if x['slotId']==raw['slotId']) for w in original[p['id']]['result']['weeks'][:3]]
            lines.append(f"| {position+1} | {s['exercise']} (`{s['id']}`) | `{raw['templateId']}` | {s['actualPrescription']} | {s['restSeconds']} s | {' / '.join(map(str,ws))} |")
        lines += ['']
        for dup in d['duplicates']:
            lines += [f"Observed repetition: **{dup['exercise']}** appears {dup['entries']} times, {dup['sets']} total work sets, for jobs {', '.join(dup['jobs'])}. Repetition should be judged by those jobs and recipes, not by ID count alone.", '']
(HERE/'program-reviews.md').write_text('\n'.join(lines)+'\n')
(HERE/'individual-assessments.json').write_text(json.dumps({'basis':'Qualified coaching judgments linked to the complete saved prescriptions; not a numerical model of stimulus or safety.','programs':assessments},indent=2)+'\n')
print(f'Wrote {len(assessments)} individual coaching reviews.')
