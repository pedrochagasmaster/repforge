/* Import matching corpus — Plan 061.
 *
 * Two tiers, as Q10 settled:
 *
 *   strict — the row must resolve to exactly this library id. These are the
 *     rows that already worked before Plan 061; they are here so a scoring
 *     change that reshuffles them fails loudly rather than quietly.
 *   loose  — the expected id must appear in the ranked candidates the review
 *     row shows. `ids` lists every acceptable answer: a source that never says
 *     whether "Hack squat" means the barbell or the machine should not have a
 *     guess frozen into a test (Q16).
 *
 * Seeded from a real four-day Portuguese coach program. Owner arbitration is
 * still open on the rows marked `arbitration`.
 */

export const STRICT = [
  { input: "Cadeira flexora", id: "lc_mc", note: "exact PT name" },
  { input: "Cadeira extensora", id: "le_mc", note: "exact PT name" },
  { input: "Mesa flexora", id: "lcl_mc", note: "exact PT name" },
  { input: "Elevação lateral na máquina", id: "lr_mc", note: "exact PT name" },
  { input: "Desenvolvimento na máquina", id: "sp_mc", note: "exact PT name" },
];

export const LOOSE = [
  { input: "Hip thrust com barra", ids: ["ht_bb"],
    was: "sq_bb Barbell back squat, from a 36-way tie at 0.50" },
  { input: "Hip thrust na máquina", ids: ["ht_mc"],
    was: "ht_bb, tied at 0.67 and decided by array order" },
  { input: "Búlgaro com halteres", ids: ["ss_db"],
    was: "pr_db Dumbbell bench press at 0.67" },
  { input: "Afundo reverso com halteres", ids: ["lgr_db"],
    was: "lg_db Dumbbell lunge, tied at 0.75; PT calls it 'posterior', the source says 'reverso'" },
  { input: "Remada máquina com apoio peitoral", ids: ["rwv_mc"],
    was: "already correct at 0.60; here to catch a regression" },
  { input: "Pulldown pegada neutra", ids: ["pl_mc"],
    was: "already correct at 0.67; here to catch a regression" },
  { input: "Leg press 45°, pés altos e afastados", ids: ["sq_lp"],
    was: "nothing proposed: contains the library name exactly but scored 2/5 = 0.40" },
  { input: "Abdução de quadril na máquina", ids: ["ab_mc"],
    was: "he_mc Machine hip extension at 0.67; the library calls it 'Cadeira abdutora'" },
  { input: "Abdução em pé no cabo", ids: ["ha_cb"],
    was: "no candidates at all; the library had no cable abduction" },
  { input: "RDL", ids: ["hg_bb"],
    was: "no candidates at all; needs an alias" },
  { input: "Banco Romano 45°, ênfase em glúteo", ids: ["hx_bw"],
    was: "nothing usable; topped out at 0.31 against Glute-ham raise" },

  { input: "Hack squat", ids: ["sqk_mc"],
    was: "sqk_bb won a 0.67 tie on array position; that entry is now retired" },

  // Owner arbitration open. Both readings are defensible and the source is silent.
  { input: "Agachamento no Smith, pés à frente", ids: ["sq_sm", "sqc_sm"], arbitration: true,
    was: "sqc_sm won a three-way tie at 0.50; sq_sm is the plainer reading" },
];
