/* Import matching corpus — Plan 061, re-based on the Plan 067 catalog.
 *
 * Two tiers, as Q10 settled:
 *
 *   strict — the row must resolve to exactly this catalog UUID. These are the
 *     rows that already worked before Plan 061; they are here so a scoring
 *     change that reshuffles them fails loudly rather than quietly.
 *   loose  — an expected UUID must appear in the ranked candidates the review
 *     row shows. `ids` lists every acceptable answer: a source that never says
 *     whether a phrase identifies one movement or several should not have a
 *     guess frozen into a test (Q16).
 *
 * Seeded from a real four-day Portuguese coach program. Each row names the
 * catalog movement(s) its expectation means; the Plan 067 catalog replaced the
 * old library ids, so `was` keeps the old library's history for context.
 * Owner arbitration is still open on the rows marked `arbitration`.
 */

export const STRICT = [
  { input: "Cadeira flexora", id: "1a35c6f170d88029bc9ff9ded538758c", note: "exact PT name (Seated hamstring curl)" },
  { input: "Cadeira extensora", id: "1a25c6f170d880c59f17ce7802758fc3", note: "exact PT name (Leg extension)" },
  { input: "Mesa flexora", id: "1a35c6f170d8800bab2dca0110e26c4a", note: "exact PT name (Lying hamstring curl)" },
  { input: "Desenvolvimento na máquina", id: "1a15c6f170d880fc9e97e840aa8098c7", note: "PT alias (Pin-loaded machine shoulder press)" },
];

export const LOOSE = [
  { input: "Elevação lateral na máquina", ids: ["1a15c6f170d88057bb86d20566082394", "1a15c6f170d88055bfbcf0b2e871a481"],
    movements: ["Seated machine lateral raise","Standing machine lateral raise"],
    was: "strict at lr_mc in the old library, which had one lateral raise machine; the catalog distinguishes seated and standing" },
  { input: "Hip thrust com barra", ids: ["1a35c6f170d88059b804ff16ff621a1c"],
    movements: ["Barbell hip thrust"],
    was: "sq_bb Barbell back squat, from a 36-way tie at 0.50" },
  { input: "Hip thrust na máquina", ids: ["2935c6f170d8807297f5f92ee1f47d68"],
    movements: ["Pin-loaded machine hip thrust"],
    was: "ht_bb, tied at 0.67 and decided by array order" },
  { input: "Búlgaro com halteres", ids: ["1a25c6f170d8809eb8a5e76ff245649d"],
    movements: ["Dumbbell Bulgarian split squat"],
    was: "pr_db Dumbbell bench press at 0.67" },
  { input: "Afundo reverso com halteres", ids: ["1a25c6f170d8802fb222d3b46b85b3c0"],
    movements: ["Dumbbell reverse lunge"],
    was: "lg_db Dumbbell lunge, tied at 0.75; PT calls it 'posterior', the source says 'reverso'" },
  { input: "Remada máquina com apoio peitoral", ids: ["1a15c6f170d8807188c0da98a91c30c3", "39a5c6f170d88068a174c97856456c71"],
    movements: ["Neutral grip pin-loaded machine row","Chest-supported underhand grip pin-loaded machine row"],
    was: "already correct at 0.60; here to catch a regression" },
  { input: "Pulldown pegada neutra", ids: ["2ae5c6f170d8805da4e1d8dc785bc9ea", "2e35c6f170d88064bd1ec50647b38148"],
    movements: ["Neutral grip pin-loaded machine lat pulldown","Neutral grip plate-loaded machine lat pulldown"],
    was: "already correct at 0.67; here to catch a regression" },
  { input: "Leg press 45°, pés altos e afastados", ids: ["1a25c6f170d88079a926dde776766181"],
    movements: ["45° leg press"],
    was: "nothing proposed: contains the library name exactly but scored 2/5 = 0.40" },
  { input: "Abdução de quadril na máquina", ids: ["1a35c6f170d8801e907be574e89e5c65"],
    movements: ["Seated machine hip abduction"],
    was: "he_mc Machine hip extension at 0.67; the library calls it 'Cadeira abdutora'" },
  { input: "Abdução em pé no cabo", ids: ["1a35c6f170d8806dac95e1ab4fa67605"],
    movements: ["Cable hip abduction (leg behind body)"],
    was: "no candidates at all; the library had no cable abduction" },
  { input: "RDL", ids: ["1a35c6f170d880bebc64f4dce0d5f5f1"],
    movements: ["Barbell Romanian deadlift"],
    was: "no candidates at all; needs an alias" },
  { input: "Banco Romano 45°, ênfase em glúteo", ids: ["1a35c6f170d8801eada7c59fc061adfe"],
    movements: ["Bodyweight Roman chair hip hinge"],
    was: "nothing usable; topped out at 0.31 against Glute-ham raise" },

  { input: "Hack squat", ids: ["1a25c6f170d88008a9adde9f71881c36"],
    movements: ["Hack squat"],
    was: "sqk_bb won a 0.67 tie on array position; the catalog's Hack squat is the machine" },

  // Owner arbitration open. Both readings are defensible and the source is silent.
  { input: "Agachamento no Smith, pés à frente", ids: ["1a25c6f170d8800a86efdcb6f902b9a9"], arbitration: true,
    movements: ["Smith machine back squat"],
    was: "sqc_sm won a three-way tie at 0.50; sq_sm is the plainer reading" },
];
