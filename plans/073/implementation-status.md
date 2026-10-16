# Implementação das regras de geração

O candidato `073.4` integra S3 e S4 e remove o caminho de geração anterior.
A conclusão do Plano 073 ainda depende da CI no head final e da revisão dos
artefatos visuais remotos. A revisão independente dos consumidores foi concluída;
as correções posteriores também recebem revisão antes da publicação.
O commit anterior `f4a3fda5` passou a CI completa, incluindo os 14
shards de navegador. Esse resultado não certifica as alterações posteriores.

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

| Contrato | Evidência | Estado do candidato |
| --- | --- | --- |
| S0, corpus permitido e coordenadas | `plans/073/verify.py`, `test_verify.py` | Suplemento original preservado |
| Identidade, catálogo, colisões | `test/generation-identity.mjs` | Prova existente; CI do head final obrigatória |
| Candidatos e restrições | `test/generation-candidates.mjs`, jornadas de confirmação | RED/GREEN pontual da confirmação; regressão na CI |
| 13 divisões, 17 frequências e novos orçamentos | `test/generation-source-matrix.mjs`, fixture sanitizada | RED contra f4a; GREEN local de uma montagem; matriz completa na CI |
| 18 ramos de dose, períodos e deload | `test/generation-source-dose-boundaries.mjs` | RED privado anterior à implementação; GREEN local de um limite; matriz na CI |
| Formulário e escolhas explícitas | adapter, `test/generate-program-browser.mjs` | Jornadas preparadas; execução na CI |
| Worker e fallback | `test/program-engine-worker.mjs` | Comparação real no gate remoto |
| Review, ativação, Focus, salvar e reload | `test/program-entry-s4.mjs` | Jornada atualizada; execução na CI |
| Dados e versões | leitor de definição, receita e retomada de draft | Revisão independente; prova real na CI |
| Visuais | captura oficial remota e comparação | 95 pares revisados em fc079; 92 incorporados, três aguardam nova captura após correção de texto |
| Conclusão | revisão independente e `ci` verde no head final | Pendente |

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

## Próximos passos exatos

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

A nova CI deve confirmar as duas jornadas corrigidas e produzir as capturas
desses textos. Revisar as diferenças remanescentes, obter `ci` verde no head
final e reconciliar A01–A10 antes de encerrar o plano.
