// Proposed copy for Plan 086 slices 2–4, EN and PT, for owner approval.
// Keys are working names; the slice that ships a string gives it its final i18n key.
// `existing` rows are current i18n keys the mocks reuse unchanged; `demo` rows are mock data, not copy.
// Vocabulary follows CONTEXT.md (slice 0, #840): program = treino, session = sessão, the trainer is named
// by their display name, and Taurifer is never called a coach.

export const NEW = {
  // Slice 2 · sharing a program through the relay (Program › Share setup link)
  "relay.share.who_lede": ["Add who it's from. Everything here is optional.", "Diga de quem é. Tudo aqui é opcional."],
  "relay.share.name_label": ["Your name", "Seu nome"],
  "relay.share.registration_label": ["Registration (optional)", "Registro profissional (opcional)"],
  "relay.share.registration_placeholder": ["For example, CREF 012345-G/SP", "Por exemplo, CREF 012345-G/SP"],
  "relay.share.message_label": ["Message (optional)", "Recado (opcional)"],
  "relay.share.attribution_note": ["Shown when they open the program. Taurifer doesn't check names or registrations.", "Aparece quando a pessoa abrir o treino. O Taurifer não confere nomes nem registros."],
  "relay.share.create": ["Create link", "Criar link"],
  "relay.share.preparing": ["Encrypting the program and creating the link…", "Criptografando o treino e criando o link…"],
  "relay.share.scope": ["Program, settings, starting loads and app language · no workout history", "Treino, ajustes, cargas iniciais e idioma do app · sem histórico de sessões"],
  "relay.share.qr_hint": ["They can point their phone camera at this code.", "A pessoa pode apontar a câmera do celular para este código."],
  "relay.share.qr_aria": ["QR code for the program link", "QR code do link do treino"],
  "relay.share.expiry": ["Works for 7 days, until {date}. It's encrypted on this phone, and anyone with the link can open the program.", "Funciona por 7 dias, até {date}. Ele é criptografado neste celular, e quem tiver o link pode abrir o treino."],
  "relay.share.unavailable_fits": ["Couldn't create an encrypted link right now. This setup link carries the whole program instead. It isn't encrypted, and it doesn't carry your name, message or starting loads.", "Não foi possível criar um link criptografado agora. Este link de configuração leva o treino inteiro. Ele não é criptografado e não leva seu nome, recado nem cargas iniciais."],
  "relay.share.unavailable_file": ["Couldn't create an encrypted link right now, and this program is too large for a setup link. Share it as a program file; the other person opens Import and chooses the file.", "Não foi possível criar um link criptografado agora, e este treino é grande demais para um link de configuração. Compartilhe como arquivo de treino; a outra pessoa abre Importar e escolhe o arquivo."],
  "relay.retry": ["Try again", "Tentar de novo"],

  // Slice 2 · the first-run gate, opened from a relay link
  "relay.gate.from": ["From {name}", "De {name}"],
  "relay.gate.body": ["This link carries a program, its settings and the starting loads {name} set. No history comes with it. Nothing changes on this phone until you start the program.", "Este link leva um treino, os ajustes e as cargas iniciais definidas por {name}. Nenhum histórico vem junto. Nada muda neste celular até você começar o treino."],
  "relay.gate.body_anon": ["This link carries a program, its settings and starting loads. No history comes with it. Nothing changes on this phone until you start the program.", "Este link leva um treino, os ajustes e as cargas iniciais. Nenhum histórico vem junto. Nada muda neste celular até você começar o treino."],
  "relay.message_from": ["Message from {name}", "Recado de {name}"],
  "relay.gate.opening": ["Opening the program…", "Abrindo o treino…"],
  "relay.gate.opening_note": ["This needs a connection once. After that, the program works offline.", "Isso precisa de internet uma vez. Depois, o treino funciona sem conexão."],
  "relay.open.unavailable.title": ["Can't open this program right now.", "Não foi possível abrir este treino agora."],
  "relay.open.unavailable.sub": ["Taurifer couldn't reach the service that holds it. Nothing was saved.", "O Taurifer não conseguiu acessar o serviço que guarda o treino. Nada foi salvo."],
  "relay.open.unavailable.hint": ["Check your connection and try again. The link works until it expires.", "Confira sua conexão e tente de novo. O link funciona até expirar."],
  "relay.open.expired.title": ["This program link has expired.", "Este link de treino expirou."],
  "relay.open.expired.sub": ["Program links work for 7 days. Nothing was saved.", "Links de treino funcionam por 7 dias. Nada foi salvo."],
  "relay.open.expired.hint": ["Ask the person who sent it for a new link.", "Peça um link novo a quem enviou."],
  "relay.open.newer.title": ["This program needs a newer Taurifer.", "Este treino precisa de um Taurifer mais novo."],
  "relay.open.newer.sub": ["It was sent from a newer version of the app. Nothing was saved.", "Ele foi enviado de uma versão mais nova do app. Nada foi salvo."],
  "relay.open.newer.hint": ["Reload Taurifer to update it, then open the link again. It works until it expires.", "Recarregue o Taurifer para atualizar e abra o link de novo. Ele funciona até expirar."],
  "relay.open.reload": ["Reload Taurifer", "Recarregar o Taurifer"],
  "relay.open.incomplete.title": ["This program link is incomplete.", "Este link de treino está incompleto."],
  "relay.open.incomplete.sub": ["Part of the link is missing, which happens when it's copied by hand. Nothing was saved.", "Falta uma parte do link, o que acontece quando ele é copiado à mão. Nada foi salvo."],
  "relay.open.incomplete.hint": ["Ask for the link again, or scan the code.", "Peça o link de novo ou leia o código."],

  // Slice 3 · a program update for a client who already has a program
  "relay.update.title": ["Program update", "Atualização do treino"],
  "relay.update.title_new": ["New program", "Treino novo"],
  "relay.update.sub": ["From {name} · {program} · sent {date}", "De {name} · {program} · enviada em {date}"],
  "relay.update.count.one": ["1 change to your program", "1 mudança no seu treino"],
  "relay.update.count.other": ["{n} changes to your program", "{n} mudanças no seu treino"],
  "relay.update.tag.swapped": ["Swapped", "Trocado"],
  "relay.update.tag.changed": ["Changed", "Alterado"],
  "relay.update.tag.added": ["Added", "Incluído"],
  "relay.update.tag.removed": ["Removed", "Removido"],
  "relay.update.see_all": ["See the whole program", "Ver o treino inteiro"],
  "relay.update.history": ["Your history and past programs stay. The update starts with your next session.", "Seu histórico e os treinos anteriores continuam. A atualização vale a partir da próxima sessão."],
  "relay.update.history_draft": ["Your workout in progress stays as it is. The update starts with your next session, and your history stays.", "Sua sessão em andamento continua como está. A atualização vale a partir da próxima sessão, e seu histórico continua."],
  "relay.update.use": ["Use the update", "Usar a atualização"],
  "relay.update.keep": ["Keep my current program", "Manter meu treino atual"],

  // Slice 4 · "send my training"
  "relay.send.card_label": ["For {name}", "Para {name}"],
  "relay.send.card_body.one": ["1 session {name} hasn't seen.", "1 sessão que {name} ainda não viu."],
  "relay.send.card_body.other": ["{n} sessions {name} hasn't seen.", "{n} sessões que {name} ainda não viu."],
  "relay.send.card_action": ["Send to {name}", "Enviar para {name}"],
  "relay.send.card_dismiss": ["Not now", "Agora não"],
  "relay.send.sub": ["{program} · since {date}", "{program} · desde {date}"],
  "relay.send.sub_first": ["{program} · since you started it", "{program} · desde o início"],
  "relay.send.goes": ["What goes", "O que vai"],
  "relay.send.stays": ["What stays on this phone", "O que fica neste celular"],
  "relay.send.go_sessions": ["{n} sessions since {date}: exercises, loads, reps, effort and notes", "{n} sessões desde {date}: exercícios, cargas, repetições, esforço e notas"],
  "relay.send.go_program": ["Your current program", "Seu treino atual"],
  "relay.send.stay_history": ["Everything from before this program", "Tudo de antes deste treino"],
  "relay.send.stay_sent": ["Sessions you already sent", "Sessões que você já enviou"],
  "relay.send.stay_personal": ["Body weight, your setup answers and app settings", "Peso corporal, suas respostas da configuração e ajustes do app"],
  "relay.send.disclosure": ["An encrypted copy is kept for up to 7 days. Anyone with the link can open it.", "Uma cópia criptografada fica guardada por até 7 dias. Quem tiver o link pode abrir."],
  "relay.send.send": ["Send", "Enviar"],
  "relay.send.ready_title": ["Ready for {name}", "Pronto para {name}"],
  "relay.send.ready_body": ["Send the link, or let {name} scan the code. It works for 7 days, until {date}.", "Envie o link ou deixe {name} ler o código. Ele funciona por 7 dias, até {date}."],
  "relay.send.status": ["Link for {name} created {when}", "Link para {name} criado {when}"],
  "relay.send.too_many": ["That's {n} sessions, and one send carries at most 120.", "São {n} sessões, e cada envio leva no máximo 120."],
  "relay.send.too_many_action": ["Send the first 120", "Enviar as primeiras 120"],
  "relay.send.too_many_rest": ["The other {m} go in your next send.", "As outras {m} vão no próximo envio."],
  "relay.send.unavailable": ["Couldn't create the link. Nothing left this phone.", "Não foi possível criar o link. Nada saiu deste celular."],
  "relay.send.unavailable_hint": ["Check your connection and try again.", "Confira sua conexão e tente de novo."],
  "relay.send.nothing": ["No new sessions since you last sent, on {date}.", "Nenhuma sessão nova desde o último envio, em {date}."],
  "relay.send.nothing_hint": ["Finish a session of this program, then send again.", "Termine uma sessão deste treino e envie de novo."],
};

/** Current i18n keys the mocks reuse unchanged (values are read from i18n-*.json at capture time). */
export const EXISTING = [
  "program.share_setup_title", "program.share_setup_copy", "program.share_setup_share", "program.share_setup_file",
  "setup.shared.title", "setup.shared.view", "setup.shared.create", "landing.shared.eyebrow", "dialog.close",
];

/** Mock data only. Never copy. */
export const DEMO = {
  trainer: ["Rafael Lima", "Rafael Lima"],
  registration: ["CREF 012345-G/SP", "CREF 012345-G/SP"],
  program: ["Upper/Lower", "Superior/Inferior"],
  programDays: ["Upper/Lower · 4 days per week", "Superior/Inferior · 4 dias por semana"],
  message: ["Start light in week 1. Tell me how the squat feels after the second session.", "Começa leve na semana 1. Me conta como ficou o agachamento depois da segunda sessão."],
  updMessage: ["We swap the overhead press until your shoulder settles. Tell me how the landmine feels.", "Trocamos o desenvolvimento até o ombro melhorar. Me conta como fica o landmine."],
  expires: ["December 3", "3 de dezembro"],
  sentDate: ["November 25", "25 de novembro"],
  since: ["November 2", "2 de novembro"],
  lastSent: ["November 19", "19 de novembro"],
  today: ["today", "hoje"],
  day: ["Day 2 · mixed", "Dia 2 · misto"],
  e_old: ["Overhead press", "Desenvolvimento com barra"],
  e_new: ["Landmine press", "Desenvolvimento landmine"],
  e_bench: ["Barbell bench press", "Supino reto com barra"],
  e_row: ["Seated cable row", "Remada baixa na polia"],
  e_curl: ["Seated leg curl", "Mesa flexora sentada"],
};
