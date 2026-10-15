# Estado da recuperação de G03, G04 e G08

Auditoria de leitura em 15/10/2026. S2 permanece bloqueada. Esta auditoria não
executou extratores, Blutter, o aplicativo original ou novos testes. Não alterou
a engine. Os anchors abaixo foram conferidos nos arquivos ASM já preservados.

## Fontes e classificação

O contrato é `docs/generator-rule-parity-spec.md`, decisões D01–D11, e o gate
de S1 em `plans/073-generator-rule-parity.md`. O corpus privado é
`rea-investigation-20261014/continuation-20261015-split-contract/`, sobretudo
`DELTA_REPORT.md`, `calls-and-pool.json`, `distribute.asm.txt`,
`round_robin.asm.txt`, `spillover.asm.txt`, `fits.asm.txt`, `score.asm.txt`,
`dose_targets.asm.txt`, `allocation_helpers.asm.txt` e `local_assembly.asm.txt`.
`godmode2-20261015/DELTA_REPORT.md` distingue entradas fotografadas, estado
exportado e associação entre os dois.

O relatório privado identifica `libapp.so` pelo SHA-256
`a79f5db63bb7dffdd683fae131fe033deabaef20d14d6ce4e5d4a6debb3f1312`.
Esta auditoria leu essa identidade, mas não recalculou o hash do binário.

"Observado" abaixo significa instrução ou anotação tipada presente no corpus.
"Decodificado" exige convenções Dart de tag, Smi, ponteiros comprimidos,
argumentos e stubs. Resolver chamadas indiretas continua sendo uma dependência,
mesmo quando a interpretação do operador é provável. Nenhuma linha representa
execução do Dart original ou uma nova prova de paridade.

## Mapa de regras e dependências

| Gap e PC | Evidência | Interpretação e limite |
| --- | --- | --- |
| G03, `0xecf7e8..0xecfaf4` | O relatório registra Upper, Lower e Full nessa ordem, com listas ordenadas nos campos `+0x0c`, `+0x10` e `+0x14`. | Estrutura decodificada com os pressupostos registrados pelo extrator anterior. Os campos adicionais permanecem sem semântica integral. Roles não são uma contagem fixa de exercícios. |
| G03/G04, `0xed8f24..0xed8f4c` | `fits` lê `SplitDay+0x0c` e passa callback `0xed81ac` ao operador `0x807bc0`. | O corpus anterior decodifica o operador como `any`. O callback fixa o tipo `accessory`; o predicado de compatibilidade ainda depende de `0xed8210`. |
| G04, `0xede88c..0xede8a4` | `distributeTemplates` passa o tipo do registro a `0xed8210`. | Não equivale ao uso de `accessory` fixo em `fits`. Política de seleção de dia e insuficiência ainda incompleta. |
| G04, `0xedd5e8..0xedd658`, `0xedd6bc..0xedd810` | `roundRobin` mapeia `_listLength`. O auxiliar compara inteiros e preserva o acumulador quando o próximo é menor ou igual em `0xedd7c0..0xedd7cc`. Retorna null no caminho vazio em `0xedd7f4`; o chamador converte null em zero. | Redução pelo máximo dos comprimentos é uma decodificação forte, condicionada à resolução dos slots iterator, moveNext e current. Ainda não prova emissão, ordem ou tratamento de listas desiguais. |
| G04, `0xed8f64..0xed90c4` | `score` prepara pares e duas agregações antes de criar um record de dois campos. | Os callbacks `0xed95d4`, `0xed94e8`, `0xed9420`, `0xed90d0` e operadores precisam de auditoria. Tipos e nomes do record não bastam para declarar equivalência, peso ou precedência dos contadores. |
| G04, `0xeddc98..0xeddd20` | `spillover` multiplica um operando por 1,25, passa por chamada nativa e conversão numérica e compara com outro operando antes de gerar candidatos. | Origem e unidade dos operandos e função da chamada nativa permanecem abertas. Não está provada uma regra de tolerância temporal de 25% por dia. |
| G08, `0xedc09c..0xedc11c` | Comparação explícita com `ProgramPeriodization.static` seleciona o ramo que prepara uma lista de `ExerciseTargetSet` com callback `0xedc6dc`. | O tamanho vem de um campo de registro. Falta fechar sua origem e o vínculo com `numSets`. |
| G08, `0xedc6dc..0xedc938` | O callback cria `ExerciseTargetLog` e `ExerciseTargetSet` padrão. O descriptor de `0xedc904` nomeia `minFullReps`, `maxFullReps` e `rir`. Há caminhos `base−1`, `base+1` e `max(0, base + lista[índice])`. | São operações observadas com ligação decodificada aos argumentos. Falta identificar a origem de base e lista e o predicado sobre `Exercise+0x54`. Não chamar esse predicado de capacidade de prescrever repetições sem evidência. |
| Dependência de G08/G05, `0xee2508..0xee2548` | Subtração, divisão inteira por 1000 e depois absoluto. | A expressão é `abs(trunc((A−B)/1000))`. Não trocar a ordem das operações. Os operandos dependem de `0xeda0d0`, `0xeda420`, `0xeda4b8` e `0xa53bf8`; custo e seleção de alocação continuam incompletos. |

O Godmode2 observa 18 exercícios e 45 séries e exporta somente Cycle 1.
A comparação com o GodMode antigo confirma doses iguais em 17 posições
correspondentes. Isso não controla o questionário antigo, a aleatoriedade,
o estado de geração ou possíveis edições. Nenhuma dessas contagens é uma
invariante recuperada; sete ciclos declarados não demonstram sete ciclos.

## Gate exato de S2

O Plano 073 exige todas as regras necessárias de G02–G09 e G11 para o domínio
inicial, recuperadas e validadas. O domínio de pesquisa é três dias, both,
Advanced, Static, faixa 40–60, sem deload, zero priorizados e oito despriorizados,
com as limitações de associação e estado exportado descritas no Godmode2.

Os bloqueios auditados são os seguintes:

- G03: consumidores e política dos campos `SplitDay+0x10` e `+0x14`.
- G04: compatibilidade integral, seleção e ordem dos dias, score, emissão de
  roundRobin, insuficiência e aceitação de spillover.
- G08: origem e domínio de sets, reps e RIR, predicado do exercício e regras
  por ciclo, role e posição.

Fechar esses três não encerra S1. Permanecem necessários G05, alocação e modelo
temporal; G06, filtros; G07, ranking anterior ao desempate; G09, efeito e domínio
da despriorização isolada; e G11, efeitos de experiência, objetivo, Static e
ausência de deload no domínio inicial. A conversão temporal e a seleção automática
de split já recuperadas não substituem essas dependências.

O desempate Taurifer pode substituir a escolha pseudoaleatória somente após
elegibilidade e ranking recuperados. Determinismo exige entradas canônicas,
versão e catálogo. Não há obrigação de compatibilidade retroativa nem autorização
para alterar a engine antes de validar a evidência relevante.

## Próximas janelas limitadas

Nenhuma das extrações abaixo foi executada nesta auditoria. O piso documentado
é 4 GiB livres; o contexto recebido informa aproximadamente 2,4 GiB. A próxima
execução depende de resolver espaço sem apagar evidências ou trabalho ativo.

1. Fechar roundRobin com `0xedd814..0xedd980` e uma janela inicial
   `0xa4a3c0..0xa4a600`. Resolver os slots de iteração usados no auxiliar e os
   operadores chamados em `0xedd664` e `0xedd698`. A janela de helper é um limite
   inicial, não uma fronteira de função comprovada. Casos simbólicos independentes
   são `[]`, `[[]]`, comprimentos `[1,3,0]`, `[3,1]` e empates. A prova precisa
   verificar emissão, ordem, perdas e duplicações.
2. Fechar o callback de doses na janela existente `0xedc6dc..0xedc948`.
   Extrair somente as dependências `0xa5f278` e `0x7a4e3c`, com teto inicial de
   `0x200` bytes por função. Rastrear os produtores de contexto já preservados em
   `0xedb328..0xedc09c`. Separar tabela por objetivo/tipo, experiência, base e
   ajuste por índice. Ampliar uma janela apenas quando o fluxo exigir e registrar
   a fronteira real de retorno.
3. Seguir o callback de spillover `0x12a44f4` com teto inicial de `0x400` bytes,
   ampliado somente após inspeção. Registrar cada consumidor dos campos adicionais
   de SplitDay antes de propor nomes. Resolver a chamada nativa no caminho de
   1,25 antes de afirmar arredondamento ou política de aceitação.

Cada recuperação precisa registrar fonte/hash, PC, bytes, domínio, pressupostos,
dependências e casos de fronteira. A avaliação simbólica deve rejeitar instruções
fora do subconjunto auditado. O export Godmode2 é uma conferência observacional,
não um alvo para escolher fórmulas ou preferidos que reproduzam 18/45.
