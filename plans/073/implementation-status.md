# Implementação S2 e ampliação inicial de S3

O gerador `073.1` preserva o [domínio inicial validado](initial-generation-contract.md)
e implementa a [união delimitada de S3](three-day-expansion-contract.md).
O Plano 073 permanece em andamento. S3, S4 e S5 não estão concluídas, e as entradas
reais usadas para gerar Godmode2 continuam sem confirmação transacional.

## Comportamento implementado

O compilador canonicaliza o request e usa uma identidade SHA-256 que inclui a
versão do gerador e o conteúdo semântico do catálogo. `generatedAt`, a ordem dos
exercícios e a ordem das chaves não alteram essa identidade. Arrays semânticos
permanecem ordenados; conjuntos declarados são deduplicados e ordenados por UUID.
Entradas desconhecidas ou contraditórias são recusadas.

O caminho Upper/Lower/Full usa seleção, elegibilidade, distribuição, orçamento e
alvos recuperados. Não aplica o corte temporal antigo. A opção 60 continua sendo
a faixa 40–60 da interface e resolve orçamento interno de 50 minutos. Estimativas
podem ultrapassar esse orçamento conforme a regra recuperada. O descanso de cada
set permanece null porque esse produtor não define override.

A seleção forma grupos de score antes de remover exercícios já escolhidos.
Grupos esvaziados conservam suas posições nos batches de dois. A prova de três
scores distingue essa regra da remoção antecipada, que escolhia outro exercício.

Os IDs compartilham o namespace SHA-256 completo da geração. Cada caminho recebe
um digest SHA-256 abreviado a oito hexadecimais, com mapa local de caminhos e
resolução determinística de colisões. A unicidade dentro da geração não depende
da ausência de colisões do digest abreviado. Isso mantém os IDs dentro de 96
caracteres e permite compartilhar definições completas sem repetir hashes
independentes de alta entropia. Nomes de dias continuam limitados a 80 caracteres.

Formulário, adapter, cache, worker, fallback, receitas e reconstrução usam a mesma
requisição canônica, sem seed variável. As 22 opções musculares não são truncadas.
Uma receita de versão anterior é recusada antes de executar o gerador. Mudança
semântica do catálogo retorna `catalog-mismatch`; metadados e ordem incidental
não invalidam uma receita. Definições legíveis continuam legíveis.

Uma edição de um programa recuperado não pode trocar silenciosamente para a
política anterior ao sair do domínio validado. A recusa preserva o programa
revisado e o draft. Um rascunho de outra versão aguarda Rebuild explícito antes
de gerar uma nova baseline. Configurações novas ainda não substituídas conservam
a política vigente, sem alegação de paridade recuperada.

## Ampliação inicial de S3

A mesma geração recuperada aceita agora Hybrid/Advanced na opção 40, com
orçamento 30 e Static, Hypertrophy/Advanced na opção 60 com Static, e os três
modos periodizados em Hybrid/Advanced na opção 60. Todos conservam três dias,
sete ciclos normais e ausência de deload. Isso não libera o produto cartesiano
entre essas opções. Deload, outras experiências, outros orçamentos e divisões
continuam pendentes.

As provas RED privadas precederam cada implementação isolada. Após compor os
patches, as quatro suítes de candidatos, layout, paridade e periodização passaram
localmente. A última cobre 324 combinações controladas de role, pull, séries e
métricas, além dos três modos no catálogo real. A revisão independente aceitou
a união dos gates e a preservação das recusas. As jornadas de duração 40,
Hypertrophy 60 e edição dos três modos foram preparadas para a CI, sem execução
local. Não repetir a captura exaustiva na devbox; revisar as diferenças visuais
pelos artefatos remotos.

## Provas e pendências

As provas puras foram escritas antes das respectivas implementações. Os testes
cobrem falhas de identidade e operadores que o navegador não pode produzir de
forma controlada, incluindo colisões de digest, limites combinatórios e somas
numéricas. O navegador usa os produtores e consumidores reais.

| Contrato | Prova reproduzível | Estado local |
| --- | --- | --- |
| Canonicalização, SHA-256, mutabilidade e colisões | `node test/generation-identity.mjs` | Passou |
| Elegibilidade, tiers, equipamentos e alternância | `node test/generation-candidates.mjs` | Passou |
| Alocação, distribuição, custo e ordenação | `node test/generation-layout.mjs` | Passou |
| Domínios recuperados, sete ciclos, IDs e recusas | `node test/program-generation-parity.mjs` | Passou |
| Períodos, centros, RIR, métricas null e posições repetidas | `node test/generation-periodization.mjs` | Passou, 324 combinações controladas e três modos no catálogo real |
| Entrada, oito despriorizações e limites | `node --test test/program-entry.mjs test/program-entry-inputs.mjs test/program-entry-production-adapter.mjs` | Passou |
| Catálogo verificado e imutável | `node test/exercise-catalog.mjs` | Passou |
| Receita atual, recusa de versão e catálogo, full share | `node test/shared-setup-unit.mjs` | Passou |
| Propriedades gerativas do compilador | `node test/generative/run.mjs --profile smoke --filter "program compiler" --seed 2895473493` | Passou |
| Configurações anteriores e contratos de transição | `node test/program-compiler-plan067.mjs`; `node test/program-compiler-search.mjs`; `node test/program-transition-plan067.mjs` | Passou |
| Formulário → worker/fallback → review → ativação → Focus → reload; edição não suportada e versão antiga | `node tools/run-tests.mjs entry --suite-id test-generate-program-browser-mjs` | Passou em 073.0, 203 verificações; ampliação 073.1 aguarda CI |
| Worker, cancelamento e fallback | `node tools/run-tests.mjs entry --suite-id test-program-engine-worker-mjs` | Passou em 073.0, 46 verificações; head atual aguarda CI |
| Confirmação, anúncio exato, respostas antigas e rebuild do bloco | `node tools/run-tests.mjs entry --suite-id test-program-entry-s4-mjs` | Passou |
| Compartilhamento real e receitas | `node tools/run-tests.mjs entry --suite-id test-shared-setup-flow-mjs` | Passou, 184 verificações |
| Catálogo visual completo | Inventário remoto de captura e comparação | Delegado à CI por decisão do owner; sem gate local exaustivo |
| Head limpo e regressão remota | [PR 422](https://github.com/pedrochagasmaster/repforge/pull/422) | Gate obrigatório; resultados por SHA registrados no PR |

Os resultados locais acima foram obtidos durante a integração. A evidência de
conclusão deve registrar o SHA limpo, a revisão independente e o resultado de
`ci` nesse mesmo head. O PR 422 mantém esse registro por commit. Não declarar o plano completo com base nessa primeira fatia.

| Finding | Correção e prova |
| --- | --- |
| S2-LOW-01 | URL de `program-transition.js` alinhada ao precache `459`; inventário de release 33/33 e alinhamento conservado após a suíte do worker. |
| S2-LOW-02 | Repetidos eram removidos antes de formar grupos de score. Prova pública de três grupos falhou com `c` em vez de `a`; remoção dentro de cada grupo passou para compostos e acessórios. Fonte e correção receberam revisão independente. |
| S2-LOW-03 | Observer visual usava seed e IDs de slots de outro namespace. Agora separa identidade do request e posse do draft, e correlaciona posições. Os 89 frames focados passaram sem retries; a validação visual completa foi delegada à CI pelo owner. |
| S2-LOW-04 | Anúncio após confirmação incluía dois nomes que não mudaram. A prova real falhou antes da correção por posições; a mesma suíte passou após a correção, incluindo foco e descarte de respostas antigas. |
| S2-LOW-05 | A fixture de conflito podia fotografar antes de montar o Review ou fora do aviso. A espera exige as linhas da definição atual; o enquadramento exige o aviso completo no viewport. Os três variants focados passaram. |
| S2-LOW-06 | A CI encontrou dois loaders VM sem os módulos novos, inventário de sintaxe incompleto e vocabulário de telemetria sem ULF. Os loaders seguem a ordem real, o inventário inclui os três módulos e o enum fechado aceita ULF. As quatro provas exatas passaram; cache 462. |

A primeira captura completa foi interrompida após 141 frames para corrigir os
findings. Depois das correções, 89 frames focados passaram sem retries. A nova
execução foi interrompida após 340/1.110 frames, por decisão do owner de priorizar
a implementação e reduzir o uso da devbox. Os diretórios originais, o preview
e o processo pausado foram restaurados, com os hashes de fonte intactos.
A validação completa fica na CI. As imagens atualizadas vêm exclusivamente da
ferramenta oficial; o restante do catálogo conserva a baseline até essa prova.
