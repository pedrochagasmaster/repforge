/**
 * A believable training history for the landing renders.
 *
 * The UI-screen catalog's fixture exists to stress layout, so it logs
 * `80 + i*5` kg into every exercise — which is how a machine lateral raise ends
 * up at 100 kg and "+87.5 kg over your best". Nothing on a landing page should
 * make a lifter squint. This fixture is one intermediate lifter, three full-body
 * days, twelve logged sessions across four weeks, with per-exercise loads and a
 * progression ladder that a real person would recognise.
 */

const PROGRAM = [
  // day, id, EN name, PT name, libraryId, sets, min, max, primary, secondary, ladder (wk1..wk4), reps, rir
  ['Day 1', 'ex-squat', 'Barbell back squat',        'Agachamento livre com barra',        'sq_bb', 3,  5,  8, 'Quads', 'Glutes,Hamstrings',        [92.5, 95, 97.5, 100], [6, 7, 7, 8], [2, 2, 1, 1]],
  ['Day 1', 'ex-bench', 'Barbell bench press',       'Supino com barra',                   'pr_bb', 3,  5,  8, 'Chest', 'Triceps,Front delts',      [70, 72.5, 75, 77.5],  [6, 6, 7, 7], [2, 2, 2, 1]],
  ['Day 1', 'ex-rdl',   'Barbell Romanian deadlift', 'Levantamento terra romeno com barra','hg_bb', 3,  8, 12, 'Hamstrings,Glutes', 'Spinal erectors', [77.5, 80, 82.5, 85], [9, 10, 10, 11], [2, 2, 2, 1]],
  ['Day 1', 'ex-row',   'Barbell row',               'Remada com barra',                   'rw_bb', 3,  8, 12, 'Mid/upper back', 'Lats,Rear delts,Biceps', [52.5, 55, 57.5, 60], [9, 10, 10, 11], [2, 2, 2, 1]],
  ['Day 1', 'ex-lat',   'Dumbbell lateral raise',    'Elevação lateral com halteres',      'lr_db', 3, 12, 15, 'Side delts', '',                    [9, 10, 11, 12],       [13, 13, 14, 14], [2, 2, 2, 1]],

  ['Day 2', 'ex-dl',    'Barbell deadlift',          'Levantamento terra com barra',       'dl_bb', 3,  3,  6, 'Hamstrings,Glutes', 'Spinal erectors', [115, 120, 125, 127.5], [4, 5, 5, 6], [2, 2, 1, 1]],
  ['Day 2', 'ex-inc',   'Dumbbell incline press',    'Supino inclinado com halteres',      'ip_db', 3,  8, 12, 'Chest', 'Front delts,Triceps',      [26, 28, 30, 30],      [9, 10, 10, 11], [2, 2, 2, 1]],
  ['Day 2', 'ex-pd',    'Lat pulldown',              'Puxada frontal',                     'pd_mc', 3,  8, 12, 'Lats', 'Biceps,Forearms',           [57.5, 60, 62.5, 65],  [9, 10, 10, 11], [2, 2, 2, 1]],
  ['Day 2', 'ex-ext',   'Leg extension',             'Cadeira extensora',                  'le_mc', 3, 10, 15, 'Quads', '',                         [45, 50, 52.5, 55],    [12, 13, 13, 14], [2, 2, 2, 1]],
  ['Day 2', 'ex-curl2', 'Barbell curl',              'Rosca com barra',                    'cu_bb', 2,  8, 12, 'Biceps', 'Forearms',                [27.5, 30, 30, 32.5],  [9, 10, 11, 11], [2, 2, 1, 1]],

  ['Day 3', 'ex-press', 'Leg press',                 'Leg press',                          'sq_lp', 3,  8, 12, 'Quads', 'Glutes',                   [130, 140, 150, 155],  [9, 10, 10, 11], [2, 2, 2, 1]],
  ['Day 3', 'ex-ohp',   'Barbell overhead press',    'Desenvolvimento com barra',          'sp_bb', 3,  5,  8, 'Front delts', 'Side delts,Triceps', [42.5, 45, 45, 47.5],  [6, 6, 7, 7], [2, 2, 2, 1]],
  ['Day 3', 'ex-cable', 'Cable seated row',          'Remada sentada na polia',            'rw_cb', 3,  8, 12, 'Mid/upper back', 'Lats,Biceps',     [57.5, 60, 62.5, 65],  [9, 10, 10, 11], [2, 2, 2, 1]],
  ['Day 3', 'ex-ham',   'Seated leg curl',           'Cadeira flexora',                    'lc_mc', 3, 10, 15, 'Hamstrings', '',                    [37.5, 40, 42.5, 45],  [12, 13, 13, 14], [2, 2, 2, 1]],
  ['Day 3', 'ex-tri',   'Cable pressdown',           'Tríceps na polia',                   'tr_cb', 2, 10, 15, 'Triceps', '',                       [22.5, 25, 27.5, 27.5],[12, 13, 13, 14], [2, 2, 1, 1]],
];

const DAY_PT = {'Day 1': 'Dia 1', 'Day 2': 'Dia 2', 'Day 3': 'Dia 3'};

// four training weeks logged; week five is the one the visitor is looking at
const DATES = {
  'Day 1': ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24'],
  'Day 2': ['2026-08-05', '2026-08-12', '2026-08-19', '2026-08-26'],
  'Day 3': ['2026-08-07', '2026-08-14', '2026-08-21', '2026-08-28'],
};

export function realisticState(lang = 'en') {
  const program = [];
  const log = [];
  const byDay = {};

  for (const row of PROGRAM) {
    const [dayEn, id, nameEn, namePt, libraryId, sets, min, max, primary, secondary, ladder, reps, rir] = row;
    // every exercise is a real library entry, so the Portuguese name is the
    // catalog's own translation rather than something invented here
    const name = lang === 'pt' ? namePt : nameEn;
    const day = lang === 'pt' ? DAY_PT[dayEn] : dayEn;
    byDay[day] = (byDay[day] || 0) + 1;
    program.push({
      id, day, order: byDay[day], name, sets, min, max, primary, secondary,
      notes: '', alternates: [], libraryId,
    });

    DATES[dayEn].forEach((date, week) => {
      const session = `${date}_${day}_real`;
      for (let set = 1; set <= sets; set++) {
        log.push({
          session, date, day, name, exerciseId: id, set,
          load: ladder[week],
          // a real set drops a rep or two as the session goes on
          reps: Math.max(min, reps[week] - (set - 1)),
          rir: Math.max(0, rir[week] - (set - 1) > 0 ? rir[week] - (set - 1) : 0),
          notes: '', created: `${date}T18:${10 + set}:00.000Z`,
          primary, secondary, performedLibraryId: libraryId,
        });
      }
    });
  }

  return {
    settings: {
      jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 150, lastExport: '',
      unit: 'kg', lang, rirMode: 'numeric', voiceInputEnabled: false,
      notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
    },
    programMeta: {
      id: 'real-program', name: lang === 'pt' ? 'Corpo inteiro' : 'Full body',
      started: '2026-08-03', created: '2026-08-05T00:00:00.000Z', updated: '2026-08-05T00:00:00.000Z',
      onboarded: true, mesocycleStatus: 'active', mesocycleLengthWeeks: 6,
      goal: 'hypertrophy', experience: 'intermediate', daysPerWeek: 3,
      splitType: 'full_body', equipment: ['barbell', 'dumbbells', 'machines', 'cables'],
      priorityMuscles: ['Quads', 'Chest'], sessionLength: '60', completedAt: null,
    },
    program, log, programHistory: [], customExercises: [], _storageRevision: 40,
  };
}

/** Realistic working loads for the week-4 session the summary screen saves. */
export const WEEK4_LOADS = {
  'ex-squat': 102.5, 'ex-bench': 80, 'ex-rdl': 87.5, 'ex-row': 62.5, 'ex-lat': 12.5,
};
