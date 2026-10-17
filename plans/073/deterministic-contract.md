# Contrato de identidade e fronteiras do gerador

> Registro histórico da auditoria anterior à implementação. As referências a
> código atual, propostas e pendências abaixo descrevem a base identificada,
> não o candidato `073.4`. Consulte o [estado atual e seus gates](implementation-status.md).

Auditoria de G01, G12 e G13 na base `d0242c4679ba6a00cea6fd48f42450f3b6e93322`.
As linhas e símbolos abaixo referem-se a essa base. Este arquivo registra fatos
observados e uma proposta técnica ainda não implementada. Não libera S2.

## Autoridade e limites

D01 e R01 da [spec](../../docs/generator-rule-parity-spec.md) aprovam igualdade
da definição completa para mesmas entradas canônicas, versão e catálogo.
D02 aprova desempate determinístico Taurifer entre candidatos equivalentes.
D05 e D09 dispensam replay legado, preservam dados legíveis e exigem ação
explícita para redefinir dados incompatíveis. Esses são contratos aprovados.

A serialização, a chave e os mecanismos de identidade descritos abaixo são
propostas técnicas. A recuperação do ranking e das regras de distribuição e
doses continua pendente. Canonicalizar entradas não valida essas regras.

## Entradas observadas

`program-entry-adapter.js:programRequestFromAnswers` converte respostas nos
campos abaixo. `program-compiler.js:validateRequest`, linhas 225–316, valida o
request. `generateProgram`, linha 915, incorpora a seed fornecida pelo chamador.

| Campo | Papel atual e tratamento proposto |
| --- | --- |
| `goal`, `experience` | Seleção de roles e prescrição. Enums explícitos. |
| `daysPerWeek`, `split` | Divisão e distribuição. Preservar escolha explícita e recusar incompatibilidade. |
| `timeCeilingMinutes` | Política atual de seleção e ajuste de tempo. A nova opção, orçamento e estimativa têm contratos separados em R04. |
| `periodization`, `cycles`, `deloadCycles` | Prescrição dos ciclos. Ciclos de deload são conjunto de índices. |
| `gymProfile.equipmentIds` | Elegibilidade por equipamento. Conjunto de UUIDs. |
| `competencyAnswers` | Sete respostas com `true`, `false` ou `null`. Ausência não é confirmação. |
| `movementConfirmations` | Mapa de exercício para conjunto de pré-requisitos confirmados. |
| `emphasisMuscleIds`, `deprioritizedMuscleIds` | Conjuntos independentes. A ordem atual afeta a alocação e deve ser canonicalizada antes dela. |
| `excludedExerciseIds`, `excludedMuscleIds` | Restrições duras em conjuntos. |
| `preferredExerciseIds` | Pertinência booleana atual, sem prioridade por posição. Conjunto. |
| `executionContexts` | Mapa de exercício para execução bilateral ou unilateral. O compilador aceita o campo, mas o adapter ordinário não o produz. |

`app.js:16521` também aceita `answers.programRequest` diretamente. Essa entrada
precisa atravessar a mesma fronteira canônica do request produzido pelo adapter.
Campos desconhecidos devem ser recusados nessa fronteira, sem participar do hash
ou passar silenciosamente para a definição.

Na conversão ordinária, `basics`, `recentConsistency`, `preferredRestSeconds`,
`priorityMovements`, nome e metadados do draft não afetam a geração. Não ganharão
efeito sem entrada explícita, regra recuperada e versão. O ambiente vira conjunto
de equipamentos. Os ajustes somam e removem grupos por identidade.

O adapter atual trunca músculos com `.slice(0, 5)`, descarta IDs inválidos e
converte split desconhecido ou incompatível para `auto`. O validator também limita
músculos em cinco. Essas perdas não satisfazem R01, R02 e R05.

## Serialização e igualdade propostas

A fronteira pura do compilador produz uma única requisição canônica. A chave de
geração contém `requestVersion`, `generatorVersion`, `catalogIdentity` e `request`.
Objetos têm chaves ordenadas. Conjuntos têm UUIDs deduplicados em ordem ASCII.
Valores desconhecidos, ausentes, negativos e explícitos permanecem distintos
quando o domínio os distingue. Defaults documentados são resolvidos uma vez.

A serialização não ordena arrays genericamente. Dias, slots, ciclos prescritos,
sets e sequências de templates mantêm ordem semântica. `alternates` mantém a ordem
escrita pelo lifter, conforme `program-compiler.js:1238–1243`. A ordem de métricas
mantém alinhamento com suas definições. `movementPattern` também conserva ordem:
a recuperação de `0xa53e64` mostra que, em certos exercícios marcados como core,
a primeira categoria não nula decide sua região efetiva. Ordenar essa lista
pode alterar compatibilidade e distribuição. O catálogo canônico precisa tratar
esse campo como sequência semântica, mesmo quando seus membros são enums únicos.

`validateRequest` hoje deduplica listas sem ordenar. `applyEmphasis:1025` percorre
prioridades na ordem recebida, escolhendo doadores e posições. Portanto, permutar
um conjunto pode alterar exercícios, sets e IDs. A canonicalização precede esse
processamento. O efeito novo de despriorização depende da recuperação de S1.

A igualdade cobre a definição inteira, inclusive IDs derivados, relações e
proveniência das regras. Nome traduzido, rota, draftId, owner, revisão, timestamps
e identidade da ativação ficam no envelope de operação. Edições posteriores têm
seu próprio log e não modificam a recomendação original.

## Seed, desempate e catálogo

`app.js:18888` cria `draftId` por `uid`, definido em `1256` com UUID ou relógio e
random. `entryGeneratorRequest:16524` usa o draftId como seed. A seed atravessa o
adapter, `program-engine.js:31,78,182` e `generateProgram:915`. Afeta ranking em
`473–518`, IDs de dias em `606`, slots em `795`, sets em `883` e ênfase em `1043`.

A proposta remove a seed variável dos consumidores internos. Se o algoritmo
mantiver uma seed interna, ela será derivada somente da chave canônica. IDs
usam namespace e caminho semântico completo, ou digest com resolução de colisão
determinística. FNV32 sem tratamento de colisão não basta como identidade única.

O ranking atual é tier, preferido, hash da seed e `localeCompare`. O desempate
final proposto usa comparação ASCII total. A substituição fica depois do ranking
recuperado, sem transformar preferências do lifter em empate técnico. Relógios
usados para medir latência não entram na decisão. Nenhum relógio ou random interno
foi encontrado no compilador examinado.

`exercise-catalog.js:43–69` verifica o SHA256 dos bytes carregados. Esse pin de
integridade permanece. `shared-setup.js:238–250` calcula outra identidade usando
`generatedAt`, ordem de `exercises` e `uuidIndex`. Essa identidade atual não é
invariante à ordem incidental.

A proposta distingue integridade de bytes e identidade semântica do catálogo.
A segunda usa conteúdo canônico versionado, exercícios por UUID, objetos por chave
e ordenação apenas dos arrays classificados como conjuntos. `generatedAt` fica
fora da decisão. O conteúdo usado pela seleção e prescrição permanece incluído.
A resolução atual da ontologia usa nomes do fonte e recusa ambiguidade. Nomes
traduzidos não podem participar da seleção.

## Mapa de consumidores

| Dono na base | Contrato a integrar |
| --- | --- |
| `program-entry-adapter.js:programRequestFromAnswers`, `createProductionServices` | Conversão sem perda, chamada da fronteira canônica e fingerprint comum. |
| `program-entry.js:normalizeAnswers`, `normalizeProgramRequest` | Mesmo domínio de entrada, sem limites próprios conflitantes. |
| `app.js:16518–16538` | Request e identidade do candidato independentes do draftId. |
| `app.js:16559–16654` | Cache e execução usam request, versão e catálogo canônicos. |
| `program-engine.js:31,78,182` | Worker e fallback recebem o mesmo contrato. Cancelamento e resultado obsoleto permanecem estados próprios. |
| `app.js:17483–17521` | Baseline após reload é a recomendação canônica. DraftId continua vinculando posse e replay do log. |
| `program-review.js:385–390` | IDs de edição derivados da posição do log continuam separados dos IDs da geração original. |
| `shared-setup.js:259–285` | Receita da versão vigente regenera definição inteira idêntica. Versão ou catálogo incompatível recebe recusa antes da persistência. |
| `app.js:12686–12690` | Codec síncrono e assíncrono usam a mesma identidade e request. |
| `program-entry.js:1883–1908,2005–2007` | Retomada e ativação respeitam versão sem reconstrução implícita. |

Ativação persiste exatamente a definição revisada. As jornadas de Program,
Today, Focus, sessão e reload conferem consumo de dias, exercícios e alvos. Não
há segunda engine nem adaptação automática de receita antiga à versão nova.

## Fronteiras de dados

A versão da geração não decide sozinha se uma definição é legível. Programa e
histórico ainda validáveis continuam utilizáveis sem regeneração e sem repontar
IDs de movimentos. D05 não exige remover schemas que continuam legíveis.

Receita incompatível recebe `unsupported-version`; catálogo incompatível recebe
`catalog-mismatch`, distinção existente em `shared-setup.js:274–280`. Link e import
incompatíveis são recusados antes de persistir, com explicação e fonte preservada.
Não executar receita antiga pela engine atual.

`resumeSetupDraft` já retorna `rules_changed` e `savedPreviewPreserved` quando o
draft normaliza mas versões mudaram. O novo contrato mantém preview e bytes sem
rebuild implícito. Draft que não normaliza também precisa preservar os bytes e
oferecer recomeço explícito. A implementação ainda deve conferir o caminho real
de boot para cada quebra identificada.

Armazenamento sem interpretação confiável conserva a proteção de recovery.
`app.js:21232–21301` contém escolhas de exportar, recuperar e recomeçar. Redefinição
usa a fronteira transacional existente, declara o conjunto afetado e preserva os
dados fora dele. Cancelar não escreve. Nenhuma migração nem engine legada é exigida.

## Provas a escrever antes da implementação

As provas puras são justificadas pelos espaços combinatórios e falhas de protocolo
abaixo, que uma pequena jornada de browser não exercita deterministicamente.
Todas estão planejadas. Esta auditoria não executou testes de comportamento.

| Falha concreta | Prova pura anterior à mudança | Dono existente |
| --- | --- | --- |
| Ordem incidental de conjuntos, mapas ou catálogo altera saída | Permutações e duplicações mantêm definição inteira igual | `test/program-compiler-plan067.mjs`, `test/generative/properties/program-compiler.mjs` |
| Canonicalização destrói ordem semântica | Dias, slots, sets, métricas alinhadas, movementPattern e alternates conservam ordem | Propriedades do compiler e contratos de review |
| Confirmação ausente vira consentimento | Ausência, `null`, `false`, `true` e pré-requisitos parciais mantêm distinções | `test/program-entry-production-adapter.mjs`, compiler |
| Hash colide e empate depende da ordem do catálogo | Exercitar colisões e empate total com IDs distintos | Compiler e propriedades |
| Prioridades disputam doadores ou despriorização é ignorada | Conjuntos permutados, zero priorizados, oito despriorizados e exclusões | Compiler e adapter |
| Cache aceita resultado de outra versão ou catálogo | Campo influente muda chave; envelope não muda chave | `test/program-engine-worker.mjs` e contratos de entry |
| Busca esgotada é descrita como impossível | Caso que atinge limite sem prova de insatisfatibilidade | `test/program-compiler-search.mjs` |
| Formato incompatível escreve ou perde fonte | Versão, catálogo, request e draft inválidos recusados com bytes preservados | `test/shared-setup-unit.mjs`, provas de persistência conforme quebra |

O risco de busca existe hoje. `selectAllJobs:665–715` limita a visita em 50.000 nós
e pode devolver conflito de impossibilidade. Esgotamento, cancelamento e ausência
de solução precisam ser estados distintos em R06.

A01 e A03 ainda exigem worker e fallback, reload e percurso de produção em
`test/program-engine-worker.mjs`, `test/generate-program-browser.mjs` e donos de
entry e review. A08 exige recusa e cancelamento pelos caminhos reais em
`test/share-program-browser.mjs`, `test/program-import-review.mjs` e provas de
draft e persistência afetadas. Testes puros não substituem essas jornadas.
