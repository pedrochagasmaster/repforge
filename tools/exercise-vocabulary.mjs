#!/usr/bin/env node
/* Taurifer's mapping vocabularies, shared by tools/build-exercises.mjs and
   tools/expand-curation.mjs.

   Nothing here runs in the browser or at install time. This module holds the
   part of the upstream→Taurifer translation that both the generator and the
   curation expander have to agree on: equipment, muscle tokens, delt-head
   resolution, display-name repair, pattern→muscle mapping, and the Portuguese
   phrase tables. Splitting it out is what lets the expander propose curation
   records that the generator will read back identically.

   Source dataset: https://github.com/hasaneyldrm/exercises-dataset (MIT for the
   data). Its images/ and videos/ are NOT MIT — they belong to Gym visual and
   are licensed to that repository alone, so nothing here reads or ships media. */

/* ---------- Taurifer's vocabularies ----------------------------------- */

/* Equipment the onboarding wizard can filter on. "smith" implies "machine"
   so a machines-only lifter still gets Smith work. */
const EQUIPMENT = {
  "barbell": ["barbell"],
  "olympic barbell": ["barbell"],
  "ez barbell": ["barbell"],
  "trap bar": ["barbell"],
  "dumbbell": ["dumbbell"],
  "kettlebell": ["dumbbell"],
  "cable": ["cable"],
  "leverage machine": ["machine"],
  "sled machine": ["machine"],
  "assisted": ["machine"],
  "smith machine": ["smith", "machine"],
  "body weight": ["bodyweight"],
  "weighted": ["bodyweight"],
  "band": ["bodyweight"],
  "resistance band": ["bodyweight"],
  /* Implements a lifter brings to the floor rather than a station they book.
     Taurifer's wizard filters on six buckets, and none of these is a seventh:
     they are all "needs no rack", which is what "bodyweight" means here — the
     same bucket "band" and "weighted" already sit in. */
  "stability ball": ["bodyweight"],
  "bosu ball": ["bodyweight"],
  "medicine ball": ["bodyweight"],
  "roller": ["bodyweight"],
  "wheel roller": ["bodyweight"],
  "rope": ["bodyweight"],
  "hammer": ["bodyweight"],
  "tire": ["bodyweight"],
  /* Ergometers are stations. The rows that carry a real muscle target (the
     hands bike, the ski erg) belong with the machines; the ones targeting the
     cardiovascular system carry no Taurifer muscle token and are dropped by
     the curation expander instead. */
  "upper body ergometer": ["machine"],
  "skierg machine": ["machine"],
  "stationary bike": ["machine"],
  "elliptical machine": ["machine"],
  "stepmill machine": ["machine"]
};

/* The source's undifferentiated shoulder tag. Distinct from null, which means
   "Taurifer does not model this muscle" — see MUSCLES. */
const DELT_HEAD_UNKNOWN = Symbol("delt head unknown");

/* Upstream muscle names → the tokens Taurifer's volume audit groups by. The
   upstream vocabulary carries synonyms (quads/quadriceps, traps/trapezius,
   lats/latissimus dorsi) that have to collapse, or the audit splits one muscle
   across two rows. Anything mapping to null is dropped as noise rather than
   invented into a token. */
const MUSCLES = {
  "pectorals": "Chest", "chest": "Chest", "upper chest": "Chest",
  "biceps": "Biceps", "brachialis": "Biceps",
  "triceps": "Triceps",
  "lats": "Lats", "latissimus dorsi": "Lats",
  "upper back": "Mid/upper back", "rhomboids": "Mid/upper back", "back": "Mid/upper back",
  "traps": "Traps", "trapezius": "Traps",
  "quads": "Quads", "quadriceps": "Quads",
  "hamstrings": "Hamstrings",
  "glutes": "Glutes",
  "calves": "Calves", "soleus": "Calves",
  "adductors": "Adductors", "inner thighs": "Adductors", "groin": "Adductors",
  "abductors": "Abductors",
  "abs": "Abs", "abdominals": "Abs", "core": "Abs", "lower abs": "Abs",
  "obliques": "Obliques",
  "spine": "Spinal erectors", "lower back": "Spinal erectors",
  "forearms": "Forearms", "wrist flexors": "Forearms", "wrist extensors": "Forearms",
  "grip muscles": "Forearms", "hands": "Forearms", "wrists": "Forearms",
  "rear deltoids": "Rear delts",
  // Undifferentiated in the source; split by movement below.
  "delts": DELT_HEAD_UNKNOWN, "deltoids": DELT_HEAD_UNKNOWN, "shoulders": DELT_HEAD_UNKNOWN,
  // Not modelled by Taurifer — dropping beats inventing a token the audit
  // would then have to render. Distinct from the shoulder tags above: those
  // resolve to a head, these resolve to nothing at all. Reading a movement's
  // primary off one of them is how a stationary bike ends up counted as front
  // delt volume.
  "hip flexors": null, "serratus anterior": null, "rotator cuff": null,
  "levator scapulae": null, "cardiovascular system": null, "ankles": null,
  "ankle stabilizers": null, "feet": null, "shins": null,
  "sternocleidomastoid": null
};

/* The source tags every shoulder movement "delts" without saying which head,
   but hard-set volume per head is exactly what a hypertrophy audit is for.
   Resolved from the movement name; first match wins. */
const DELT_HEAD = [
  [/rear|reverse fly|reverse pec|rear delt|bent.over lateral|incline rear/i, "Rear delts"],
  [/lateral raise|side raise|upright row|lateral to front/i, "Side delts"],
  [/front raise|forward raise|shoulder raise/i, "Front delts"],
  [/press|push press|jerk|thruster|arnold/i, "Front delts"]
];

/* Movement-name repairs. The upstream names are lowercase, carry a few
   mojibake artifacts and typos, and tag some rows with the model's sex. */
const NAME_FIXES = [
  [/в°/g, "°"],
  [/\s*\((?:male|female)\)\s*/gi, " "],
  [/\s*v\.\s*\d+\s*$/i, ""],
  // Camera-angle splits of one movement, not two movements.
  [/\s*\((?:back|side|front)\s+pov\)\s*/gi, " "],
  // Upstream typos. Each is a real name in the dataset, not a guess.
  [/\bsquad stretch\b/gi, "squat stretch"],
  [/\bhug keens to chest\b/gi, "hug knees to chest"],
  [/\bstanding calves calf raise\b/gi, "standing calf raise"],
  [/\bcalves stretch\b/gi, "calf stretch"],
  [/\bstanding calves calf stretch\b/gi, "standing calf stretch"],
  [/\bdepresor\b/gi, "depressor"],
  [/\bwrist rollerer\b/gi, "wrist roller"],
  [/\brollerout\b/gi, "roll-out"],
  [/\brevers\b/gi, "reverse"],
  [/\bpeacher\b/gi, "preacher"],
  [/\bsitted\b/gi, "seated"],
  [/\bcalves\b(?=\s+(?:raise|press))/gi, "calf"],
  [/\bdumbbells\b/gi, "dumbbell"],
  [/\bstanding leg calf raise\b/gi, "standing calf raise"],
  [/_shoulder\b/gi, ""],
  // "Lever" and "Sled" are the source's words for plate-loaded and sled-based
  // machines; lifters read them as machines.
  [/^lever\s+/i, "machine "],
  [/^sled\s+/i, "machine "],
  [/^smith\s+(?!machine)/i, "smith machine "],
  [/^ez[-\s]?bar(bell)?\s+/i, "EZ-bar "],
  [/\barnold\b/g, "Arnold"],
  [/\s{2,}/g, " "]
];

/* The pattern a movement was curated into is the authority on what it trains.
   The upstream target field disagrees often enough to matter — it calls every
   squat and Romanian deadlift a glute exercise — and its secondary lists run
   to noise (front delts on a calf raise). So primary comes from the pattern,
   and upstream secondaries are kept only where they are plausible for it. */
const PATTERN_MUSCLES = {
  squat: ["Quads", ["Glutes", "Adductors", "Hamstrings", "Spinal erectors", "Calves"]],
  hinge: ["Hamstrings,Glutes", ["Spinal erectors", "Quads", "Traps", "Forearms"]],
  leg_extension: ["Quads", []],
  leg_curl: ["Hamstrings", ["Glutes", "Calves"]],
  calves: ["Calves", []],
  press: ["Chest", ["Front delts", "Triceps"]],
  incline_press: ["Chest", ["Front delts", "Triceps"]],
  chest_iso: ["Chest", ["Front delts"]],
  shoulder_press: ["Front delts", ["Side delts", "Triceps", "Mid/upper back"]],
  lateral_raise: ["Side delts", ["Front delts", "Traps"]],
  delts: ["Side delts", ["Front delts", "Traps", "Rear delts"]],
  rear_delt: ["Rear delts", ["Mid/upper back", "Traps", "Biceps"]],
  row: ["Mid/upper back", ["Lats", "Rear delts", "Biceps", "Forearms", "Traps"]],
  pulldown: ["Lats", ["Mid/upper back", "Biceps", "Rear delts", "Forearms"]],
  pull: ["Lats", ["Mid/upper back", "Chest", "Triceps"]],
  traps: ["Traps", ["Mid/upper back", "Forearms"]],
  curl: ["Biceps", ["Forearms"]],
  arms: ["Biceps", ["Forearms"]],
  triceps: ["Triceps", ["Chest", "Front delts"]],
  adduction: ["Adductors", ["Glutes"]],
  abduction: ["Abductors", ["Glutes"]],
  abs: ["Abs", ["Obliques", "Spinal erectors"]],
  forearms: ["Forearms", []]
};

/* Portuguese. Exercise names are compositional in both languages, but they
   compose in opposite orders: English stacks qualifiers in front of the
   movement ("dumbbell seated shoulder press"), Portuguese trails them behind
   it ("desenvolvimento sentado com halteres"). So each phrase carries a role,
   matches are collected longest-first, and the name is reassembled in
   Portuguese order — core, qualifiers, equipment, grip. Whatever the table
   misses gets a namePt override in the curation file; --report lists those. */
const CORE = "core", QUAL = "qual", EQUIP = "equip", GRIP = "grip";
const PT_CORES = [
  ["romanian deadlift", "levantamento terra romeno"],
  ["straight leg deadlift", "levantamento terra pernas retas"],
  ["stiff leg deadlift", "levantamento terra pernas semirrígidas"],
  ["single leg deadlift", "levantamento terra unilateral"],
  ["sumo deadlift", "levantamento terra sumô"],
  ["deadlift", "levantamento terra"],
  ["close-grip bench press", "supino fechado"],
  ["close grip bench press", "supino fechado"],
  ["guillotine bench press", "supino guilhotina"],
  ["bench press", "supino"],
  ["incline press", "supino inclinado"],
  ["decline press", "supino declinado"],
  ["chest press", "supino máquina"],
  ["inner chest press", "supino máquina pegada fechada"],
  ["overhead press", "desenvolvimento"],
  ["military press", "desenvolvimento militar"],
  ["shoulder press", "desenvolvimento"],
  ["arnold press", "desenvolvimento Arnold"],
  ["push press", "desenvolvimento com impulso"],
  ["close-grip press", "supino fechado"],
  ["push-up", "flexão de braço"],
  ["push up", "flexão de braço"],
  ["diamond push-up", "flexão diamante"],
  ["handstand push-up", "flexão parada de mão"],
  ["chest dip on high parallel bars", "mergulho nas paralelas altas"],
  ["chest dip", "mergulho nas paralelas"],
  ["triceps dip", "mergulho de tríceps"],
  ["overhand triceps dip", "mergulho de tríceps pronado"],
  ["seated dip", "mergulho sentado"],
  ["bench dip", "mergulho no banco"],
  ["dip", "mergulho"],
  ["pec deck", "peck deck"],
  ["crossover", "crossover"],
  ["cross-over", "crossover"],
  ["reverse fly", "crucifixo inverso"],
  ["rear delt fly", "crucifixo inverso"],
  ["rear delt raise", "elevação posterior"],
  ["rear lateral raise", "elevação posterior"],
  ["rear delt row", "remada alta posterior"],
  ["fly", "crucifixo"],
  ["pullover", "pullover"],
  ["lat pulldown", "puxada frontal"],
  ["lateral pulldown", "puxada frontal"],
  ["front pulldown", "puxada frontal"],
  ["underhand pulldown", "puxada supinada"],
  ["straight arm pulldown", "pulldown com braços estendidos"],
  ["pulldown", "puxada"],
  ["pull-up", "barra fixa"],
  ["pull up", "barra fixa"],
  ["chin-up", "barra fixa supinada"],
  ["chin up", "barra fixa supinada"],
  ["scapular pull-up", "barra fixa escapular"],
  ["inverted row", "remada invertida"],
  ["suspended row", "remada suspensa"],
  ["upright row", "remada alta"],
  ["bent over row", "remada curvada"],
  ["bent-over row", "remada curvada"],
  ["pendlay row", "remada Pendlay"],
  ["seated row", "remada sentada"],
  ["high row", "remada alta"],
  ["t-bar row", "remada cavalinho"],
  ["t bar row", "remada cavalinho"],
  ["row", "remada"],
  ["shrug", "encolhimento"],
  ["gripless shrug", "encolhimento sem pegada"],
  ["preacher curl", "rosca scott"],
  ["hammer curl", "rosca martelo"],
  ["concentration curl", "rosca concentrada"],
  ["spider curl", "rosca spider"],
  ["drag curl", "rosca drag"],
  ["zottman curl", "rosca Zottman"],
  ["reverse curl", "rosca inversa"],
  ["reverse wrist curl", "rosca de punho inversa"],
  ["wrist curl", "rosca de punho"],
  ["finger curls", "rosca de dedos"],
  ["biceps curl", "rosca direta"],
  ["bicep curl", "rosca direta"],
  ["curl", "rosca"],
  ["skull crusher", "tríceps testa"],
  ["skullcrusher", "tríceps testa"],
  ["lying triceps extension", "tríceps testa"],
  ["overhead triceps extension", "tríceps francês"],
  ["triceps extension", "extensão de tríceps"],
  ["tricep extension", "extensão de tríceps"],
  ["triceps pushdown", "tríceps na polia"],
  ["pushdown", "tríceps na polia"],
  ["pressdown", "tríceps na polia"],
  ["kickback", "tríceps coice"],
  ["lateral raise", "elevação lateral"],
  ["full can lateral raise", "elevação lateral full can"],
  ["front raise", "elevação frontal"],
  ["back squat", "agachamento livre"],
  ["front squat", "agachamento frontal"],
  ["high bar squat", "agachamento barra alta"],
  ["low bar squat", "agachamento barra baixa"],
  ["hack squat", "agachamento hack"],
  ["goblet squat", "agachamento goblet"],
  ["split squat", "agachamento búlgaro"],
  ["split squats", "agachamento búlgaro"],
  ["sissy squat", "agachamento sissy"],
  ["zercher squat", "agachamento Zercher"],
  ["chair squat", "agachamento na cadeira"],
  ["full squat", "agachamento completo"],
  ["squat", "agachamento"],
  ["one leg press", "leg press unilateral"],
  ["leg press", "leg press"],
  ["leg extension", "cadeira extensora"],
  ["seated leg curl", "cadeira flexora"],
  ["lying leg curl", "mesa flexora"],
  ["lying two-one leg curl", "mesa flexora excêntrica"],
  ["kneeling leg curl", "flexora ajoelhado"],
  ["inverse leg curl", "flexora nórdica"],
  ["glute-ham raise", "elevação glúteo-femoral"],
  ["lying femoral", "mesa flexora"],
  ["leg curl", "flexora"],
  ["good morning", "bom dia"],
  ["glute bridge", "elevação pélvica"],
  ["hip extension", "extensão de quadril"],
  ["hip adduction", "cadeira adutora"],
  ["hip abduction", "cadeira abdutora"],
  ["hip thrust", "elevação pélvica"],
  ["reverse hyperextension", "hiperextensão inversa"],
  ["hyperextension", "hiperextensão"],
  ["back extension", "extensão lombar"],
  ["rack pull", "rack pull"],
  ["pull through", "pull through"],
  ["swing", "swing"],
  ["lunge", "afundo"],
  ["step-up", "subida no banco"],
  ["step up", "subida no banco"],
  ["calf raise", "elevação de panturrilha"],
  ["calf press on leg press", "panturrilha no leg press"],
  ["calf press", "panturrilha no leg press"],
  ["donkey calf raise", "panturrilha burrinho"],
  ["reverse calf raises", "elevação de ponta de pé"],
  ["toe raise", "elevação de ponta de pé"],
  ["reverse crunch", "abdominal invertido"],
  ["crunch", "abdominal"],
  ["leg raise crunch", "abdominal com elevação de pernas"],
  ["full sit-up", "abdominal completo"],
  ["sit-up", "abdominal completo"],
  ["russian twist", "abdominal russo"],
  ["straight twisting leg hip raise", "elevação de pernas e quadril estendidas com rotação"],
  ["straight leg hip raise", "elevação de pernas e quadril estendidas"],
  ["leg-hip raise", "elevação de pernas e quadril"],
  ["leg hip raise", "elevação de pernas e quadril"],
  ["straight leg raise", "elevação de pernas estendidas"],
  ["leg raise", "elevação de pernas"],
  ["knee raise", "elevação de joelhos"],
  ["side bend", "flexão lateral de tronco"],
  ["dead bug", "dead bug"],
  ["front plank", "prancha frontal"],
  ["plank", "prancha"],
  ["twist", "rotação de tronco"],
  ["gripper hands", "aparelho de pegada"],

  /* ---- the rest of the corpus -------------------------------------------
     Everything above named a movement Taurifer had already reviewed. What
     follows covers the tail the full dataset brings with it: stretches and
     mobility work, the Olympic lifts, gymnastic holds, medicine-ball throws,
     and conditioning. Longest phrase wins (PT_TABLE sorts by length), so the
     compound entries here sit safely in front of the bare fallbacks at the
     bottom of this block.

     Loanwords are left as loanwords on purpose. "Burpee", "planche", "front
     lever", "muscle up" and "thruster" are what a Brazilian lifter says; a
     literal translation would be a word nobody uses. */

  // Stretching and mobility. Spelled out per muscle rather than composed,
  // because "de panturrilha" as a general qualifier would follow every calf
  // movement around and read as noise on the ones that already say it.
  ["calf stretch", "alongamento de panturrilha"],
  ["calf push stretch", "alongamento de panturrilha com empurrada"],
  ["hamstring stretch", "alongamento de isquiotibiais"],
  ["hamstring and calf stretch", "alongamento de isquiotibiais e panturrilha"],
  ["quads stretch", "alongamento de quadríceps"],
  ["quad stretch", "alongamento de quadríceps"],
  ["hip flexor and quad stretch", "alongamento de flexores do quadril e quadríceps"],
  ["glute stretch", "alongamento de glúteo"],
  ["glutes stretch", "alongamento de glúteo"],
  ["gluteus and piriformis stretch", "alongamento de glúteo e piriforme"],
  ["piriformis stretch", "alongamento de piriforme"],
  ["rectus femoris stretch", "alongamento de reto femoral"],
  ["pectoralis major stretch", "alongamento de peitoral maior"],
  ["adductor stretch", "alongamento de adutores"],
  ["pec stretch", "alongamento de peitoral"],
  ["chest stretch", "alongamento de peitoral"],
  ["chest and front of shoulder stretch", "alongamento de peitoral e ombro"],
  ["lat stretch", "alongamento de dorsal"],
  ["hip lat stretch", "alongamento de quadril e dorsal"],
  ["hip flexor stretch", "alongamento de flexores do quadril"],
  ["hip stretch", "alongamento de quadril"],
  ["lower back stretch", "alongamento lombar"],
  ["upper back stretch", "alongamento de dorsal alta"],
  ["back stretch", "alongamento de costas"],
  ["neck stretch", "alongamento de pescoço"],
  ["triceps stretch", "alongamento de tríceps"],
  ["deltoid stretch", "alongamento de deltoide"],
  ["shoulder stretch", "alongamento de ombro"],
  ["knee stretch", "alongamento de joelho"],
  ["wrist pull stretch", "alongamento de punho"],
  ["spine stretch", "alongamento de coluna"],
  ["peroneals stretch", "alongamento de fibulares"],
  ["posterior tibialis stretch", "alongamento de tibial posterior"],
  ["leg extended stretch", "alongamento de perna estendida"],
  ["floor stretch", "alongamento no chão"],
  ["lateral stretch", "alongamento lateral"],
  ["frog stretch", "alongamento do sapo"],
  ["squat stretch", "alongamento em agachamento"],
  ["runners stretch", "alongamento do corredor"],
  ["world greatest stretch", "alongamento world's greatest"],
  ["iron cross stretch", "alongamento cruz de ferro"],
  ["stretch lunge", "afundo com alongamento"],
  ["abdominal fallout", "roll-out abdominal"],
  ["butterfly yoga pose", "postura da borboleta"],
  ["reclining big toe pose", "postura do dedão reclinada"],
  ["wide angle pose sequence", "sequência de abertura sentada"],
  ["upward facing dog", "cachorro olhando para cima"],
  ["yoga pose", "postura de ioga"],
  ["pelvic tilt", "báscula pélvica"],
  ["wrist circles", "circundução de punho"],
  ["ankle circles", "circundução de tornozelo"],
  ["hug knees to chest", "joelhos ao peito"],
  ["exercise ball hug", "abraço na bola suíça"],

  // Olympic and power lifts.
  ["clean and jerk", "arremesso"],
  ["clean and press", "clean e desenvolvimento"],
  ["power clean", "power clean"],
  ["hang clean", "clean suspenso"],
  ["clean", "clean"],
  ["snatch pull", "puxada de arranco"],
  ["snatch", "arranco"],
  ["jerk", "jerk"],
  ["thruster", "thruster"],
  ["high pull", "puxada alta"],
  ["tire flip", "viragem de pneu"],
  ["sledge hammer", "marreta"],
  ["farmers walk", "caminhada do fazendeiro"],
  ["single arm overhead carry", "caminhada com carga acima da cabeça"],

  // Presses the reviewed set never needed a name for.
  ["floor press", "supino no chão"],
  ["pin press", "supino no pino"],
  ["svend press", "press Svend"],
  ["tate press", "press Tate"],
  ["pallof press", "press Pallof"],
  ["cuban press", "press cubano"],
  ["bradford press", "press Bradford"],
  ["bradford rocky press", "press Bradford"],
  ["scott press", "press Scott"],
  ["w-press", "press em W"],
  ["triceps press", "press de tríceps"],
  ["french press", "tríceps francês"],
  ["anti gravity press", "press antigravidade"],
  ["stalder press", "stalder press"],
  ["face press", "press na altura do rosto"],
  ["skull press", "supino testa"],
  ["elbow press", "press com cotovelos"],
  ["behind neck press", "desenvolvimento atrás da nuca"],
  ["seesaw press", "desenvolvimento alternado"],
  ["bent press", "press curvado"],

  // Gymnastic strength and holds.
  ["planche", "planche"],
  ["maltese", "maltese"],
  ["front lever", "front lever"],
  ["back lever", "back lever"],
  ["muscle up", "muscle up"],
  ["muscle-up", "muscle up"],
  ["handstand", "parada de mão"],
  ["skin the cat", "skin the cat"],
  ["flag", "bandeira humana"],
  ["l-sit", "L-sit"],
  ["v-sit", "V-sit"],
  ["hanging pike", "pike suspenso"],
  ["sphinx", "esfinge"],
  ["elevator", "elevador"],
  ["scapula dip", "mergulho escapular"],
  ["scapula push-up", "flexão escapular"],
  ["scapula push up", "flexão escapular"],
  ["gironda sternum chin", "barra fixa Gironda"],
  ["sternum chin", "barra fixa esternal"],
  ["gorilla chin", "barra fixa gorila"],
  ["chin", "barra fixa"],
  ["rope climb", "subida na corda"],
  ["london bridge", "london bridge"],
  ["arm slingers hanging", "balanço de braços suspenso"],
  ["spell caster", "spell caster"],
  ["around world", "círculo completo"],
  ["iron cross", "cruz de ferro"],
  ["windmill", "moinho de vento"],
  ["figure 8", "número oito"],
  ["landmine 180", "landmine 180"],
  ["judo flip", "projeção de judô"],
  ["left hook", "gancho de esquerda"],

  // Trunk work.
  ["v-up", "canivete"],
  ["alternating v-up", "canivete alternado"],
  ["l-pull-up", "barra fixa em L"],
  ["body saw", "serrote"],
  ["cocoons", "casulo"],
  ["curl-up", "abdominal curto"],
  ["butt-ups", "elevação de quadril na prancha"],
  ["body-up", "elevação de tronco"],
  ["bottoms-up", "bottoms-up"],
  ["otis up", "abdominal Otis"],
  ["kick out sit", "kick out sit"],
  ["elbow-to-knee", "cotovelo ao joelho"],
  ["elbow to knee", "cotovelo ao joelho"],
  ["roll-out", "roll-out"],
  ["flutter kick", "chute alternado"],
  ["swimmer kick", "pernada de nadador"],
  ["isometric wipers", "limpador de para-brisa isométrico"],
  ["wipers", "limpador de para-brisa"],
  ["isometric chest squeeze", "isometria de peitoral"],
  ["chest squeeze", "compressão de peitoral"],
  ["hand squeeze", "preensão manual"],
  ["leg pull in", "recolhimento de pernas"],
  ["pull-in", "recolhimento de pernas"],
  ["side bridge", "ponte lateral"],
  ["rear decline bridge", "ponte invertida"],
  ["bridge", "ponte"],
  ["twist hip lift", "elevação de quadril com rotação"],
  ["hip lift", "elevação de quadril"],
  ["hip raise", "elevação de quadril"],
  ["heel touchers", "toque no calcanhar"],
  ["toe touch", "toque na ponta dos pés"],
  ["air bike", "abdominal bicicleta"],

  // Throwing and slamming.
  ["chest pass", "passe de peito"],
  ["chest push", "empurrada de peito"],
  ["chest throw", "arremesso de peito"],
  ["catch and overhead throw", "recepção e arremesso acima da cabeça"],
  ["overhead slam", "arremesso ao solo"],
  ["slam", "arremesso ao solo"],
  ["throw", "arremesso"],

  // Conditioning and locomotion.
  ["burpee", "burpee"],
  ["mountain climber", "escalador"],
  ["bear crawl", "caminhada do urso"],
  ["monster walk", "caminhada do monstro"],
  ["inchworm", "lagarta"],
  ["jump rope", "pular corda"],
  ["battling ropes", "corda naval"],
  ["box jump", "salto na caixa"],
  ["jump squat", "agachamento com salto"],
  ["semi squat jump", "meio agachamento com salto"],
  ["star jump", "salto estrela"],
  ["jack jump", "polichinelo com salto"],
  ["scissor jump", "salto em tesoura"],
  ["astride jump", "salto afastando as pernas"],
  ["skater hop", "salto do patinador"],
  ["drop jump", "salto em profundidade"],
  ["jump", "salto"],
  ["wind sprints", "tiros de velocidade"],
  ["short stride run", "corrida de passada curta"],
  ["walking on stepmill", "caminhada na escada ergométrica"],
  ["walking on incline treadmill", "caminhada na esteira inclinada"],
  ["walk elliptical cross trainer", "caminhada no elíptico"],
  ["cycle cross trainer", "elíptico"],
  ["cross trainer", "elíptico"],
  ["stationary bike run", "corrida na bicicleta ergométrica"],
  ["stationary bike walk", "pedalada leve na bicicleta ergométrica"],
  ["stationary bike", "bicicleta ergométrica"],
  ["hands bike", "ergômetro de braços"],
  ["ski ergometer", "ergômetro de esqui"],
  ["wheel run", "corrida na roda"],
  ["push to run", "empurrada e corrida"],
  ["push and pull", "empurrar e puxar"],
  ["quick feet", "pés rápidos"],
  ["shoulder tap", "toque no ombro"],
  ["back and forth step", "passo para frente e para trás"],
  ["ski step", "passo de esqui"],
  ["balance board", "prancha de equilíbrio"],
  ["posterior step to overhead reach", "passo atrás com alcance acima da cabeça"],
  ["half knee bends", "meio agachamento"],
  ["knee bends", "flexão de joelhos"],
  ["march sit", "sentado com marcha"],
  ["wall sit", "cadeirinha na parede"],
  ["platform slide", "deslizamento na plataforma"],
  ["run", "corrida"],
  ["walking", "caminhada"],
  ["walk", "caminhada"],

  // Rotation, carries and the remaining odds and ends.
  ["internal rotation", "rotação interna"],
  ["external rotation", "rotação externa"],
  ["lower body rotation", "rotação de quadril"],
  ["rotation", "rotação"],
  ["pronation", "pronação"],
  ["supination", "supinação"],
  ["wrist roller", "rolo de punho"],
  ["standing lift", "levantamento em pé"],
  ["twisting pull", "puxada com rotação"],
  ["rear drive", "puxada posterior"],
  ["side bent", "flexão lateral de tronco"],
  ["shoulder flexor depressor retractor", "mobilidade escapular"],
  ["circles", "circundução"],
  ["quads", "quadríceps"],
  ["carry", "caminhada com carga"],
  ["hang", "suspensão"],
  ["squeeze", "compressão"],
  ["breeding", "abertura"],
  ["skier", "esquiador"],

  // Names whose head is not a movement word any of the above reaches.
  ["front chest squat", "agachamento frontal com a barra no peito"],
  ["hammer press", "press pegada neutra"],
  ["lateral lunge", "afundo lateral"],
  ["back shrug", "encolhimento por trás"],
  ["lower back curl", "extensão lombar"],
  ["upper row", "remada alta"],
  ["prone hamstring", "alongamento de isquiotibiais de bruços"],
  ["lateral bent-over", "elevação lateral curvada"],
  ["deltoid rear", "elevação posterior"],
  ["side hip", "elevação lateral de quadril"],
  ["round arm", "círculo de braço"],
  ["y-raise", "elevação em Y"],
  ["t-raise", "elevação em T"],
  ["arm up", "elevação de braço"],
  ["one arm against wall", "apoio unilateral na parede"],
  ["high knee against wall", "joelho alto na parede"],
  ["standing archer", "puxada archer em pé"],
  ["alternate shoulder", "desenvolvimento alternado"],
  ["reverse hyper", "hiperextensão inversa"],
  ["outer hip abductor", "abdução de quadril"],
  ["rotary calf", "panturrilha rotativa"],
  ["pirate supper", "pirate supper"],
  ["rotate", "rotação"],
  ["lifting", "levantamento"],
  ["calves", "panturrilha"],
  ["calf", "panturrilha"],

  /* Bare fallbacks. Every compound above is longer, so these only ever catch a
     name none of them accounted for — which is what keeps a movement from
     reaching the app with no Portuguese head at all. */
  ["stretch", "alongamento"],
  ["press", "press"],
  ["raise", "elevação"],
  ["extension", "extensão"],
  ["lift", "levantamento"],
  ["pose", "postura"],
  ["step", "passo"]
];

/* Position, laterality and variation. These trail the movement in Portuguese. */
const PT_QUALS = [
  ["one arm", "unilateral"],
  ["single arm", "unilateral"],
  ["single leg", "unilateral"],
  ["single-leg", "unilateral"],
  ["one leg", "unilateral"],
  ["one hand", "unilateral"],
  ["unilateral", "unilateral"],
  ["alternate", "alternado"],
  ["alternating", "alternado"],
  ["standing", "em pé"],
  ["seated", "sentado"],
  ["lying", "deitado"],
  ["kneeling", "ajoelhado"],
  ["incline", "inclinado"],
  ["decline", "declinado"],
  ["prone", "de bruços"],
  ["supine", "em supino"],
  ["hanging", "na barra"],
  ["bent knee", "joelhos flexionados"],
  ["knees bent", "joelhos flexionados"],
  ["bent over", "curvado"],
  ["bent-over", "curvado"],
  ["overhead", "acima da cabeça"],
  ["cross body", "cruzado"],
  ["straight", "pernas retas"],
  ["oblique", "oblíquo"],
  ["reverse", "inverso"],
  ["horizontal", "horizontal"],
  ["vertical", "vertical"],
  ["floor", "no chão"],
  ["bench", "no banco"],
  ["bench support", "apoiado no banco"],
  ["on floor", "no chão"],
  ["inner", "interno"],
  ["front", "frontal"],
  ["side", "lateral"],
  ["rear", "posterior"],
  ["low", "baixo"],
  ["middle", "médio"],
  ["high", "alto"],
  ["wide", "aberto"],
  ["narrow", "fechado"],
  ["hack", "no hack"],
  ["45 degrees", "45°"],
  ["45°", "45°"],

  /* ---- the rest of the corpus ---- */
  ["isometric", "isométrico"],
  ["plyo", "pliométrico"],
  ["dynamic", "dinâmico"],
  ["kipping", "kipping"],
  ["archer", "archer"],
  ["straddle", "com pernas afastadas"],
  ["frog", "do sapo"],
  ["full", "completo"],
  ["half", "parcial"],
  ["lean", "inclinado"],
  ["rocking", "com balanço"],
  ["ring", "nas argolas"],
  ["korean", "coreano"],
  ["impossible", "impossível"],
  ["elbow", "com cotovelos"],
  ["scapular", "escapular"],
  ["shoulder", "de ombro"],

  /* Variation words. Each of these is the only thing separating two upstream
     movements, so dropping it would put two identical rows in the Portuguese
     picker — the same duplicate-name problem test/exercise-library.mjs holds
     the line on in English. */
  ["chest tap", "com toque no peito"],
  ["knee touch", "com toque no joelho"],
  ["clap", "com palma"],
  ["clock", "relógio"],
  ["deep", "profunda"],
  ["drop", "com queda"],
  ["depth", "em profundidade"],
  ["hindu", "hindu"],
  ["pike-to-cobra", "pike para cobra"],
  ["pike", "pike"],
  ["spider crawl", "com caminhada de aranha"],
  ["superman", "superman"],
  ["plus", "plus"],
  ["jackknife", "canivete"],
  ["jack knife", "canivete"],
  ["janda", "Janda"],
  ["quarter", "quarto de amplitude"],
  ["3/4", "3/4"],
  ["tuck", "agrupado"],
  ["negative", "negativo"],
  ["groin", "com pernas abertas"],
  ["straight arm", "braços estendidos"],
  ["straight back", "costas retas"],
  ["straight leg", "pernas estendidas"],
  ["leg straight", "pernas estendidas"],
  ["pull-up cable machine", "na máquina de barra"],
  ["bent arm", "braços flexionados"],
  ["bent knees", "joelhos flexionados"],
  ["jm", "JM"],
  ["twisting", "com rotação"],
  ["twisted", "com rotação"],
  ["palm rotational", "com rotação de punho"],
  ["thibaudeau kayak", "kayak Thibaudeau"],
  ["upper", "alto"],
  ["potty", "potty"],
  ["frankenstein", "Frankenstein"],
  ["stiff leg", "pernas semirrígidas"],
  ["self assisted", "autoassistido"],
  ["self", "autoassistido"],
  ["renegade", "renegade"],
  ["pistol", "pistol"],
  ["turkish get up", "turkish get-up"],
  ["squat style", "estilo agachamento"],
  ["elevated", "elevado"],
  ["up-down", "subindo e descendo"],
  ["dip-pull-up cage", "na gaiola"],
  ["tennis ball between ankles", "com bola entre os tornozelos"],
  ["tennis ball between knees", "com bola entre os joelhos"],
  ["between benches", "entre bancos"],
  ["three bench", "em três bancos"],
  ["fixed back", "com apoio nas costas"],
  ["stork stance", "em apoio unilateral"],
  ["support head", "com apoio da cabeça"],
  ["with support", "com apoio"],
  ["supported", "com apoio"],
  ["support", "com apoio"],
  ["zottman", "Zottman"],
  ["preacher", "no banco scott"],
  ["over bench", "sobre o banco"],
  ["above head", "acima da cabeça"],
  ["over head", "acima da cabeça"],
  ["around", "circular"],
  ["closer", "mais fechado"],
  ["sumo", "sumô"],
  ["leg up", "com perna elevada"],
  ["legs up", "com pernas elevadas"],
  ["leg raised", "com perna elevada"],
  ["prisoner", "com mãos na nuca"],
  ["reps", "em repetições"],
  ["on bar", "na barra"],
  ["side-to-side", "alternando os lados"],
  ["two", "duplo"],
  ["equipment", "em equipamento"],
  ["straps", "com fitas"],
  ["scapula", "escapular"],
  ["behind neck", "atrás da nuca"],
  ["behind head", "atrás da cabeça"],
  ["against wall", "contra a parede"],
  ["wall", "na parede"],
  ["on knees", "de joelhos"],
  ["double", "duplo"],
  ["two arm", "com os dois braços"],
  ["seesaw", "alternado"],
  ["all fours", "de quatro apoios"],
  ["side lying", "deitado de lado"],
  ["intermediate", "intermediário"],
  ["basic", "básico"],
  ["advanced", "avançado"],
  ["circular", "circular"],
  ["hands clasped", "mãos entrelaçadas"],
  ["arms apart", "braços afastados"],
  ["extended range", "amplitude estendida"],
  ["extended", "estendido"],
  ["outstretched", "estendida"],
  ["big toe", "dedão"],
  ["high knee", "joelhos altos"],
  ["high knees", "joelhos altos"],
  ["forward", "à frente"],
  ["contralateral", "contralateral"],
  ["backward", "para trás"],
  ["curtsey", "cruzado"],
  ["cossack", "cossaco"],
  ["jefferson", "Jefferson"],
  ["zercher", "Zercher"],
  ["clean-grip", "pegada de clean"],
  ["narrow stance", "base fechada"],
  ["wide stance", "base aberta"],
  ["speed", "de velocidade"],
  ["single response", "resposta única"],
  ["multiple response", "respostas múltiplas"],
  ["3 point stance", "posição de três apoios"],
  ["with run release", "com corrida"],
  ["pyramid", "pirâmide"],
  ["from the hang position", "a partir da suspensão"],
  ["from bench", "a partir do banco"],
  ["on hip", "no quadril"],
  ["across face", "cruzando o rosto"],
  ["cross body", "cruzado"],
  ["180", "180°"]
];

/* Equipment lands just before grip in Portuguese naming. */
const PT_EQUIP = [
  ["ez barbell", "com barra W"],
  ["ez bar", "com barra W"],
  ["ez-bar", "com barra W"],
  ["olympic barbell", "com barra olímpica"],
  ["trap bar", "com barra hexagonal"],
  ["barbell", "com barra"],
  ["dumbbell", "com halteres"],
  ["kettlebell", "com kettlebell"],
  ["cable", "na polia"],
  ["smith machine", "no Smith"],
  ["smith", "no Smith"],
  ["lever", "na máquina"],
  ["machine", "na máquina"],
  ["sled", "no leg press"],
  ["assisted", "assistido"],
  ["weighted", "com carga"],
  ["bodyweight", "peso corporal"],
  ["body weight", "peso corporal"],
  ["landmine", "no landmine"],
  ["suspended", "no suspensório"],

  /* ---- the rest of the corpus ---- */
  ["exercise ball", "na bola suíça"],
  ["stability ball", "na bola suíça"],
  ["bosu ball", "no bosu"],
  ["medicine ball", "com bola medicinal"],
  ["roller", "no rolo"],
  ["wheel", "com roda abdominal"],
  ["resistance band", "com elástico"],
  ["band", "com elástico"],
  ["strap", "com faixa"],
  ["towel", "com toalha"],
  ["arm blaster", "com arm blaster"],
  ["parallel bars", "nas barras paralelas"],
  ["vertical bar", "na barra vertical"],
  ["stepbox support", "com apoio no step"],
  ["platform", "na plataforma"],
  ["chair", "na cadeira"],
  ["treadmill", "na esteira"],
  ["stepmill", "na escada ergométrica"],
  ["box", "na caixa"]
];

/* Grip and attachment qualifiers close the Portuguese name. */
const PT_GRIP = [
  ["with rope attachment", "com corda"],
  ["rope attachment", "com corda"],
  ["with rope", "com corda"],
  ["rope", "com corda"],
  ["v-bar", "com barra V"],
  ["v bar", "com barra V"],
  ["pro lat bar", "com barra de puxada"],
  ["close-grip", "pegada fechada"],
  ["close grip", "pegada fechada"],
  ["narrow grip", "pegada fechada"],
  ["narrow parallel grip", "pegada neutra fechada"],
  ["wide-grip", "pegada aberta"],
  ["wide grip", "pegada aberta"],
  ["wide hand", "pegada aberta"],
  ["reverse grip", "pegada supinada"],
  ["reverse-grip", "pegada supinada"],
  ["underhand", "pegada supinada"],
  ["neutral grip", "pegada neutra"],
  ["neutral-grip", "pegada neutra"],
  ["parallel grip", "pegada neutra"],
  ["hammer grip", "pegada neutra"],
  ["palm up", "palmas para cima"],
  ["palms up", "palmas para cima"],

  /* ---- the rest of the corpus ---- */
  ["palm-in", "pegada neutra"],
  ["palms in", "pegada neutra"],
  ["palm in", "pegada neutra"],
  ["bottoms up", "pegada invertida"],
  ["overhand", "pegada pronada"],
  ["pronated", "pegada pronada"],
  ["supinated", "pegada supinada"],
  ["mixed grip", "pegada mista"],
  ["pronate-grip", "pegada pronada"],
  ["neutral", "pegada neutra"],
  ["gripless", "sem pegada"]
];

/* The phrase tables are written in the singular, and a needle only matches a
   whole word — so "EZ-bar seated curls" would walk straight past ["curl", ...]
   and reach the app with no Portuguese head at all. Normalising the working
   copy is cheaper and far more predictable than teaching every entry to end in
   an optional "s": an explicit list cannot mistake "biceps", "triceps",
   "quads" or "calves" for plurals of something. */
const PT_PLURALS = [
  ["pull-ups", "pull-up"], ["pull ups", "pull-up"],
  ["chin-ups", "chin-up"], ["chin ups", "chin-up"],
  ["push-ups", "push-up"], ["push ups", "push-up"],
  ["sit-ups", "sit-up"], ["sit up", "sit-up"], ["sit ups", "sit-up"],
  ["step-ups", "step-up"], ["step ups", "step-up"],
  ["dips", "dip"], ["crunches", "crunch"], ["curls", "curl"],
  ["raises", "raise"], ["rows", "row"], ["presses", "press"],
  ["flyes", "fly"], ["flys", "fly"], ["flies", "fly"],
  ["crossovers", "crossover"], ["cross-overs", "crossover"],
  ["twists", "twist"], ["squats", "squat"], ["deadlifts", "deadlift"],
  ["lunges", "lunge"], ["shrugs", "shrug"], ["thrusts", "thrust"],
  ["kickbacks", "kickback"], ["pulldowns", "pulldown"],
  ["extensions", "extension"], ["pullovers", "pullover"],
  ["hops", "hop"], ["jumps", "jump"], ["kicks", "kick"],
  ["swings", "swing"], ["burpees", "burpee"], ["planks", "plank"],
  ["roll-outs", "roll-out"], ["pull-ins", "pull-in"],
  ["arm ups", "arm up"], ["legs", "leg"]
];

const PT_TABLE = [
  ...PT_CORES.map(([en, pt]) => [en, pt, CORE]),
  ...PT_QUALS.map(([en, pt]) => [en, pt, QUAL]),
  ...PT_EQUIP.map(([en, pt]) => [en, pt, EQUIP]),
  ...PT_GRIP.map(([en, pt]) => [en, pt, GRIP])
].sort((a, b) => b[0].length - a[0].length);

/* ---------- naming and mapping helpers --------------------------------- */
function cleanName(raw) {
  let s = String(raw || "");
  for (const [re, to] of NAME_FIXES) s = s.replace(re, to);
  s = s.trim().replace(/\s*\(\s*\)\s*/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* Matches are consumed off a working copy so a phrase is never translated
   twice, then emitted in Portuguese order rather than the English one. */
function translateParts(english) {
  let work = " " + english.toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim() + " ";
  for (const [plural, singular] of PT_PLURALS)
    while (work.includes(" " + plural + " ")) work = work.replace(" " + plural + " ", " " + singular + " ");
  const found = {[CORE]: [], [QUAL]: [], [EQUIP]: [], [GRIP]: []};
  for (const [en, pt, role] of PT_TABLE) {
    const needle = " " + en + " ";
    if (!work.includes(needle)) continue;
    // A core is the head of the name: only the first one counts.
    const slot = role === CORE && found[CORE].length ? QUAL : role;
    while (work.includes(needle)) work = work.replace(needle, " ");
    if (!found[slot].includes(pt)) found[slot].push(pt);
  }
  const leftover = work.trim().split(/\s+/).filter(Boolean);
  return {found, leftover};
}

function translate(english) {
  const {found} = translateParts(english);
  // "Chest press machine" already says machine in its core; appending the
  // equipment again gives "supino máquina na máquina".
  const core = found[CORE].join(" ");
  const equip = found[EQUIP].filter(pt => {
    const head = pt.replace(/^(com|na|no)\s+/, "");
    return !core.includes(head);
  });
  const words = [...found[CORE], ...found[QUAL], ...equip, ...found[GRIP]];
  const s = words.join(" ").replace(/\s+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* English the table did not account for. Drives --report so every namePt
   override in the curation file is there for a reason. */
function residualEnglish(english) {
  const {found, leftover} = translateParts(english);
  const skip = new Set(["with", "the", "on", "to", "and", "of", "a", "in", "for", "at", "v"]);
  const words = leftover.filter(w => !skip.has(w) && /^[a-z°-]+$/.test(w) && w.length > 1);
  if (!found[CORE].length) words.unshift("<no core match>");
  return words;
}

function musclesFrom(row, name) {
  const seen = [];
  const push = token => { if (token && !seen.includes(token)) seen.push(token); };
  const resolve = raw => {
    const key = String(raw || "").trim().toLowerCase();
    if (!(key in MUSCLES)) return { unknown: key };
    const mapped = MUSCLES[key];
    if (mapped === null) return { unmodelled: key };
    if (mapped !== DELT_HEAD_UNKNOWN) return { token: mapped };
    // Undifferentiated shoulder tag — read the head off the movement.
    for (const [re, head] of DELT_HEAD) if (re.test(name)) return { token: head };
    return { token: "Front delts" };
  };

  const unknowns = [];
  const primary = resolve(row.target);
  if (primary.unknown) unknowns.push(primary.unknown);
  else if (primary.token) push(primary.token);
  const primaryTokens = [...seen];

  const secondary = [];
  for (const raw of [row.muscle_group, ...(row.secondary_muscles || [])]) {
    const r = resolve(raw);
    if (r.unknown) { unknowns.push(r.unknown); continue; }
    if (!r.token) continue;
    if (primaryTokens.includes(r.token) || secondary.includes(r.token)) continue;
    secondary.push(r.token);
  }
  return { primary: primaryTokens.join(","), secondary: secondary.slice(0, 4).join(","), unknowns };
}

function equipmentFrom(row) {
  const eq = EQUIPMENT[String(row.equipment || "").toLowerCase()];
  return eq ? [...eq] : null;
}

/* The only exercises allowed to show artwork. Ninety-six illustrations are
   licensed for this app; the remaining 174 movements — built-in or custom —
   render a deliberately empty tile. Keyed by stable library id, never by

  "rd_db", "ci_mc", "ci_cb", "cu_mc", "cu_db", "cu_cb", "tr_cb", "tr_mc", "lc_mc",
  "le_mc", "cv_mc", "ad_mc", "ab_mc", "lcl_mc", "cvs_mc", "sh_db", "abc_mc", "wc_db"
/* Free-weight barbell compounds ask more of a novice than a pinned machine
   path does; the wizard uses this to bias beginner programs. */
function beginnerFriendly(equipment, name) {
  if (/barbell|olympic|trap bar/.test(name) && !/preacher|wrist|shrug|curl/i.test(name)) return false;
  if (equipment.includes("machine") || equipment.includes("cable") || equipment.includes("smith")) return true;
  if (/muscle up|planche|pistol|handstand|one arm|single arm|sissy/i.test(name)) return false;
  return true;
}

export {
  EQUIPMENT, MUSCLES, DELT_HEAD_UNKNOWN, DELT_HEAD, NAME_FIXES, PATTERN_MUSCLES,
  CORE, QUAL, EQUIP, GRIP, PT_CORES, PT_QUALS, PT_EQUIP, PT_GRIP, PT_PLURALS, PT_TABLE,
  cleanName, translateParts, translate, residualEnglish,
  musclesFrom, equipmentFrom, beginnerFriendly
};
