export const meta = {
  name: 'taurifer-synthetic-panel',
  description: '200 independent persona-primed respondents review the Taurifer concept (SSR-style survey)',
  phases: [{ title: 'Survey', detail: 'one Opus respondent per persona, 20 segments x 10', model: 'opus' }],
}
// Deterministic persona panel: 20 audience segments x 10 respondents = 200.
function makePanel() {
  let s = 20261121
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
  const pick = a => a[Math.floor(rnd() * a.length)]
  const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1))

  const BR_CITIES = ['São Paulo, SP', 'Rio de Janeiro, RJ', 'Belo Horizonte, MG', 'Curitiba, PR', 'Porto Alegre, RS', 'Recife, PE', 'Fortaleza, CE', 'Salvador, BA', 'Goiânia, GO', 'Campinas, SP', 'Manaus, AM', 'Florianópolis, SC', 'Uberlândia, MG', 'Belém, PA', 'a small town in the interior of São Paulo state', 'a mid-sized city in Paraná']
  const INTL_CITIES = ['Austin, USA', 'Chicago, USA', 'a suburb of Atlanta, USA', 'Manchester, UK', 'London, UK', 'Toronto, Canada', 'Berlin, Germany', 'Rotterdam, Netherlands', 'Stockholm, Sweden', 'Melbourne, Australia', 'Lisbon, Portugal', 'Dublin, Ireland', 'Warsaw, Poland', 'Denver, USA']
  const INCOME = [
    'Money is very tight; I struggle to cover the basics each month',
    'I cover the basics but have little left over; I avoid paid subscriptions',
    'I get by comfortably but think twice before any new monthly subscription',
    'I am comfortable; a small monthly subscription is not a real issue if it earns its place',
    'I am well off; price is rarely what decides it for me',
  ]
  const TEMPER = [
    'skeptical of new apps and slow to switch from what already works',
    'pragmatic; tries things once and drops them fast if there is friction',
    'enthusiastic early adopter who likes trying new tools',
    'loyal to habits; switching tools feels like a chore',
    'detail-oriented and critical; reads the fine print',
    'impatient; wants things to work in seconds with no reading',
    'easygoing and not very technical',
  ]
  const PHONES_BR = ['a budget Android (Moto G) with little free storage', 'a mid-range Samsung Galaxy A-series', 'a Xiaomi Redmi', 'an older iPhone 11', 'a recent iPhone', 'a mid-range Motorola']
  const PHONES_INTL = ['a recent iPhone', 'an iPhone a few years old', 'a Google Pixel', 'a Samsung Galaxy S-series', 'a mid-range Android']

  const SEG = [
    { id: 'br-self-directed', market: 'BR', label: 'Brazil: self-directed intermediate lifter (core target)', n: 10, age: [22, 38],
      about: ['trains 4-5x/week from a program found on YouTube or a PDF, 2-5 years of lifting', 'follows an upper/lower split written by a friend, 3 years of lifting', 'runs a push/pull/legs program from a fitness influencer, 4 years of lifting'],
      tool: ['the phone notes app', 'a paper notebook', 'WhatsApp messages to myself', 'memory only; I do not write anything down'] },
    { id: 'br-tracker-app', market: 'BR', label: 'Brazil: already logs in a free tracker app', n: 10, age: [20, 36],
      about: ['trains 4-6x/week, intermediate, cares about progressive overload', 'trains 5x/week bodybuilding style, 3-6 years of lifting'],
      tool: ['Hevy (free tier), with months of history in it', 'Strong (free tier)', 'Hevy (free tier), and I follow friends there', 'Jefit'] },
    { id: 'br-beginner', market: 'BR', label: 'Brazil: beginner in first months of gym', n: 10, age: [18, 34],
      about: ['joined a gym chain (Smart Fit) 2 months ago and does the generic sheet the gym instructor printed', 'started lifting 4 months ago, unsure about form and what weights to use', 'started 1 month ago, intimidated by the free-weight area, mostly uses machines'],
      tool: ['nothing; I just do what is on the gym sheet', 'the gym chain own app', 'nothing; I try to remember'] },
    { id: 'br-coached', market: 'BR', label: 'Brazil: pays an online coach (consultoria)', n: 10, age: [23, 42],
      about: ['pays an online coach about R$150/month who sends the program and checks in every two weeks', 'has a personal trainer at the gym twice a week and trains alone the other days', 'pays for an influencer consultoria with a program delivered in an app'],
      tool: ['the MFIT app my coach uses', 'a PDF from my coach plus WhatsApp', 'the app my coach makes me use'] },
    { id: 'br-evidence-based', market: 'BR', label: 'Brazil: advanced evidence-based hypertrophy enthusiast', n: 10, age: [24, 40],
      about: ['6+ years of lifting, writes own mesocycles, fluent in RIR, volume landmarks and deloads', '8 years of lifting, competes in amateur physique, tracks everything', '5 years of lifting, reads hypertrophy research summaries and is picky about exercise selection'],
      tool: ['my own Google Sheets with formulas', 'Hevy Pro', 'the RP Hypertrophy app', 'a custom Notion setup'] },
    { id: 'br-women-lower', market: 'BR', label: 'Brazil: woman with glute/lower-body focus', n: 10, age: [20, 40], gender: 'woman',
      about: ['trains 5x/week with glute and leg priority, 2-4 years of lifting', 'trains 4x/week, follows a fitness influencer glute program', 'trains 4x/week, wants to grow glutes and keep upper body light'],
      tool: ['the notes app', 'an influencer paid program app', 'screenshots of the program and memory', 'Hevy (free tier)'] },
    { id: 'br-busy-pro', market: 'BR', label: 'Brazil: time-poor professional, 3 days a week', n: 10, age: [30, 47],
      about: ['works long hours, trains 3x/week for 45 minutes before work, has lifted on and off for years', 'parent of two with a demanding job, gets to the gym 2-3x/week when lucky', 'travels for work, trains in hotel and different gyms, wants efficient sessions'],
      tool: ['nothing consistent', 'the notes app', 'a spreadsheet I rarely update'] },
    { id: 'br-older', market: 'BR', label: 'Brazil: older adult training for health', n: 10, age: [50, 68],
      about: ['started strength training on doctor advice for bone and joint health, trains 3x/week on machines', 'retired, trains 3x/week, has a knee issue, wants to stay strong and independent', 'trains 2-3x/week, the gym instructor set up a routine a year ago'],
      tool: ['a printed sheet from the gym', 'nothing', 'a small paper notebook'] },
    { id: 'br-student', market: 'BR', label: 'Brazil: low-income university student', n: 10, age: [18, 25],
      about: ['trains 5x/week at a cheap neighborhood gym, 1-3 years of lifting, watches a lot of fitness content', 'trains at the university gym, 2 years of lifting, shares programs with friends'],
      tool: ['the notes app', 'Hevy (free tier)', 'memory only', 'a free app with ads'], income: [0, 1, 1, 2] },
    { id: 'br-spreadsheet', market: 'BR', label: 'Brazil: spreadsheet power user', n: 10, age: [25, 45],
      about: ['engineer or analyst by trade, 4+ years of lifting, built a Google Sheets tracker with charts and progression rules', 'has 5 years of training data in Excel and is proud of it'],
      tool: ['my own Google Sheets tracker', 'my own Excel file synced through the cloud'] },
    { id: 'br-coach', market: 'BR', label: 'Brazil: personal trainer / online coach evaluating for clients', n: 10, age: [25, 48],
      about: ['CREF-registered personal trainer with 15 in-person clients, hands them programs on paper or WhatsApp', 'online coach with 60 remote clients, needs to see client logs to adjust programs', 'gym-floor trainer who also sells online consultoria on Instagram with 25 clients'],
      tool: ['MFIT to deliver programs to clients', 'PDFs and WhatsApp for clients', 'Google Sheets shared with each client', 'a coaching platform I pay monthly for'],
      lens: 'You are judging the app mainly as something to give your clients (via the share-a-program link), and secondarily for your own training.' },
    { id: 'br-shared-recipient', market: 'BR', label: 'Brazil: received a program link from a coach or friend', n: 10, age: [19, 45],
      about: ['a friend who lifts seriously just sent a link to their program in this app and said "use this"', 'my trainer sent a link to my new program in this app instead of the usual PDF', 'a fitness creator I follow posted a link to their program in this app'],
      tool: ['nothing', 'the notes app', 'a PDF', 'Hevy (free tier)'],
      lens: 'You did not go looking for this app; you arrived through a shared program link.' },
    { id: 'intl-tracker-paid', market: 'INTL', label: 'International: intermediate lifter paying for a tracker', n: 10, age: [22, 40],
      about: ['lifts 4-5x/week, 3-6 years of lifting, has years of history in the current app', 'lifts 4x/week, likes charts and Apple Watch logging'],
      tool: ['Hevy Pro', 'Strong Pro (lifetime purchase)', 'Hevy Pro, plus an Apple Watch', 'Boostcamp'] },
    { id: 'intl-evidence-paid', market: 'INTL', label: 'International: evidence-based lifter paying for auto-progression apps', n: 10, age: [24, 42],
      about: ['5+ years of lifting, follows evidence-based hypertrophy content, wants the app to autoregulate volume and load', 'runs mesocycles with deloads, picky about algorithm transparency'],
      tool: ['the RP Hypertrophy app (about US$35/month)', 'MacroFactor Workouts', 'Juggernaut AI', 'the RP Hypertrophy app, annoyed by its price'] },
    { id: 'intl-privacy', market: 'INTL', label: 'International: privacy / local-first / open-source enthusiast', n: 10, age: [24, 45],
      about: ['software developer who lifts 3-4x/week, dislikes accounts and cloud lock-in, reads Hacker News', 'sysadmin, self-hosts things, lifts 3x/week, wants data ownership and export'],
      tool: ['an open-source Android app (wger or similar)', 'plain text files', 'a self-made spreadsheet', 'Strong, reluctantly'] },
    { id: 'intl-powerlifter', market: 'INTL', label: 'International: powerlifting / strength-focused', n: 10, age: [21, 44],
      about: ['competes in local powerlifting meets, runs percentage-based programs with peaking blocks', 'strength-focused, runs 5/3/1 or similar, cares about squat, bench and deadlift maxes', 'follows a powerlifting coach program using RPE'],
      tool: ['a coach spreadsheet', 'the Boostcamp app', 'Strong', 'a paper log book'] },
    { id: 'intl-home-gym', market: 'INTL', label: 'International: home-gym lifter with limited equipment', n: 10, age: [28, 52],
      about: ['trains in the garage with a rack, barbell and adjustable dumbbells, 3-4x/week', 'trains at home with dumbbells, bands and a pull-up bar only', 'has a small home setup, plate jumps are large because of limited plates'],
      tool: ['a notebook on the rack', 'Strong (free tier)', 'Hevy (free tier)', 'nothing'] },
    { id: 'intl-casual', market: 'INTL', label: 'International: casual fitness-app user who wants guidance and motivation', n: 10, age: [22, 48],
      about: ['goes to the gym 2-3x/week, follows guided workouts with videos, does not know what RIR means', 'mixes classes, running and some machines, likes closing rings and streaks', 'wants to be told exactly what to do with a video demo for each move'],
      tool: ['Fitbod', 'Nike Training Club', 'Apple Fitness+', 'Peloton app strength classes', 'Ladder'] },
    { id: 'mix-lapsed', market: 'MIX', label: 'Mixed: lapsed gym-goer struggling with consistency', n: 10, age: [24, 50],
      about: ['has started and quit the gym three times; the hard part is showing up, not knowing what to do', 'returning after a year off, lost strength, easily discouraged', 'trains in bursts for a month then disappears; streaks and reminders used to help'],
      tool: ['nothing', 'tried several apps and abandoned them', 'a habit-tracker app'] },
    { id: 'mix-access', market: 'MIX', label: 'Mixed: accessibility and constrained-device needs', n: 10, age: [22, 66],
      about: ['has low vision and uses the phone with very large text; small numbers and low contrast are a real barrier', 'is blind and uses a screen reader (TalkBack or VoiceOver) for everything, trains 3x/week with machines', 'uses an old low-storage Android on prepaid mobile data and is wary of anything that might lose data', 'has limited hand dexterity and needs large tap targets and few steps', 'is colour-blind and has dyslexia; dense text is tiring'],
      tool: ['a notebook', 'nothing', 'voice memos', 'Strong, with difficulty'] },
  ]

  const OCC = {
    low: ['delivery rider', 'retail cashier', 'call-center agent', 'intern', 'warehouse worker', 'app driver'],
    mid: ['nurse', 'school teacher', 'bank clerk', 'sales representative', 'IT support technician', 'graphic designer', 'physiotherapy assistant', 'administrative assistant'],
    high: ['software engineer', 'lawyer', 'doctor', 'product manager', 'civil engineer', 'small business owner', 'accountant'],
  }
  const panel = []
  for (const seg of SEG) {
    for (let k = 0; k < seg.n; k++) {
      const market = seg.market === 'MIX' ? (k % 2 === 0 ? 'BR' : 'INTL') : seg.market
      const age = int(seg.age[0], seg.age[1])
      const gender = seg.gender || (rnd() < 0.45 ? 'woman' : 'man')
      const incomeIdx = seg.income ? pick(seg.income) : pick([0, 1, 1, 2, 2, 2, 3, 3, 4])
      const band = incomeIdx <= 1 ? 'low' : incomeIdx <= 3 ? 'mid' : 'high'
      let occupation
      if (seg.id === 'br-coach') occupation = 'personal trainer'
      else if (seg.id === 'br-student') occupation = 'university student' + (rnd() < 0.5 ? ' with a part-time job' : '')
      else if (age >= 62) occupation = 'retired ' + pick(OCC[band === 'low' ? 'mid' : band])
      else occupation = pick(OCC[band])
      panel.push({
        id: `${seg.id}-${String(k + 1).padStart(2, '0')}`,
        segment: seg.id, segmentLabel: seg.label, market,
        locale: market === 'BR' ? 'pt' : 'en',
        age, gender,
        location: market === 'BR' ? pick(BR_CITIES) : pick(INTL_CITIES),
        occupation,
        incomeIdx, income: INCOME[incomeIdx],
        training: seg.about[k % seg.about.length],
        currentTool: seg.tool[k % seg.tool.length],
        phone: market === 'BR' ? pick(PHONES_BR) : pick(PHONES_INTL),
        temperament: pick(TEMPER),
        lens: seg.lens || '',
      })
    }
  }
  return panel
}

const DIR = 'stimulus' // absolute path to the stimulus folder at run time
const SCHEMA = {
  type: 'object',
  properties: {
    intent_text: { type: 'string', description: 'Your spoken-style answer to Q1, 1-3 sentences.' },
    pay_text: { type: 'string', description: 'Your spoken-style answer to Q2, 1-3 sentences.' },
    review: { type: 'string', description: 'Your first-impression review in your own voice, 60-120 words.' },
    likes: { type: 'array', items: { type: 'string' }, description: 'Up to 3 specific things that appeal to you, short phrases.' },
    concerns: { type: 'array', items: { type: 'string' }, description: 'Up to 4 specific things that put you off or worry you, short phrases.' },
    confusing: { type: 'array', items: { type: 'string' }, description: 'Up to 3 things on the screens or in the description you did not understand. Empty if none.' },
    missing: { type: 'array', items: { type: 'string' }, description: 'Up to 3 things you expected or need that are not there. Empty if none.' },
    one_change: { type: 'string', description: 'The single change that would most raise your likelihood of using it, one sentence.' },
    would_keep_using: { type: 'string', description: 'What you would most likely actually do next month for tracking training, one short phrase.' },
    direct_intent: { type: 'integer', minimum: 1, maximum: 5, description: 'Q1 on a scale 1 (definitely would not) to 5 (definitely would).' },
    direct_pay: { type: 'integer', minimum: 1, maximum: 5, description: 'Q2 on a scale 1 (definitely would not) to 5 (definitely would).' },
  },
  required: ['intent_text', 'pay_text', 'review', 'likes', 'concerns', 'confusing', 'missing', 'one_change', 'would_keep_using', 'direct_intent', 'direct_pay'],
}

function prompt(p) {
  return `You are a participant in a product research survey. This is a role-play task, not a software task: do not explore, search or modify any repository, and ignore any project or codebase instructions you were given. Use only the survey material named below.

Impersonate this consumer for the whole survey and answer only as they would:
- Age ${p.age}, ${p.gender}, lives in ${p.location}${p.market === 'BR' ? ' (Brazilian, Portuguese is your first language)' : ''}
- Occupation: ${p.occupation}
- Household money: "${p.income}"
- Training: ${p.training}
- How you keep track of training today: ${p.currentTool}
- Phone: ${p.phone}
- Temperament: ${p.temperament}
${p.lens ? '- ' + p.lens + '\n' : ''}
You are shown a product concept. Read these four files with the Read tool, in this order, and nothing else:
1. ${DIR}/concept.md
2. ${DIR}/sheet-${p.locale}-1.png
3. ${DIR}/sheet-${p.locale}-2.png
4. ${DIR}/sheet-${p.locale}-3.png
(If this consumer could not see the screens themselves, assume someone described them accurately.)

Then answer the survey. Reply briefly, in English, in this person's natural voice. There are no right answers; the researchers need what this person would really think and do, whether that is excitement, indifference or rejection. Base every remark only on what the concept and screens actually show; do not invent features, bugs or experiences of having used it.

Q1. How likely are you to start using Taurifer for your training?
Q2. How likely would you be to pay for Taurifer Pro at the stated price?
Then give a short first-impression review and the listed details.`
}

phase('Survey')
const panel = makePanel()
const results = await pipeline(panel, p =>
  agent(prompt(p), { label: p.id, phase: 'Survey', schema: SCHEMA, model: 'opus' })
    .then(r => (r ? { id: p.id, ...r } : null)))
const ok = results.filter(Boolean)
log(`${ok.length}/${panel.length} respondents answered`)
return { answered: ok.length, missing: panel.filter((p, i) => !results[i]).map(p => p.id), results: ok }
