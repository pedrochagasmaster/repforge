# Ampliação controlada de Upper/Lower/Full

Este contrato delimita as próximas fatias de S3. Os gates de fonte abaixo foram
revisados independentemente; a implementação e a aceitação no produto permanecem
separadas. S2 está no PR 422, com a validação completa delegada à CI por decisão
do owner. Não executar outra captura local exaustiva.

As fatias preservam três dias, sete ciclos normais, nenhum deload, perfil fonte
null, história vazia e configuração de cargas vazia. Preservam também os filtros
obrigatórios Taurifer e o desempate determinístico dentro do pool recuperado.
Não alteram as fórmulas de carga, progressão ou fadiga.

## Domínios de implementação

| Fatia | Objetivo | Experiência | Opção de duração | Orçamento | Periodização |
| --- | --- | --- | --- | --- | --- |
| S2 preservada | hybrid | advanced | 60 | 50 | static |
| S3 duração | hybrid | advanced | 40 | 30 | static |
| S3 objetivo | hypertrophy | advanced | 60 | 50 | static |
| S3 força | strength | advanced | 60 | 50 | static |
| S3 experiência | hybrid | beginner, intermediate | 60 | 50 | static |
| S3 períodos | hybrid | advanced | 60 | 50 | linear, reverse_linear, undulating |

Essa tabela define uma união de domínios, não seu produto cartesiano. Por
exemplo, hypertrophy/40 e linear/40 continuam pendentes. O compilador e a
disponibilidade da divisão na entrada devem aplicar a mesma fronteira.
Requisições explícitas fora dela são recusadas; uma edição recusada preserva o
programa revisado e o draft.

## Duração e objetivo

A opção 40 representa a faixa 20–40 e resolve orçamento de 30 minutos. Não
reintroduzir o corte temporal antigo nem usar a estimativa como teto obrigatório.
A prova de alocação distingue o desempate posterior dos compostos do desempate
inicial dos acessórios. O caso controlado alcança primários de uma série em
verticalPush e verticalPull, com ajustes de RIR distintos. Contagens obtidas com
seletores sintéticos continuam condicionais, sem virar invariantes do programa.

Hypertrophy altera a classificação dos primários e os tiers consultados, além
dos alvos. Uma implementação que somente muda as repetições não satisfaz essa
fatia. As provas devem distinguir essas duas falhas com o catálogo controlado.

Strength também altera os tiers, as três famílias de classificação e os grupos
padrão de músculos. A alocação regional reserva 60% aos compostos, preservando
a partição upper/lower. Os grupos específicos de Strength devem participar
tanto da produção como da ordenação final, inclusive após spillover e trocas.
A prova por dia distingue a ordem A,B,A incorreta da ordem A,A,B recuperada.

## Experiência

Beginner e Intermediate são aceitos apenas em Hybrid/60/Static. Na chamada
direta controlada do gerador recuperado, experiência é metadado e conserva a
montagem, as métricas e os alvos de Advanced. As identidades Taurifer continuam
distintas porque a requisição contém a experiência. Essa evidência não confirma
os defaults nem a disponibilidade do formulário original. O valor fonte none
não vira Beginner, e experiência não concede equipamentos ou capacidades.

A comparação remove somente IDs gerados de dias, slots e séries. IDs de métricas
são semânticos e permanecem na comparação.

## Períodos

Os índices recuperados selecionam uma tabela de sete doses. Não são diretamente
os números dos ciclos nem uma interpolação inventada a partir do nome do modo.

| Modo | Índices da tabela nos sete ciclos normais |
| --- | --- |
| linear | 6, 6, 4, 3, 2, 0, 0 |
| reverse_linear | 0, 0, 2, 3, 4, 6, 6 |
| undulating | 6, 3, 0, 6, 2, 4, 0 |

Cada posição produz seu próprio alvo, inclusive quando repete o índice anterior.
O consumidor preserva a ordem e a identidade das sete posições. A série mantém
seu ajuste de RIR em todos os ciclos; o centro de repetições muda conforme a
tabela. Métricas sem reps/repsPerSide continuam sem alvo de reps e com RIR null.
As provas devem derivar a presença dessas métricas dos UUIDs do catálogo fonte,
sem usar a presença do próprio alvo gerado como oracle.

O gate de fonte inclui os bindings das coleções e o consumidor Periodized sob
contratos SDK explícitos. Isso não é execução da VM original. A aceitação no
Taurifer exige preservar os alvos na definição, worker, review, ativação, Focus e
reload. Os exercícios e números de séries permanecem os da montagem controlada.

## Versão e evidência

O lote que ampliar os domínios recebe nova versão do gerador. A identidade inclui
essa versão; receitas anteriores não são regeneradas por um adaptador de
compatibilidade. Definições completas legíveis continuam legíveis, e rascunhos
incompatíveis exigem Rebuild explícito.

As provas algorítmicas falham antes da implementação e cobrem os limites novos.
Rodar localmente apenas as provas puras que pertencem à alteração. As jornadas
reais e o catálogo visual completo são executados na CI do head publicado.
Resultados de integração ainda não executados não podem ser declarados verdes.

Deload continua bloqueado. A fonte preserva sete ciclos normais e acrescenta uma
posição sentinela; isso não equivale a substituir o sétimo ciclo. Arredondamento,
seleção de extremos e contexto de algumas transformações de dose ainda precisam
de prova antes de definir seu mapeamento no Taurifer.
