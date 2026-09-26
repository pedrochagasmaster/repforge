# Direction D: strings

Appendix to the [implementation spec](direction-d-implementation-spec.md), §6.
Every string a D screen shows, with its app key. **Reuse** rows already ship:
use the key as it is, word for word. **New** rows are added to `i18n-en.json`
and `i18n-pt.json` in the slice that first renders them, then `i18n.js` is
regenerated with `node tools/build-i18n.mjs`.

Totals: 144 strings, 25 reuse, 119 new.

Rules that apply to every row:

- Placeholders are the curly tokens shown; translate around them, never concatenate.
- A family used dynamically (`today.tally.*`, `stats.outcome_short.*`, `why.lead.*`) is written out as literal keys in the renderer, because `test/i18n.mjs` rejects unenumerated template keys.
- `today.tally.*` and similar count strings use the `.one` / `.other` pair shown; choose by `n === 1`.
- No em dashes, no "Regrediu", no "Hold" as a timer label. The review page's source of each row is in the last column, so the drawing and the app stay traceable.
- A key a slice does not render is not added in that slice.

| App key | Status | PT | EN | Surface | Review-page key |
| --- | --- | --- | --- | --- | --- |
| `exercise.chart.aria` | New | {metric} do {name} por sessão | {metric} for {name} by session | Exercise chart | `d.chart.aria` |
| `exercise.chart.fig.change` | New | no bloco, kg | this block, kg | Exercise chart | `d.chart.fig.change` |
| `exercise.chart.fig.e1rm` | New | melhor e1RM, kg | best e1RM, kg | Exercise chart | `d.chart.fig.e1rm` |
| `exercise.chart.fig.top` | New | maior carga, kg | top load, kg | Exercise chart | `d.chart.fig.top` |
| `exercise.chart.readout` | New | {date} · {metric} {value} kg · {set} | {date} · {metric} {value} kg · {set} | Exercise chart | `d.chart.readout` |
| `focus.exmeta.anchor` | New | 1 × {amin}–{amax} + {n} × {bmin}–{bmax} reps | 1 × {amin}–{amax} + {n} × {bmin}–{bmax} reps | Focus | `d.exmeta.anchor` |
| `focus.exmeta.effort` | New | {sets} × {reps} reps · RIR {rmin}–{rmax} | {sets} × {reps} reps · RIR {rmin}–{rmax} | Focus | `d.exmeta.effort` |
| `focus.exmeta.goal` | New | {sets} séries · total {goal} reps · RIR {rmin}–{rmax} | {sets} sets · {goal} reps total · RIR {rmin}–{rmax} | Focus | `d.exmeta.goal` |
| `focus.exmeta.manual` | New | {sets} × {min}–{max} reps | {sets} × {min}–{max} reps | Focus | `d.exmeta.manual` |
| `focus.exmeta.range` | New | {sets} × {min}–{max} reps · RIR {rmin}–{rmax} | {sets} × {min}–{max} reps · RIR {rmin}–{rmax} | Focus | `d.exmeta.range` |
| `focus.head.day_ex` | New | {day} · exercício {n} de {m} | {day} · exercise {n} of {m} | Focus | `d.head.day_ex` |
| `focus.next_row` | New | Próximo: {name} | Next: {name} | Focus | `d.next_row` |
| `focus.prev_line` | New | antes {load} × {reps} · RIR {rir} | last {load} × {reps} · RIR {rir} | Focus | `d.prev_line` |
| `focus.prev_line_norir` | New | antes {load} × {reps} · sem RIR | last {load} × {reps} · no RIR | Focus | `d.prev_line_norir` |
| `focus.session_sheet` | New | Ver como tabela | Show as table | Focus | `d.table_view` |
| `focus.set_label` | New | Série {n} | Set {n} | Focus | `d.set_label` |
| `focus.shelf.field_load` | New | Carga, kg | Load, kg | Focus | `d.field.load` |
| `focus.shelf.log_set` | New | Registrar série {n} | Log set {n} | Focus | `d.log_set` |
| `focus.shelf.pad_load` | New | {sign} {step} kg | {sign} {step} kg | Focus | `d.pad.load` |
| `focus.shelf.pad_reps` | New | {sign} 1 rep | {sign} 1 rep | Focus | `d.pad.reps` |
| `focus.shelf.pad_rir` | New | {sign} 1 RIR | {sign} 1 RIR | Focus | `d.pad.rir` |
| `log.focus.progress` | Reuse | {done} de {planned} | {done} of {planned} | Focus | `d.freq.count` |
| `log.save_meta.planned` | Reuse | {muscles} · {sets} séries | {muscles} · {sets} sets | Focus | `d.program.day_meta` |
| `log.save_set_aria` | Reuse | Salvar série {n} | Save set {n} | Focus | `d.save_set` |
| `log.set` | Reuse | Série | Set | Focus | `d.col.set` |
| `log.skip` | Reuse | Pular | Skip | Focus | `d.rest.skip` |
| `rest.inline.done` | New | Descanso concluído | Rest done | Focus (rest) | `d.rest.done` |
| `rest.inline.done_over` | New | Descanso concluído · +{time} | Rest done · +{time} | Focus (rest) | `(decision 14)` |
| `rest.inline.label` | New | Descanso | Rest | Focus (rest) | `d.rest.label` |
| `rest.inline.next` | New | Série {n}: manter {load} kg, buscar {reps} reps | Set {n}: hold {load} kg, aim for {reps} reps | Focus (rest) | `d.rest.next` |
| `rest.inline.of` | New | de {t} | of {t} | Focus (rest) | `d.rest.of` |
| `rest.inline.pause` | New | Pausar | Pause | Focus (rest) | `d.rest.pause` |
| `rest.inline.resume` | New | Retomar | Resume | Focus (rest) | `d.rest.resume` |
| `rest.sheet.title` | Reuse | Timer de descanso | Rest timer | Focus (rest) | `d.timer` |
| `ledger.col.next` | New | Próxima (kg) | Next (kg) | Focus, History session | `d.col.next` |
| `ledger.col.sets_range` | New | Séries × faixa | Sets × range | Focus, History session | `d.col.sets_range` |
| `ledger.col.target` | New | Meta | Target | Focus, History session | `d.col.target` |
| `ledger.col.top_set` | New | maior série | top set | Focus, History session | `d.col.top_set` |
| `entry.catalogue.sets_exact` | Reuse | {n} séries | {n} sets | History | `d.history.sets` |
| `history.before` | New | Antes, {date}: {sets} | Before, {date}: {sets} | History | `d.history.before` |
| `history.cal_hint` | New | Dias com sessão estão marcados. | Days with a session are marked. | History | `d.history.cal_hint` |
| `history.calendar` | New | Abrir o calendário | Open the calendar | History | `d.history.calendar` |
| `history.freq.per_week` | New | Por semana | Per week | History | `d.freq.per_week` |
| `history.freq.per_weekday` | New | Por dia da semana | By weekday | History | `d.freq.per_weekday` |
| `history.freq.title` | New | Frequência no bloco | Frequency this block | History | `d.freq.title` |
| `history.freq.total` | New | {done} de {planned} sessões no bloco, semana {n} de {total} | {done} of {planned} sessions this block, week {n} of {total} | History | `d.freq.total` |
| `history.freq.wk` | New | S{n} | W{n} | History | `d.freq.wk` |
| `history.prs` | New | {n} PR | {n} PR | History | `d.history.prs` |
| `history.prs_many` | New | {n} PRs | {n} PRs | History | `d.history.prs_many` |
| `history.search_aria` | Reuse | Buscar sessões | Search sessions | History | `d.history.search` |
| `history.week` | New | Semana {n} · {done} de {planned} | Week {n} · {done} of {planned} | History | `d.history.week` |
| `program.editor.exercises_word` | Reuse | exercícios | exercises | Program | `d.totals.lifts` |
| `program.overview.lede` | New | {goal}, 3 dias por semana, semana {n} de {total} | {goal}, 3 days per week, week {n} of {total} | Program | `d.program.lede` |
| `program.overview.legend` | New | Próxima: carga sugerida pelo Taurifer para a próxima sessão | Next: the load Taurifer suggests for the next session | Program | `d.program.legend` |
| `program.overview.status` | New | {status}: {n} de {m} nos últimos 7 dias | {status}: {n} of {m} in the last 7 days | Program | `d.program.status` |
| `program.progression.backoff_sets` | Reuse | Séries mais leves | Lighter sets | Program | `d.why.lead.backoff` |
| `stats.exercise` | Reuse | Exercício | Exercise | Progress, Summary, History | `d.col.exercise` |
| `stats.outcome_short.missing_effort` | New | Sem RIR | No RIR | Progress, Summary, History | `d.short.missing-effort` |
| `stats.outcome_short.single_observation` | New | Primeira sessão | First session | Progress, Summary, History | `d.short.single-observation` |
| `stats.overview.attention` | New | Precisa de atenção ({n}) | Needs attention ({n}) | Progress, Summary, History | `d.progress.attention` |
| `stats.overview.evidence` | New | {kind}, {n} sessões | {kind}, {n} sessions | Progress, Summary, History | `d.progress.evidence` |
| `stats.overview.strength` | New | Força neste bloco | Strength this block | Progress, Summary, History | `d.progress.strength` |
| `stats.overview.week` | New | Semana {n} de {total} em andamento | Week {n} of {total} in progress | Progress, Summary, History | `d.progress.week` |
| `stats.this_week.working_sets` | Reuse | séries de trabalho | working sets | Progress, Summary, History | `d.progress.sets` |
| `ex.actions.title` | Reuse | Ações do exercício | Exercise actions | Shared | `d.more` |
| `plural.session.other` | Reuse | sessões | sessions | Shared | `d.progress.sessions` |
| `plural.session.other` | Reuse | sessões | sessions | Shared | `d.chart.fig.sessions` |
| `plural.set.other` | Reuse | séries | sets | Shared | `d.totals.sets` |
| `dialog.close` | Reuse | Fechar | Close | Sheets | `d.why.close` |
| `summary.muscles_all` | New | Ver os {n} músculos | Show all {n} muscles | Summary | `d.muscles.all` |
| `summary.muscles_fewer` | New | Ver menos | Show fewer | Summary | `d.muscles.fewer` |
| `summary.next_target` | New | Próxima: {target} | Next: {target} | Summary | `d.next_target` |
| `summary.outcome_head` | New | Resultado e próxima meta | Outcome and next target | Summary | `d.outcome.head` |
| `summary.saved_week` | New | {date}, semana {n} | {date}, week {n} | Summary | `d.saved_week` |
| `delta.changed_load.label` | Reuse | Carga alterada | Changed load | Summary, History, Progress | `d.short.changed-load` |
| `delta.not_comparable.label` | Reuse | Não comparável | Not comparable | Summary, History, Progress | `d.short.incompatible-exposure` |
| `nav.log` | Reuse | Hoje | Today | Today | `d.calc.today` |
| `nav.settings` | Reuse | Ajustes | Settings | Today | `d.settings` |
| `nav.stats` | Reuse | Progresso | Progress | Today | `d.chart.back` |
| `today.leave_workout_aria` | Reuse | Voltar para Hoje | Back to Today | Today | `d.back_today` |
| `today.lede_week` | New | {program}, semana {n} de {total} | {program}, week {n} of {total} | Today | `d.lede_week` |
| `today.rx.meta` | New | {lifts} exercícios, {sets} séries | {lifts} exercises, {sets} sets | Today | `d.rx.meta` |
| `today.rx.title` | New | Prescrição de hoje | Today's prescription | Today | `d.rx.title` |
| `today.sub.before` | New | Antes {sets} | Last {sets} | Today | `d.sub.before` |
| `today.sub.first` | New | Primeira vez | First time | Today | `d.sub.first` |
| `today.tally.down.one` | New | {n} reduz | {n} backs off | Today | `d.tally.down.one` |
| `today.tally.down.other` | New | {n} reduzem | {n} back off | Today | `d.tally.down.other` |
| `today.tally.hold.one` | New | {n} mantém | {n} holds | Today | `d.tally.hold.one` |
| `today.tally.hold.other` | New | {n} mantêm | {n} hold | Today | `d.tally.hold.other` |
| `today.tally.manual.one` | New | {n} manual | {n} manual | Today | `d.tally.manual.one` |
| `today.tally.manual.other` | New | {n} manuais | {n} manual | Today | `d.tally.manual.other` |
| `today.tally.new.one` | New | {n} novo | {n} new | Today | `d.tally.new.one` |
| `today.tally.new.other` | New | {n} novos | {n} new | Today | `d.tally.new.other` |
| `today.tally.recover.one` | New | {n} recupera | {n} recovers | Today | `d.tally.recover.one` |
| `today.tally.recover.other` | New | {n} recuperam | {n} recover | Today | `d.tally.recover.other` |
| `today.tally.stalled.one` | New | {n} travado | {n} stalled | Today | `d.tally.stalled.one` |
| `today.tally.stalled.other` | New | {n} travados | {n} stalled | Today | `d.tally.stalled.other` |
| `today.tally.up.one` | New | {n} sobe | {n} goes up | Today | `d.tally.up.one` |
| `today.tally.up.other` | New | {n} sobem | {n} go up | Today | `d.tally.up.other` |
| `today.target.anchor` | New | 1 + {n} | 1 + {n} | Today | `d.target.anchor` |
| `today.target.total` | New | total {n} | total {n} | Today | `d.target.total` |
| `today.week_line` | New | {done} de {planned} sessões | {done} of {planned} sessions | Today | `d.week_line` |
| `custom.title` | Reuse | Exercício personalizado | Custom exercise | Today, Focus | `d.sub.custom` |
| `rec.anchor.session.label` | Reuse | Séries leves | Lighter sets | Why this weight | `d.calc.backoff` |
| `why.calc` | New | Ver o cálculo | See the working | Why this weight | `d.why.calc` |
| `why.calc.block` | New | Bloco | Block | Why this weight | `d.calc.block` |
| `why.calc.capacity` | New | Capacidade mostrada | Capacity shown | Why this weight | `d.calc.capacity` |
| `why.calc.capacity_v` | New | cerca de {cap} reps com {load} kg | about {cap} reps at {load} kg | Why this weight | `d.calc.capacity_v` |
| `why.calc.goal` | New | Total | Total | Why this weight | `d.calc.goal` |
| `why.calc.last` | New | Última sessão, {date} | Last session, {date} | Why this weight | `d.calc.last` |
| `why.calc.new_load` | New | Nova carga | New load | Why this weight | `d.calc.new_load` |
| `why.calc.rep_target` | New | Meta de reps | Rep target | Why this weight | `d.calc.rep_target` |
| `why.calc.rep_target_v` | New | cerca de {pred} − {rir} = {reps} | about {pred} − {rir} = {reps} | Why this weight | `d.calc.rep_target_v` |
| `why.calc.rule` | New | Regra | Rule | Why this weight | `d.calc.rule` |
| `why.calc.rule_hold` | New | dentro da faixa, {min}–{max} | inside the range, {min}–{max} | Why this weight | `d.calc.rule_hold` |
| `why.calc.rule_top` | New | topo da faixa, {max} | range top, {max} | Why this weight | `d.calc.rule_top` |
| `why.calc.set` | New | Série {n} | Set {n} | Why this weight | `d.calc.set` |
| `why.calc.split` | New | Divisão | Split | Why this weight | `d.calc.split` |
| `why.calc.working` | New | Cálculo | Working | Why this weight | `d.calc.working` |
| `why.calc_hide` | New | Ocultar o cálculo | Hide the working | Why this weight | `d.why.calc_hide` |
| `why.evidence` | New | Com base em {n} sessão comparável, {date} | Based on {n} comparable session, {date} | Why this weight | `d.why.evidence` |
| `why.lead.anchor` | New | Série principal | Top set | Why this weight | `d.why.lead.anchor` |
| `why.lead.effort` | New | Esforço registrado | Logged effort | Why this weight | `d.why.lead.effort` |
| `why.lead.goal` | New | Total da última vez | Last session's total | Why this weight | `d.why.lead.goal` |
| `why.lead.hold` | New | A faixa ainda tem espaço | The range still has room | Why this weight | `d.why.lead.hold` |
| `why.lead.load` | New | Passo de carga | Load step | Why this weight | `d.why.lead.load` |
| `why.lead.load_hold` | New | Mesma carga | Same load | Why this weight | `d.why.lead.load_hold` |
| `why.lead.manual` | New | Carga do programa | Program load | Why this weight | `d.why.lead.manual` |
| `why.lead.recover` | New | Séries pesadas, reps iguais | Hard sets, same reps | Why this weight | `d.why.lead.recover` |
| `why.lead.reps` | New | Meta de {n} reps | Target of {n} reps | Why this weight | `d.why.lead.reps` |
| `why.lead.rule` | New | O que a regra pede | What the rule asks | Why this weight | `d.why.lead.rule` |
| `why.lead.set1` | New | O que a série 1 mostrou | What set 1 showed | Why this weight | `d.why.lead.set1` |
| `why.lead.set2` | New | Meta da série 2 | Set 2 target | Why this weight | `d.why.lead.set2` |
| `why.lead.spread` | New | Como as reps se dividem | How the reps split | Why this weight | `d.why.lead.spread` |
| `why.lead.stalled` | New | Três sessões iguais | Three sessions alike | Why this weight | `d.why.lead.stalled` |
| `why.lead.top` | New | Topo da faixa atingido | Top of the range reached | Why this weight | `d.why.lead.top` |
| `why.manual` | New | O programa define esta carga. O Taurifer não a altera. | The program sets this load. Taurifer does not change it. | Why this weight | `d.why.manual` |
| `why.ok` | New | Entendi | Got it | Why this weight | `d.why.ok` |
| `why.performed` | New | {reps} reps com {load} kg, RIR {rirs}. | {reps} reps at {load} kg, RIR {rirs}. | Why this weight | `d.why.performed` |
| `why.set1` | New | A série 1 mostrou uma capacidade de {cap}: {reps} reps com {load} kg e RIR {rir}. | Set 1 showed a capacity of {cap}: {reps} reps at {load} kg and RIR {rir}. | Why this weight | `d.why.set1` |
| `why.set2` | New | Com a queda habitual entre séries, a capacidade prevista é de cerca de {pred} na próxima série. Menos seu RIR habitual de {rir}, a meta fica em {reps}. | With your usual drop between sets, the predicted capacity is about {pred} on the next set. Minus your usual {rir} RIR, the target stays at {reps}. | Why this weight | `d.why.set2` |
| `why.short` | New | Por quê? | Why? | Why this weight | `d.why_short` |
| `why.split` | New | As {total} repetições de hoje se dividem em {reps}. | Today's {total} reps split into {reps}. | Why this weight | `d.why.split` |
| `why.top_rir` | New | Você registrou RIR {rir}. | You logged RIR {rir}. | Why this weight | `d.why.top_rir` |
