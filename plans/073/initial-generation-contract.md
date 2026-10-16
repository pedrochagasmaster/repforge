# Primeira implementação das regras recuperadas

O gate de pesquisa está fechado para a primeira implementação parametrizada:
Upper/Lower/Full, três dias, objetivo both, Advanced, faixa 40–60 com orçamento
interno de 50 minutos, Static, sete ciclos normais e sem deload. Isso autoriza S2;
não comprova a aplicação nem confirma as entradas efetivas de Godmode2.

As revisões privadas de ordenação, distribuição, ranking, elegibilidade,
histórico e experiência não encontraram bloqueadores nesse domínio. A auditoria
[de regras](rule-recovery-status.md) distingue os componentes e suas evidências.
Operações comuns das coleções tipadas do SDK identificado são contratos explícitos.
Não é necessário executar ou reimplementar toda a VM para implementar as regras.

## Entradas e limites

Preservar a requisição existente como fronteira de produto. Os seis valores de
`timeCeilingMinutes` identificam opções da interface; no caminho novo, 60 significa
a faixa 40–60 e resolve orçamento 50. Não executar o corte temporal antigo nesse
caminho. Opção, orçamento e estimativa permanecem separados.

Prioridades e desprioridades aceitam os 22 músculos recuperados por UUID. São
conjuntos independentes e contraditórios são recusados. O desempate próprio usa
preferência explícita dentro do pool final equivalente e, depois, UUID em ordem
ASCII. Não altera tiers, batches ou níveis recuperados.
Os grupos de score são formados antes de remover exercícios já escolhidos.
Um grupo esvaziado conserva sua posição nos batches de dois. Removê-lo pode
adiantar um tier inferior e mudar a escolha.

O perfil inicial fixa somente o domínio recuperado: warmup smart, overrides de
descanso null e sexo fonte null, cujo ramo usa male. Não ler Basics.sex. A história
vazia e o mapa vazio de configuração de equipamentos são entradas controladas
desse primeiro domínio, não confirmação de defaults ou do perfil observado.
Não incorporar histórico pessoal em receita ou compartilhamento. A política
bumper é null, resolvida pelos equipamentos explícitos e pelo fallback validado.
Overrides de carga fora desse domínio recebem resultado não suportado.

Aplicar os 62 handlers de capacidade e o fallback estrito recuperado. Em seguida,
conjugar as exclusões e confirmações obrigatórias Taurifer. Confirmação pontual
não concede assessment global e não contorna rejeição da fonte; false explícito
continua sendo veto Taurifer. Não introduzir exceção para os 81 exercícios com
preconditions não vazios fora dos handlers. Não aplicar alwaysShow como bypass.

## Donos e interface interna

O compilador continua a única fronteira que produz ProgramDefinition. Dois
módulos puros ocultam as regras recuperadas; não são engines alternativas nem
aplicam política antiga em partes do programa novo.

`generation-candidates.js` expõe `RepForgeGenerationCandidates.create(catalog,
request, hardAllowed)`. O último argumento é o predicado obrigatório Taurifer
sobre a linha original. O retorno tem:

- `choose(spec, selected)`: exercício resolvido ou null. `spec` tem `type`
  primary/secondary/accessory e pattern ou muscle; compostos recebem também
  `isFirstOfType`. `selected` é a lista corrente de templates.
- `priorities` e `depriorities`: enums internos de músculos em ordem da entrada
  canônica por UUID, sem tradução.
- `muscleId(sourceName)`: UUID do músculo resolvido, ou undefined para um nome
  fora dos 22 enums. O compilador não duplica esse mapeamento.

Um exercício resolvido contém `id`, `raw`, `patterns`, `region`, `effectiveRegion`,
`exerciseType`, `primaryJointActions` e `exclusionGroupings`. `raw` é a linha do
catálogo; os demais campos usam os enums recuperados. Cada UUID tem um objeto
resolvido único. Não confundir igualdade de Exercise com igualdade do template.

`generation-layout.js` expõe `RepForgeGenerationLayout.generate(request, selector)`.
O retorno contém `days`, `weeklySlots`, `budgetMinutes`, `allocations` e
`estimatedSessionSeconds`. Cada dia tem `name` e `templates`. Cada template tem
`exercise`, `numSets`, `type` e `accessoryMuscle`, null nos compostos. A lista
`selected` muda entre escolhas, inclusive dentro de addAll: materializar todos
os candidatos antes de acrescentá-los muda a regra de alternância.

Layout resolve alocações, seis padrões compostos, músculos acessórios, distribuição,
spillover, swaps e ordem final. O compilador cria IDs, métricas e alvos Static
recuperados e valida a definição. Conservar as regras de null/insuficiência;
não fabricar exercícios para recuperar a contagem observada 18/45. Conflitos
impedem ativação; uma geração com falhas não é promovida a sucesso parcial.

O coordenador integra os módulos, identidade, worker/fallback, receitas, revisão,
ativação, versões e cache. Um agente cuida de candidatos, outro de layout e outro
da entrada. Somente o coordenador faz commits e push. Não editar arquivos de
outro dono nem executar browsers em paralelo no mesmo worktree.

## Primeira prova

A prova real já falha no SHA `2e86845c`: apenas cinco das oito despriorizações
ficam no formulário. O recibo e a captura são privados. A aceitação exige as oito
escolhas no request, worker e compilador, definição Upper/Lower/Full validada,
review, ativação, Focus e reload. Identidade, operadores e limites combinatórios
recebem provas puras escritas antes da implementação; comportamento do produto
é provado pelo navegador real. As configurações ainda não substituídas conservam
a política vigente, sem alegação de paridade recuperada.
