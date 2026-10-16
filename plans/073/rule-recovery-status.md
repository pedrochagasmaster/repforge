# Estado da recuperação das regras de geração

Retomada de 15/10/2026 após o reset dos limites. O gate de pesquisa de S2 está
fechado somente para o domínio inicial descrito abaixo. A implementação S2 passou
nas jornadas locais de geração e worker. A validação visual completa fica na CI por decisão do owner; commit limpo e CI
ainda são pendentes, registrados no [estado da implementação](implementation-status.md). O contrato continua na
[spec](../../docs/generator-rule-parity-spec.md) e o gate no
[Plano 073](../073-generator-rule-parity.md).

A ampliação inicial de S3 tem domínio próprio no
[contrato de três dias](three-day-expansion-contract.md). As provas puras passaram;
a aceitação no produto depende da CI do novo head. Isso não encerra S3.

## Domínio liberado e revisão da retomada

A [primeira implementação](initial-generation-contract.md) usa Upper/Lower/Full,
três dias, both/Advanced, orçamento50 da faixa40–60, Static, sete ciclos normais,
sem deload e inputs controlados de Gym/capacidades. Warmup smart, overrides null
e ramo de sexo fonte null são explícitos. Não ler Basics.sex nem inferir o perfil
Godmode2. História vazia e configuração de pesos vazia são inputs controlados.
As sete capacidades continuam respostas explícitas; ausência não vira true.

| Componente | Fechamento no domínio inicial | Reprodução privada |
| --- | --- | --- |
| G03/G04, ordem | Prefixo, chave dos compostos, grupos e seis intercalamentos; produtores conservam o domínio P/A/B/C | `resume-ordering-20261015`, revisão e replay isolado do coordenador |
| G03/G04, distribuição | Composição distribuição → custo → spillover → swaps → ordem; enumeração i,j,k,l e igualdade estrutural | `resume-distribution-composition-20261015`, revisão independente `resume-distribution-review-20261015` |
| G06, equipamentos | Parser Single/Loaded por categoria; OR entre alternativas, AND entre requisitos; pluralOf de um nível, primeiro bumper e fallback null | `resume-gym-composition-20261015`, revisão independente `resume-gym-review-20261015` |
| G06, histórico | Origem exerciseGroup, logs elegíveis, média bilateral, rest-pause por série e62 handlers derivados da fonte | `resume-eligibility-next-20261015`, revisão independente `resume-history-review-20261015` |
| G07, compostos | G07-B01 revisto: repetição é rejeição, equipamento é contagem de fallback | `resume-review-cycles-20261015` |
| G07/G09, acessórios | Tier puro, prefilter de classificação/tier, lista relevante e alternância por músculo; append incremental | `resume-accessory-review-20261015`, `resume-contract-20261015`, revisão independente `resume-alternation-review-20261015` |
| G11, Static | Sete índices normais0..6 usam o mesmo Simple target; experience apenas metadado nessa invocação | `resume-review-cycles-20261015`, `resume-experience-next-20261015` |

Esses fechamentos aceitam os contratos comuns das classes SDK identificadas e
seus limites tipados. Não certificam toda a VM ou o gerador original. A revisão
de alternância acrescentou49.200 casos independentes e confirmou que antecipar
materialização muda a escolha. O modelo do coordenador ampliou seus12 nomes para
os22 enums, cobrindo o ramo genérico dos dez restantes. Os recibos preservam o
checkpoint372, as96 fontes e os três checkouts. A engine pública permaneceu
intacta durante a recuperação; a alteração agora pertence à implementação S2.

Há diferenças importantes para a implementação. O score de acessórios é o tier
puro, sem o ajuste P/D dos compostos. O parser de resistência escolhe a primeira
base de categoria adequada, que pode não ser array[0]. Spillover não exige fits
nos papéis primários do destino; isPrimary é somente precedência. O histórico
soma binary64 sequencialmente: quinze grupos de um terço podem ficar abaixo de5.
A descrição antiga de inteiros como Smi era ampla demais; os valores altos
exigem o caminho Mint/pre-unboxed, cuja aritmética finita foi conferida.

A política Taurifer conjuga os handlers/fallback estritos da fonte com suas
exclusões e confirmações obrigatórias. Confirmação pontual não concede assessment
global nem contorna os81 exercícios com preconditions fora dos62 handlers.
AlwaysShow não contorna equipamento. São fronteiras distintas, registradas na
nota privada `resume-eligibility-integration-20261015` e no contrato inicial.

A primeira prova real R05 falhou no head limpo `2e86845c`: o formulário aceitou
cinco de oito músculos despriorizados, recusando os três seguintes. O recibo
`resume-contract-20261015/first-contract-browser.red.evidence.json` preserva
comando, fonte, assert, estado e screenshot. A primeira tentativa tinha um erro
de fixture antes de abrir o hub e está retida separadamente; não conta como red
semântico. Nenhum resultado verde de produto é inferido dessa reprodução.

A implementação S2 já passou no fluxo local completo com 203 verificações de
geração e 46 do worker. Isso ainda não fecha seus gates de publicação. Outros objetivos,
faixas, períodos, deload e divisões mantêm seus gates de ampliação. As entradas
observadas de Godmode2 continuam sem vínculo transacional completo; isso não
impede validar o domínio parametrizado nem autoriza afirmar paridade observada.

## Checkpoint histórico372

As seções seguintes registram o estado anterior à retomada. Seus pendentes
locais foram atualizados pelos fechamentos acima, sem apagar correções e limites
históricos. Não usar a antiga lista de bloqueios como estado atual de S2.

## Fontes, preservação e classificação

O corpus privado é `rea-investigation-20261014`. As fontes históricas são
`continuation-20261015-split-contract/` e `godmode2-20261015/`; o novo trabalho
fica em `continuation-20261015-s1/`. O SHA-256 de `libapp.so`, recalculado pelas
novas extrações, é
`a79f5db63bb7dffdd683fae131fe033deabaef20d14d6ce4e5d4a6debb3f1312`.

O replay executou seis scripts históricos inalterados em um diretório novo.
As 53 saídas comparadas ficaram idênticas byte a byte. Foram preservados os
96 hashes de fontes e o estado de três checkouts. O recibo privado
`replay/replay-receipt.json` registra scripts, hashes e limites. A transcrição
visual foi reutilizada. Reexecutar um decodificador simbólico não constitui
execução Dart nem segunda implementação independente do algoritmo.

A remoção autorizada de uma cópia temporária de CI restabeleceu o piso de 4 GiB.
As novas extrações têm limites de tamanho e tempo. Um pequeno leitor de metadados
foi compilado com objetos e biblioteca Dart já existentes, sem full pass Blutter,
sem `AnalyzeAll` e sem executar o gerador. Ele consulta classes e a tabela de
dispatch carregadas pelo runtime. Os endereços são normalizados pela base da
imagem. A revisão independente reproduziu a saída de 268.260 bytes e confirmou
os 66 hashes de entradas preservadas do leitor. A origem ARM64 da tabela é 4096;
o índice lógico é `classId + 4096 + selectorDelta`, com verificação de limites.

"Decodificado" exige as convenções Dart de tags, Smi, ponteiros comprimidos,
argumentos e stubs registradas nos pacotes. "Validado localmente" limita a regra
ao bloco e domínio explicitados. Modelos de listas e interpretações limitadas de
instruções não equivalem à execução integral da VM.

## Componentes e dependências

| Componente | Evidência e regra | Prova e limite |
| --- | --- | --- |
| Seleção automática, G02 | `0xeb87dc..0xeb886c`: split nulo e 2–6 dias selecionam as divisões registradas em S0. | Replay histórico idêntico. Overrides sintéticos não provam validade na UI. |
| Estrutura Upper/Lower/Full, G03 | `0xecf7e8..0xecfaf4`: três dias ordenados e listas em `+0x0c`, `+0x10`, `+0x14`. | Constructor simbólico reproduzido. `+0x0c` filtra dias; `+0x10` dá preferência a certas ocorrências secundárias; `+0x14` classifica candidatos de spillover. A cadeia integral ainda é parcial. |
| Intercalamento, componente G04 | `0xedd5a0`, `0xedd814`, `0xa4a3c0` e iteradores resolvidos por metadados: índice crescente, listas em ordem, pular listas esgotadas. Duplicatas mantêm suas posições. | Seis casos nomeados e 781 vetores de comprimentos contra oráculo por coordenadas; revisão independente de instruções e dispatch. Domínio: listas padrão finitas, sem mutação, com registros não nulos. Produtores e distribuição integral pendentes. |
| Doses Static parametrizadas, componente G08 | `0xedb734..0xedc02c`: 18 ramos objetivo × tipo × resultado de membership. `0xedc09c..0xedc254`: Static usa o primeiro campo do record, não a tabela de sete ciclos. | Interpretação limitada das instruções, centros esperados independentes e mutação de centro detectada. Membership agora ligado à lista de movementPattern e à igualdade por identidade de enum; consumidores externos continuam pendentes. |
| Ajustes por série, componente G08 | `0xedb4f4..0xedb710`: numSets 1–6; vetores `[0]`, `[0,-1]`, `[1,0,-1]`, `[1,0,0,-1]`, `[1,0,0,-1,-1]`, `[1,1,0,0,-1,-1]`. Fora disso, erro. | Replay de numSets −1 a 8. Determina o tratamento da contagem recebida; não escolhe essa contagem. |
| Reps/RIR locais, componente G08 | `0xedc6dc`: reps center−1/center+1 e RIR `max(0, base+ajuste)`. Sem métrica de reps, os três campos são null. `0xa5f278`/`0x7cd254` reconhecem reps e repsPerSide. | Provas dos blocos aritméticos, limites, caminhos null e descriptor/armazenamento do construtor. Mutações de vetor, direção, piso e campos detectadas. Callback completo e consumidores externos pendentes. |
| Alocação local, componente G05 | `0x12a4044` e `0x12a3edc`: 31 opções ordenadas de compostos e 86 de isoladores. O seletor minimiza a distância temporal; em empate, compostos retêm o último e isoladores o primeiro. | Replay dos loops, blocos de seleção e custo sob contratos explícitos dos operadores. Revisão e reprodução independentes passaram. Consumidores, runtime completo e influência externa de experiência continuam pendentes. |
| Partição de músculos, componente G09 | `0xed5ed0..0xed5f88`: um `Map<MuscleGroup,bool>` separa chaves true/false em duas coleções. `0xedf6c0` filtra a sequência local de grupos musculares para isoladores usando a segunda. | Metadados resolvem entries/where e igualdade por identidade. A ligação à UI e os defaults foram decodificados; 404 casos condicionais de contagem foram reproduzidos pelo coordenador. Seleção e cardinalidade global continuam pendentes. Não demonstra exclusão global ou volume zero. |
| Compatibilidade ULF, componente G03/G04 | `0xed81ac..0xed8edc`: 14 papéis usados pelas listas primárias e preferências secundárias dos três dias. | 10.752 casos role × tipo × subconjunto de padrões × região, dez casos de remapeamento core e dois controles negativos. Interpretação dos ramos com contratos explícitos para prelude e contains. A ordenação usa quatro papéis adicionais, que passaram separadamente em 3.072 casos. Os outros 16 papéis runtime não foram validados. |
| Região efetiva, componente G04 | `0xa53e64`, `0xa54108`, `0xa53f94`, `0x5da610`: região diferente de core é preservada. Em core, abs/obliques prevalecem; nos demais casos vale a primeira categoria não nula. | Nove casos nomeados e 1.936 pares ordenados dos 44 enums. A ordem de movementPattern é semântica. O catálogo contém 43 desses valores; isso não reduz o domínio runtime a 43. |
| Escolha local de dia, componente G04 | `0xede57c..0xedef24`: cursor por papel, mínimo de contagem do mesmo músculo acessório e preferência secundária nas ocorrências ímpares maiores que um. | Seis casos condicionais e quatro políticas erradas detectadas. Mapas de cursor e ocorrência são distintos; append omitido não avança nenhum. Não executa distributeTemplates inteiro. |
| Spillover, componente G04 | `0xedd980`, `0x12a44f4`: duração ordenada, origem e templates em ordem reversa; preferência accessory, depois isPrimary, depois maior melhora com primeiro empate. | 14 casos locais, três jornadas com custos fornecidos, 384 ordenações e provas de remoção estrutural. Contratos e limites descritos abaixo; não é execução integral. |
| Trocas de isoladores, componente G04 | `0xed70a0..0xed81ac`: trocas recíprocas compatíveis, mesmo músculo, séries e região; melhora de overlap antes de repeats. | 625 combinações de deltas e controles de precedência. Classificadores de três músculos passaram em 1.920 casos locais. Enumeração completa dos pares e composição permanecem pendentes. |
| Ranking, componente G07 | `0xee1a68`, `0xee08d4`, `0xedfa30`: tier ajustado por músculos, grupos ordenados, exclusão de exercício já escolhido e penalidades de overlap. | Ramos numéricos e precedência local reproduzidos. Uma ligação incorreta dos callbacks foi corrigida com prova do frame e cinco casos discriminantes; essa correção ainda não recebeu segunda revisão independente. |
| Produtor de séries compostas, componente G05/G08 | `0xed9fac`, `0xed658c`, `0xee16b4`, `0xee1430`: bisseção, seis totais por padrão, primary e distribuição do restante por secondaries. | 50 totais positivos, 101 bisseções, 504 distribuições e seis controles negativos; composição de 812 pares de alocação. Pow, round, boxing e materialização são contratos explícitos. Não executa a escolha de exercícios. |
| Static e ciclos, componente G11 | `0xed6d38..0xed6d68`: construtor recebe numCycles 7, experience e isPeriodized. `0xe02f00` envolve target em CycleTarget e SimplePeriodization. | Ligação estática parcial. Não prova consumo de todos os ciclos, influência global de experiência nem deload. |

O intercalamento materializa pela cadeia `0x6b7dd4 → 0x560c58`. A investigação
inicial examinou um caminho alternativo de conversão; ele não é o consumidor
selecionado aqui. O pacote privado registra a correção e os corpos de iteradores
que sustentam a cadeia efetiva.

Para doses, a base de RIR local é zero em accessory, um no outro tipo quando
membership retorna true e dois quando retorna false. Os centros Static são:

| Objetivo | Primary false/true | Secondary false/true | Accessory |
| --- | --- | --- | --- |
| strength | 5 / 8 | 8 / 10 | 10 |
| both | 5 / 8 | 10 / 12 | 15 |
| hypertrophy | 8 / 10 | 10 / 12 | 15 |

False/true acima são o retorno de `0x6e4ed4`: interseção da lista de
movementPattern do wrapper Exercise (offset semântico `0x3c`, load tagged 59)
com horizontalPull/verticalPull. A igualdade desses enums é por identidade.
O construtor e o serializer ligam essa coleção ao campo correto; não confundir
os offsets do wrapper com os da linha subjacente do catálogo. Não substituir isso por
igualdade sobre um único movementPattern. Ausência de leitura de experience
nesse bloco não prova independência de experience no gerador.

O custo local em microssegundos é `N*(W+R) + 30000000*sum(sets) +
E*sum(max(0,sets−1))`. W é zero para warmup none e 120 segundos nos demais
casos. R é uma duração fixa por categoria, cujo nome de produto ainda não foi
recuperado. E vem de `defaultRestTimerOverrides` ou do fallback por categoria.
O construtor do perfil novo confirma smart e mapa de overrides null como defaults.
A prova interpreta a aritmética original e modela multiplicação de Duration,
map, sum e alocadores pelos contratos auditados. Não executa todo o runtime.

Para entradas explícitas de 50 minutos, três dias, UpperLowerFull, both e perfil
novo, a avaliação seleciona quatro compostos com três séries e quatro isoladores
com três séries na partição upper; três compostos com três séries e seis isoladores
com duas séries na partição lower. São 17 entradas de alocação e 45 séries antes
da conversão em templates.

O produtor recuperado depois divide 12 séries upper em 3/3/3/3, na ordem
horizontalPush, verticalPush, horizontalPull, verticalPull. Divide nove séries
lower em 5/4, na ordem squat, hinge. A bisseção dá a série ímpar extra à primeira
metade. Para um total S por padrão, quatro séries são o caso especial 2+2.
Nos demais totais positivos examinados, `f = 1.884 * pow(S, -0.673)`; primary
recebe S se f excede um, ou `min(5, round(S*f))` nos demais casos. O restante
é dividido entre secondaries pelo limiar recuperado, com parcelas menores antes
das maiores. O pacote privado retém todos os limiares e os bits dos doubles.

No caso explícito, os vetores compostos são `[3]`, `[3]`, `[3]`, `[3]`, `[3,2]`
e `[2,2]`: oito templates e 21 séries. Os isoladores somam dez templates e 24
séries. Isso explica condicionalmente 18/45 pela composição das regras. A escolha
pode retornar null e o produtor omite esses registros; o preenchimento de todos
os isoladores também é uma condição. Portanto, isso não prova paridade final,
nem confirma as configurações efetivas do Godmode2.

## Ranking, músculos e distribuição

O tier é numérico e inclui valores 1,5 e 2,5 no catálogo fixado. O score subtrai
um por overlap com emphasizedAgonist priorizado, soma um por overlap com
emphasizedAgonist despriorizado e soma um quando isFirstOfType e
deemphasizedAgonist sobrepõe prioridades. Cada termo é booleano, não contagem
de músculos. Os ramos usam os campos de strength ou hypertrophy conforme objetivo
e descriptor. Para both, primary usa strength; secondary e accessory usam
hypertrophy. O domínio desse catálogo produz 17 scores possíveis; os blocos FP
passaram em 44 casos de adição por três caminhos e 578 comparações finitas.

A ordem posterior é importante. Exercício idêntico já escolhido é excluído antes
da escolha. Os grupos de score avançam dois por batch; os níveis de overlap de
exclusionGroupings são zero, um e wildcard. No nível zero, vale o primeiro grupo
não vazio. Nos níveis restantes, o primeiro grupo não vazio retém o menor número
de exercícios anteriores com equipamento de resistência canônico em comum.
Isso é contagem, não booleano, e não é um filtro duro de equipamento. A
canonicalização recuperada usa pluralOf em um nível. Só depois vem a escolha
aleatória original, substituível pelo desempate determinístico aprovado.

G07-B01 corrigiu uma troca de funções entre slots do frame de chamada. A versão
inicial do modelo tratava overlap de equipamento como exclusão dura e repetição
como fallback. Uma prova das stores do caller e cinco casos discriminantes
reproduziram o erro antes da correção. O modelo corrigido passou nesses casos,
na precedência anterior e em controles negativos. Essa evidência não apaga a
falha nem equivale à revisão independente ainda pendente da correção.

O mapa da UI usa true para prioridade e false para despriorização. A ligação
até a partição no gerador foi recuperada. Os defaults variam por objetivo e sexo;
se o sexo é null, o construtor usa male. As três listas padrão A/B/C excluem os
priorizados P. A primeira passagem ponderada segue P,P,A,P,B,P,A,C,P,B; as demais
seguem P,A,B. A primeira passagem pertence ao estado compartilhado do iterável,
não à experiência. A despriorização filtra essa sequência local. O consumidor
repete passagens até preencher a contagem solicitada ou encontrar uma passagem
vazia. Seleção null ainda pode reduzir a saída. Não há prova de banimento global
nem de volume indireto zero para o músculo despriorizado.

No spillover de três dias, a ordenação de durações é crescente e estável. A
parada é `round(1.25*minDurationMicros) >= maxDurationMicros`. Um candidato exige
custo positivo e gap estritamente maior que custo. A melhora é
`2*trunc(cost/1000)*trunc((gap-cost)/1000)`, com truncamentos separados. A seleção
prefere accessory, depois isPrimary e depois maior melhora, mantendo o primeiro
empate. Em ULF, a lista `+0x14` vazia deixa isPrimary false. O limite é 200
movimentos aceitos. Isso não cria teto por dia nem tolerância de produto.

A ordenação final tem seis chamadas de roundRobin. A leitura do código liga
isoladores priorizados e três listas padrão a uma árvore de intercalamento, mas
a composição inteira ainda não tem prova executável. O helper de ordem dos
compostos usa 12 papéis específicos; quatro deles ampliam os 14 papéis usados
nas listas dos dias. Os ramos adicionais passaram separadamente em 3.072 casos.
Isso não encerra a ordem final nem valida os 16 papéis runtime restantes.

O otimizador de trocas de isoladores é separado: mesmo músculo, mesmo numSets,
mesma região efetiva e compatibilidade recíproca. Compara redução de overlaps
antes de repeats, retém o primeiro empate e limita 100 trocas. Repeats só conta
classificações iguais e não nulas de hamstrings, quads e lats. Os classificadores
locais foram interpretados; a enumeração de todos os pares ainda não foi fechada.

O filtro original de gym tem alwaysHide, alwaysShow e grupos de resistência e
suporte. alwaysShow pode contornar equipamento no original; isso não autoriza
relaxar as restrições duras Taurifer de R06. isDoNotRecommend foi ligado ao schema
e seu default false. O ramo de assessments contém 62 IDs e sete grupos de
capacidade; o enriquecimento por histórico e a expansão completa de equipamentos
continuam pendentes. Ausência de confirmação não ganha capacidade.

## Revisão dos verificadores locais

A revisão independente encontrou D08-01: uma anotação PP permitia ignorar o
opcode. D08-02: o avaliador de tabelas ignorava um operando de shift extra em ADD.
Três mutações reproduziram aceitação indevida antes da correção. Os avaliadores
agora verificam opcode e formato completo de operandos nessas formas. Os mesmos
casos são rejeitados, e as provas válidas continuam passando.

O revisor executou `evaluate_tables.py`, `replay_local.py` e `strict_negative.py`
em cópia descartável após a correção e encerrou esses dois achados. Isso cobre
as falhas identificadas e o subconjunto interpretado; não certifica um emulador
ARM64 genérico. O intercalamento também teve leitura independente de instruções,
replay do leitor de metadados e reprodução dos modelos sem alterar o pacote.

A revisão de G05 reproduziu os cinco scripts de enumeração, seleção, defaults,
custo e avaliação parametrizada em cópia descartável, com hashes do pacote
original preservados. As provas incluem 32 combinações de comparação/empate,
11 limites da divisão com sinal, 21 casos de custo e quatro ramos de defaults.
Mutações de limite, empate, divisor e custo foram detectadas. A aceitação mantém
os contratos dos operadores explícitos e não encerra G05 ou S1 globalmente.

## Gate no checkpoint histórico e dependências então abertas

O plano exige todas as regras necessárias de G02–G09 e G11 para o domínio
inicial recuperadas e validadas. O contexto observado é três dias, both,
Advanced, Static, faixa 40–60, sem deload, zero priorizados e oito despriorizados.
A associação entre screenshots, equipamentos exportados e geração não é uma
transação controlada. O Godmode2 observa somente Cycle 1, apesar de declarar sete.
As contagens de 18 exercícios e 45 séries são observações, não invariantes.

Permanecem pendentes:

- G03/G04: ordenação final e produtores de cada intercalamento, enumeração dos
  pares de troca, contratos de custo na cadeia completa e composição com casos
  de escolha null, insuficiência e registros duplicados. As regras locais de
  compatibilidade, cursor, remoção e spillover não executam o pipeline inteiro.
- G05/G08: ligar a composição dos produtores à escolha e ao preenchimento real
  dos templates. A aritmética local e o membership recuperado não provam o
  resultado final. A ligação estática de exerciseType e primaryJointAction aos campos cached usados
  pelos classificadores passou em 13 anchors; a execução integral do construtor
  permanece um contrato explícito.
- G06/G07: fechar expansão de equipamentos, assessments enriquecidos por
  histórico, demais caminhos de elegibilidade e revisão independente de G07-B01.
  A escolha determinística só substitui equivalentes depois do ranking correto.
- G11: fechar influência de experiência e consumo normal de SimplePeriodization
  em todos os ciclos do domínio inicial. Construir sete ciclos não prova seus
  alvos nem valida periodizações ou deload fora desse domínio.
- G09: integrar defaults, filtro e repetição à seleção real de isoladores. O sexo
  efetivo e o histórico do caso observado permanecem sem confirmação transacional;
  código recuperado pode validar um domínio parametrizado sem inventar esses dados.

A revisão independente anterior cobre intercalamento, correções D08 e alocação
local. O coordenador reproduziu os pacotes posteriores de músculos e distribuição
em cópias descartáveis. As novas provas escritas pelo próprio coordenador têm
oráculos e controles negativos, mas ainda não receberam revisão por outro agente.
O replay deste checkpoint passou em 22 scripts e vinculou 372 arquivos privados.
Os 96 hashes originais e os três checkouts protegidos foram conferidos antes
e depois. O recibo `checkpoint-receipt.json` tem SHA-256
`fa9988f932ace85b6a6de811bfd82da4735f0eef55cf12074ee5ef164464d9fb`.
Esse replay é do coordenador; não é uma nova revisão independente.
Naquele checkpoint, os três chats Sol 6.1 Low atingiram o limite de uso.
A retomada e o fechamento posterior do domínio inicial estão registrados acima.

Os pacotes privados `round-robin/`, `doses/`, `time-allocation/`, `muscles/`,
`ranking/`, `distribution/`, `cycles/` e `compound-sets/` retêm fonte/hash, PC,
bytes, comandos, resultados e limites. A correção P01 exclui o próprio manifest
de sua lista de outputs e confere todos os hashes após regeneração. O suplemento
público permanece sanitizado e não distribui binários, assembly ou arquivos
pessoais. Nenhuma compatibilidade retroativa é exigida; isso não libera a engine
antes da validação das regras relevantes.
