# Estado da recuperação das regras de geração

Checkpoint de 15/10/2026, após replay isolado e recuperação limitada de S1.
S2 permanece bloqueada. Nenhuma engine foi alterada. O contrato continua na
[spec](../../docs/generator-rule-parity-spec.md) e o gate no
[Plano 073](../073-generator-rule-parity.md).

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
| Estrutura Upper/Lower/Full, G03 | `0xecf7e8..0xecfaf4`: três dias ordenados e listas em `+0x0c`, `+0x10`, `+0x14`. | Constructor simbólico reproduzido. Consumidores e semântica integral dos campos adicionais pendentes. |
| Intercalamento, componente G04 | `0xedd5a0`, `0xedd814`, `0xa4a3c0` e iteradores resolvidos por metadados: índice crescente, listas em ordem, pular listas esgotadas. Duplicatas mantêm suas posições. | Seis casos nomeados e 781 vetores de comprimentos contra oráculo por coordenadas; revisão independente de instruções e dispatch. Domínio: listas padrão finitas, sem mutação, com registros não nulos. Produtores e distribuição integral pendentes. |
| Doses Static parametrizadas, componente G08 | `0xedb734..0xedc02c`: 18 ramos objetivo × tipo × resultado de membership. `0xedc09c..0xedc254`: Static usa o primeiro campo do record, não a tabela de sete ciclos. | Interpretação limitada das instruções, centros esperados independentes e mutação de centro detectada. O booleano de membership é entrada explícita, ainda dependente da coleção e operadores. |
| Ajustes por série, componente G08 | `0xedb4f4..0xedb710`: numSets 1–6; vetores `[0]`, `[0,-1]`, `[1,0,-1]`, `[1,0,0,-1]`, `[1,0,0,-1,-1]`, `[1,1,0,0,-1,-1]`. Fora disso, erro. | Replay de numSets −1 a 8. Determina o tratamento da contagem recebida; não escolhe essa contagem. |
| Reps/RIR locais, componente G08 | `0xedc6dc`: reps center−1/center+1 e RIR `max(0, base+ajuste)`. Sem métrica de reps, os três campos são null. `0xa5f278`/`0x7cd254` reconhecem reps e repsPerSide. | Provas dos blocos aritméticos, limites, caminhos null e descriptor/armazenamento do construtor. Mutações de vetor, direção, piso e campos detectadas. Callback completo e consumidores externos pendentes. |
| Alocação local, componente G05 | `0x12a4044` e `0x12a3edc`: 31 opções ordenadas de compostos e 86 de isoladores. O seletor minimiza a distância temporal; em empate, compostos retêm o último e isoladores o primeiro. | Replay dos loops, blocos de seleção e custo sob contratos explícitos dos operadores. Revisão e reprodução independentes passaram. Consumidores, runtime completo e influência externa de experiência continuam pendentes. |
| Partição de músculos, componente G09 | `0xed5ed0..0xed5f88`: um `Map<MuscleGroup,bool>` separa chaves true/false em duas coleções. `0xedf6c0` filtra a sequência local de grupos musculares para isoladores usando a segunda. | Metadados resolvem entries/where e igualdade por identidade. Falta fechar a ligação completa à UI, materialização e efeitos completos. Não demonstra exclusão global ou volume zero. |

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

False/true acima são o retorno de `0x6e4ed4`, aplicado à coleção
`Exercise+0x3c` e à lista horizontalPull/verticalPull. Não substituir isso por
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
dos produtores de templates e da distribuição. Não são uma previsão validada de
programa final nem uma afirmação sobre as configurações efetivas do Godmode2.

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

## Gate exato de S2 e próximas dependências

O plano exige todas as regras necessárias de G02–G09 e G11 para o domínio
inicial recuperadas e validadas. O contexto observado é três dias, both,
Advanced, Static, faixa 40–60, sem deload, zero priorizados e oito despriorizados.
A associação entre screenshots, equipamentos exportados e geração não é uma
transação controlada. O Godmode2 observa somente Cycle 1, apesar de declarar sete.
As contagens de 18 exercícios e 45 séries são observações, não invariantes.

Permanecem pendentes:

- G03/G04: consumidores dos campos adicionais, compatibilidade, score, escolha
  e ordem dos dias, produtores do intercalamento, insuficiência e spillover.
  O fator 1,25 observado não prova tolerância temporal por dia.
- G05: consumidores das alocações, domínio completo dos operadores de custo,
  configurações efetivas do caso observado e ligação às contagens dos templates. A distância local
  é `abs(trunc((target−cost)/1000))`, com truncamento antes do absoluto.
- G06/G07: elegibilidade e ranking anteriores ao desempate. A seleção
  determinística Taurifer só substitui candidatos equivalentes após esse ranking.
- G08/G11: produtores de exercício/numSets, domínio de membership, influência
  de experiência e consumidores de SimplePeriodization, ciclos e deload.
- G09: origem UI do mapa, coleções padrão e efeito integral da despriorização
  independente. O filtro local não justifica banir exercícios globalmente.

Os pacotes privados `round-robin/`, `doses/`, `time-allocation/` e `muscles/`
retêm fonte/hash, PC, bytes, comandos, resultados e limites. Novas conclusões
exigem a mesma ligação à fonte e revisão dos casos de fronteira. O suplemento
público permanece sanitizado e não distribui binários, assembly ou arquivos
pessoais. Nenhuma compatibilidade retroativa é exigida; isso não libera a engine
antes da validação das regras relevantes.
