# Implementação das regras de geração

A implementação `073.4` e sua revisão independente estão concluídas no
escopo recuperado de geração. O caminho anterior foi removido. O aceite do
Plano 073 exige o check `ci` verde no head final do
[PR #422](https://github.com/pedrochagasmaster/repforge/pull/422/checks).
Os Checks desse PR são a fonte canônica do resultado: passes de uma base
anterior não certificam alterações posteriores. Este documento registra
implementação e evidência; não antecipa a aprovação do head final.

## Domínio implementado

A única cadeia de geração é requisição canônica → candidatos recuperados →
alocação → distribuição → spillover → trocas → ordenação → prescrições.
Não há fallback para jobs, doses, redistribuição ou corte temporal do Plano 067.
O namespace inclui a versão do gerador e a identidade semântica do catálogo.
O desempate Taurifer usa preferência explícita e UUID em ordem ASCII dentro do
pool final recuperado. Não usa relógio, locale ou semente variável.

As 13 identidades e suas 17 variantes de frequência vêm de
`RepForgeGenerationLayout.SPLITS`. Full Body aceita de dois a seis dias; as
outras divisões mantêm suas frequências fixas. Os defaults são Full Body,
Upper/Lower/Full, Upper/Lower/Upper/Lower, Push/Pull/Legs/Upper/Lower e
Push/Pull/Legs/Push/Pull/Legs, respectivamente para dois a seis dias.
Uma escolha explícita incompatível produz conflito, sem troca silenciosa.

As três metas, três experiências, seis durações e quatro periodizações usam
os ramos recuperados. As opções 20/40/60/90/120/150 resolvem orçamentos internos
18/30/50/75/105/125. Esses orçamentos não são tetos de corte do resultado.
A alocação usa a fração regional própria de cada divisão, separadamente da
fração de compostos por objetivo. Os 22 músculos preservam prioridades e
desprioridades; exclusões continuam restrições duras distintas.

Cada bloco novo tem sete ciclos normais. Um deload opcional antes ou depois
acrescenta uma oitava posição, sem substituir um ciclo normal. A requisição
registra posições totais: `7/[]`, `8/[1]` ou `8/[8]`. A interface oferece o
deload final; o contrato também representa o inicial. O adapter recebe sete
ciclos normais e converte a opção para oito posições quando necessário.

O deload usa o primeiro ou último target normal, preserva o prefixo de
`max(1, floor(0.8 * N))` séries e arredonda cada limite de repetições por
`round(0.8 * limite)`. Acrescenta três ao RIR somente quando a métrica é
repetições ou repetições por lado. Mantém métricas ausentes, nulls e descanso
null, sem inventar carga. A prescrição admite RIR de zero a seis. Editores,
draft e o guard de progressão conservam esse valor; as fórmulas de carga,
capacidade, fadiga e progressão não mudaram.

## Políticas próprias do Taurifer

A colocação dos treinos no calendário semanal conserva a política do produto;
a recuperação estabelece a ordem dos treinos, não esses dias de calendário.
A edição manual do RIR de uma definição recuperada aplica a diferença sobre
os alvos de cada ciclo. Isso preserva o perfil por série e evita acrescentar
o ajuste de deload duas vezes. O fluxo manual conserva seu ajuste de dois. O custo considera descansos
explícitos nos intervalos entre séries; uma edição apenas de RIR conserva
o custo recuperado.

Uma confirmação pontual vale somente para aquele exercício e para um handler
conhecido da fonte. Não concede uma capacidade global, não supera uma resposta
negativa e não permite preconditions desconhecidas. As ofertas são provisórias:
o adapter regenera a requisição confirmada e confere a posição real antes de
mostrar a oferta. As substituições também passam pela elegibilidade da fonte.

Definições armazenadas são lidas pela sua estrutura explícita, mesmo quando
seu antigo ID de split já não é válido para nova geração nessa frequência.
O leitor não reinterpreta esses IDs. Receitas de outra versão são recusadas;
um draft de versão antiga exige Rebuild explícito. A engine antiga não é
embarcada para replay. Histórico e definições legíveis são preservados.

## Evidência e gates

As provas abaixo têm resultados observados em `fc079ad0` e `8740476e`.
Os logs dos jobs 11/14 e 5/14 de `8740476e` confirmam, respectivamente,
`generate-program-browser` completo (362,43 s) e `program-transition-commit`
(40,19 s). Isso confirma as jornadas corrigidas, sem declarar o `ci` agregado
ou o head final aprovados.
A aceitação das correções e das baselines versionadas pertence ao `ci` do
head final do PR, não a uma previsão desta tabela.

| Gate | Contratos e evidência efetiva |
| --- | --- |
| A01 | `generation-identity`, `program-generation-parity` e propriedades passaram no fast de fc079. `program-engine-worker` passou nas 17 variantes, worker e fallback. |
| A02 | Matriz/defaults/incompatibilidades passaram no fast; as 17 escolhas compatíveis foram renderizadas e selecionadas no navegador de fc079. A suíte de geração completa passou em 874, incluindo a opção mínima e os fluxos B posteriores. |
| A03 | `program-entry-s4` passou no navegador de fc079: Review, ativação, Focus, sessão salva, RIR 6 e reload. |
| A04 | Seis opções/orçamentos, alocação e custo fonte têm regras revisadas; `generation-duration20`, matriz e paridade passaram no fast de fc079. |
| A05 | Prioridades independentes, oito despriorizações e exclusões têm prova de fonte e contratos de adapter/entrada/paridade passados no fast de fc079. |
| A06 | Classificação, tiers, confirmações por exercício, negação explícita, requisito desconhecido e pool vazio passaram em candidatos/adapter/search no fast de fc079. A jornada de conflito de equipamento passou em 874, com explicação, não ativação, reload e retorno ao equipamento preservado. |
| A07 | 18 ramos de dose, quatro períodos, sete ciclos normais e deload adicional passaram nos testes de fronteira/matriz/periodização de fc079. RIR 6 atravessou salvar e reload no navegador. |
| A08 | `shared-setup-unit` passou: receita antiga recusada sem regeneração. Leitura estrutural legível passou no compiler; import-review, shared-setup-flow, draft-storage, backup e crash/review de transição passaram no navegador de fc079. A suíte completa de commit transacional passou em 874 após corrigir a ordem de preenchimento das métricas. |
| A09 | Fonte revisada para 13 construtores/17 variantes; matriz sanitizada passou no fast e worker nas 17 variantes. Seleção UI e persistência/reload do preview máximo passaram explicitamente em fc079. |
| A10 | Suplemento sanitizado, revisão independente da fonte e proveniência preservados. Auditoria documental distingue contratos históricos, política Taurifer e limites da recuperação. O gate final inclui a revisão das capturas oficiais e seus checks. |

| Gap | Fechamento técnico e gate de aceite |
| --- | --- |
| G01 | Identidade canônica e desempate total sem seed variável: A01/A10. |
| G02 | Defaults, compatibilidade e escolha explícita: A02. |
| G03/G04 | Roles, distribuição, sobras, trocas e ordem recuperadas: A03/A06/A09. |
| G05 | Opção, orçamento, alocação e custo separados; corte antigo removido: A04. |
| G06/G07 | Elegibilidade, classificação e ranking fonte com restrições duras: A01/A06. |
| G08/G11 | Séries, reps, RIR, metas, experiência, períodos e deload: A03/A07. |
| G09 | Prioridades/desprioridades independentes e exclusões distintas: A05. |
| G10 | Todas as 13 identidades e 17 frequências: A09. |
| G12 | Adapter, worker/fallback, Review, ativação, Focus e persistência: A01–A03. |
| G13 | Leitura explícita preservada, receitas incompatíveis recusadas e draft com Rebuild: A08. |
| G14 | Evidência sanitizada e documentação reconciliada sem reescrever história: A10. |

A matriz pública contém resultados do modelo de fonte independente do
compilador público. Não foi gerada a partir da saída da implementação.
Ela inclui as 17 variantes e os eixos de objetivo e orçamento de ULF.
Os testes de doses usam a fronteira pública de layout para alcançar séries e
métricas que uma única montagem real não contém. Isso complementa as jornadas
de produto; não substitui persistência e execução no navegador.

A recuperação usa bytes do ELF e metadados ligados aos objetos de compilação,
com revisão independente dos operadores, callbacks, construtores e bindings
numéricos. Não executou o gerador original ou a VM Dart completa. Os limites
SDK finitos estão explícitos nos recibos privados. Perfil fonte null,
sexo fonte null e mapas vazios de histórico/carga são inputs controlados.
As entradas reais de Godmode2 continuam desconhecidas; não há alegação de
paridade transacional desse export.

## Registro da integração e critério de aceite

A implementação foi publicada em `d7ae4b3e`, com correção de descanso em
`c3597bbc`. O candidato `9f14ebb0` passou os gates rápidos e de serviço; os
testes de navegador identificaram fixtures de geração nova com quatro ciclos
e uma transição que elevava silenciosamente pedidos abaixo de 20 minutos.
A correção recusa esses pedidos. Fixtures novos usam sete ciclos normais, e as
jornadas por lado fazem sua escolha explícita pelo Review de produção.
A revisão independente fechou os findings de classificação, custo e essas
correções. A CI completa da base não certifica este candidato.
Em `fc079ad0`, a CI confirmou as 17 escolhas na interface, equivalência do
worker nas 17 variantes, persistência e reload do preview máximo e RIR 6 até
salvar o treino. A suíte de geração ainda encontrou uma expectativa antiga de
impossibilidade para dois dias e 20 minutos. Essa opção usa orçamento 18 e é
válida; a jornada foi corrigida para provar Review sem ativação. O teste de
transição também passou a preencher carga e repetições pela semântica da métrica.

Os seis artefatos oficiais desse head contêm 95 pares de imagens e 86 mudanças
semânticas revisados. Foram incorporadas 92 imagens e todas as 86 entradas
semânticas; três imagens do seletor de periodização foram preservadas para nova
captura. A revisão encontrou descrições antigas de variação fixa de duas reps e
teto de recuperação em RIR 4. Os textos em inglês e português agora descrevem
as faixas variáveis e o teto 6, sem alterar as fórmulas.

Em `8740476e`, `generate-program-browser` e `program-transition-commit`
passaram por inteiro nos jobs 11/14 e 5/14. A primeira executou também as
jornadas B posteriores à opção mínima: navegação, unidades, retomada,
construção com worker e fallback, reduced motion e conflito de equipamento.
Esses passes individuais não são o resultado agregado da CI.

A [CI de `8740476e`](https://github.com/pedrochagasmaster/repforge/actions/runs/38889209044)
produziu quatro diferenças de PNG e nenhuma diferença semântica nos artefatos
`12041749357`, `12041897893` e `12042491968`. As quatro imagens foram revisadas
e incorporadas: o seletor de periodização em inglês claro/escuro e português,
e a explicação de carga por lado em inglês escuro. A última é idêntica em bytes
à variante clara já revisada em `fc079ad0`. Os arquivos vieram das capturas
oficiais desse head limpo, com SHA-256 dos ZIPs conferido contra os digests
oficiais e CRC dos membros extraídos validado. Não houve captura local nem
edição manual de PNGs.

As baselines de capturas oficiais e a documentação integram o
mesmo gate do produto. O aceite ocorre quando `ci` estiver verde no head final
do PR #422, com revisão independente e visual do conjunto entregue. Consultar
os [Checks do PR](https://github.com/pedrochagasmaster/repforge/pull/422/checks)
para o resultado efetivo; nenhum pass de uma base anterior o substitui.
A conclusão não é declarada antes desse critério ser satisfeito.
