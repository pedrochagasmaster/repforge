# Spec: fechamento dos gaps de geração

**Contrato aprovado pelo proprietário em 15 de outubro de 2026**, após grilling
Q1–Q12 e confirmação do entendimento consolidado. A implementação atual e os
gates pendentes estão no [estado do Plano 073](../plans/073/implementation-status.md).
Base de código examinada:
`d0242c4679ba6a00cea6fd48f42450f3b6e93322`, gerador `067.2`, schema 2.

Documento de comportamento e aceitação. A sequência executável está no
[Plano 073](../plans/073-generator-rule-parity.md). A prioridade permanece no
[backlog](backlog.md). Esta spec é acompanhada pela [issue #421](https://github.com/pedrochagasmaster/repforge/issues/421),
conforme a [convenção do tracker](agents/issue-tracker.md).

## 1. Problema e resultado esperado

Na base examinada, o gerador redistribuía tarefas de programas observados de quatro
dias. Para três dias, escolhe Full Body. A investigação do MacroFactor recuperou
uma decisão diferente: sem preferência explícita, três dias selecionam
Upper/Lower/Full. Também recuperou listas de roles por dia e a conversão das
faixas de duração em orçamentos internos. Seleção, distribuição e dosagem ainda
têm trechos desconhecidos.

O resultado esperado é um gerador local e determinístico que reproduza as regras
recuperadas de estrutura, elegibilidade, distribuição e prescrição. Onde o
MacroFactor escolhe aleatoriamente entre candidatos equivalentes, Taurifer usa
um desempate estável próprio. Coincidir com um treino sorteado não é o objetivo.

A abrangência final inclui as divisões identificadas e as configurações de
objetivo, experiência, duração, equipamentos, prioridades, periodização e
deload suportadas pelo fluxo de geração. A primeira entrega funcional é
Upper/Lower/Full de três dias. O restante entra por etapas com evidência própria.

Este trabalho inclui séries, repetições e RIR prescritos na criação do programa.
Não inclui recuperar ou substituir fórmulas de progressão de carga, capacidade,
fadiga ou interpretação de desempenho. Os consumidores atuais dessas prescrições
precisam continuar funcionando, mas não se declara paridade de progressão.

## 2. Autoridade e decisões

| ID | Decisão aprovada | Origem |
| --- | --- | --- |
| D01 | Mesmas entradas canônicas, versão e catálogo produzem o mesmo programa; não há semente variável oculta. | Q1, Q3 |
| D02 | Paridade das regras recuperadas; desempate determinístico próprio entre candidatos equivalentes. | Q4 |
| D03 | Spec abrangente, implementação por etapas, começando em Upper/Lower/Full de três dias. | Q2 |
| D04 | Regra desconhecida bloqueia a mudança dependente; cada etapa validada pode ser liberada separadamente. | Q5 |
| D05 | Sem obrigação de compatibilidade retroativa em formatos, links ou engines. | Q6 |
| D06 | Oferecer as divisões identificadas compatíveis com a frequência e a opção Sem preferência, após validação. | Q7 |
| D07 | Tempo é orçamento de geração, separado da estimativa final; nenhum corte arbitrário para satisfazer um teto. | Q8 |
| D08 | Priorização e despriorização independentes, sem limite próprio de cinco ou truncamento silencioso. | Q9 |
| D09 | Preservar dados ainda legíveis; redefinição de dados incompatíveis exige ação explícita. Sem migrações obrigatórias. | Q10 |
| D10 | Restrições obrigatórias não são relaxadas. Preferências só cedem segundo política definida e validada. | Q11 |
| D11 | Um gap exige regra recuperada, casos reproduzíveis de condições/limites e prova no fluxo real. | Q12 |

Estas decisões substituem, para esta evolução da geração, os defaults escolhidos
e a autorização genérica para novas aproximações do Plano 067. Não alteram a
proveniência dos resultados históricos nem suas regras de progressão fora deste
escopo. Contratos de seed, limite de músculos e reconstrução dos Planos 070/072
devem ser reconciliados quando a implementação alcançar seus consumidores.

Nenhuma nova aproximação pode ser usada para marcar um gap como fechado.
O comportamento vigente permanece nas configurações ainda não substituídas;
isso não o transforma em comportamento validado do MacroFactor.

## 3. Contratos observáveis

### R01. Identidade determinística

Definir uma única requisição canônica com todos os dados que influenciam a
geração: respostas, frequência, preferência de divisão, faixa de tempo,
equipamentos, prioridades, exclusões, preferências de exercícios, confirmações,
contexto de execução e configuração do bloco. Dados não usados não entram
silenciosamente na decisão. Qualquer novo dado influente precisa tornar-se
entrada explícita e versionada.

Listas semanticamente não ordenadas são deduplicadas e ordenadas por identidade
estável. Listas cuja ordem tem significado preservam essa ordem. UUIDs são
identidades; nomes traduzidos não participam da seleção. Distinguir ausência,
valor desconhecido, negação e escolha explícita onde o domínio os distingue.
Não transformar uma confirmação ausente em resposta afirmativa.

A identidade semântica do catálogo também conserva as sequências influentes.
`movementPattern` conserva sua ordem: no helper recuperado de região efetiva,
a primeira categoria não nula pode decidir a classificação de exercícios core.
Tratar essa lista como conjunto ordenável altera a regra, mesmo com os mesmos IDs.

O contrato de igualdade é a definição gerada completa: dias e ordem, exercícios,
roles, séries, alvos por ciclo, relações, IDs derivados e proveniência de regras.
Timestamps e identidades de uma ativação posterior pertencem ao envelope dessa
operação, não à decisão de geração. Alterações manuais posteriores também não
fazem parte da saída original do gerador.

Relógio, locale, ordem de objetos, ordem incidental do catálogo, estado global,
tentativa anterior e caminho worker/fallback não podem mudar o resultado.
Uma semente interna, se útil à implementação, deve ser derivada exclusivamente
da requisição canônica, versão e identidade do catálogo. Nenhuma ação de tentar
novamente pode sortear uma semente. Gerar alternativas fica fora do escopo.

O desempate Taurifer só atua após os critérios de elegibilidade e ranking
recuperados. A ordenação final deve ser total, documentada e independente de
locale. Preferências do usuário não podem ser reduzidas a um empate técnico.

### R02. Divisão automática e explícita

Para Sem preferência, aplicar a regra recuperada no domínio de 2 a 6 dias:

| Dias | Divisão |
| ---: | --- |
| 2 | `fullBody` |
| 3 | `upperLowerFull` |
| 4 | `upperLowerUpperLower` |
| 5 | `pushPullLegsUpperLower` |
| 6 | `pushPullLegsPushPullLegs` |

Uma divisão explícita e compatível prevalece sobre o default. Uma combinação
incompatível recebe um conflito acionável, sem conversão silenciosa. O ramo AOT
que preserva a seleção explícita não prova a validade de toda combinação.
Dias fora do domínio aceito não entram no ramo residual de seis dias.

As 13 identidades abaixo têm construtores recuperados, com 17 variantes de
frequência. A prova de produto de cada opção continua vinculada à CI do head
final. O campo numérico do enum não substitui a validação da interface.

| Identidade no fonte | Frequência validada no fonte | Evidência |
| --- | ---: | --- |
| `fullBody` | 2–6 | Construtor variável e recusa fora de 2–6 recuperados |
| `upperLower` | 2 | Construtor recuperado |
| `pushPull` | 2 | Construtor recuperado |
| `upperLowerFull` | 3 | Ordem, roles, preferências secundárias e spillover recuperados |
| `pushPullLegs` | 3 | Construtor recuperado |
| `upperLowerUpperLower` | 4 | Construtor recuperado |
| `pushPullHingeSquat` | 4 | Construtor recuperado |
| `pushPullLegsAccessories` | 4 | Construtor recuperado |
| `upperLowerUpperLowerUpper` | 5 | Construtor recuperado |
| `pushPullHingeSquatAccessorries` | 5 | Grafia original preservada; construtor recuperado |
| `pushPullLegsUpperLower` | 5 | Construtor recuperado |
| `pushPullHingeSquatUpperLower` | 6 | Ordem real Push/Squat/Pull/Hinge/Upper/Lower recuperada |
| `pushPullLegsPushPullLegs` | 6 | Construtor recuperado |

Nomes internos Taurifer e textos de interface terão um mapeamento explícito para
essas identidades. O mapeamento executável está em `generation-layout.js`, e as montagens de
fonte sanitizadas estão em `test/fixtures/source-generation-v073.json`.
Uma opção nova só fica disponível quando toda sua cadeia
necessária de geração e consumo estiver validada. Não oferecer controles sem
implementação nem usar um template de outra divisão como substituto oculto.

### R03. Estrutura, distribuição e doses

Upper/Lower/Full produz dias nessa ordem. As listas recuperadas de roles são
restrições estruturais, não uma quantidade fixa de exercícios. A distribuição
de templates primários, secundários e acessórios, a ordem final e a redistribuição
de sobras precisam de suas próprias regras verificadas.

Quantidade de exercícios, séries, repetições e RIR decorrem dessas regras e das
entradas. Não fixar 17/43 ou 18/45, nem reproduzir os exercícios do Godmode2 por
uma lista de preferidos inserida no teste. Não transportar os 22 jobs de quatro
dias para três dias e chamar o resultado de Upper/Lower/Full validado.

Experiência, objetivo, periodização e deload devem ter domínio e efeitos
identificados antes de uma configuração ser declarada coberta. Cada ciclo
prescrito precisa de prova da regra que o produz. Sete ciclos declarados num
export que contém apenas Cycle 1 não são sete ciclos observados.

O domínio recuperado tem sete ciclos normais. Um deload inicial ou final
acrescenta uma posição: sete sem deload ou oito com um deload. Nunca substituir
um dos sete targets normais pelo deload. Os limites da requisição atual e os
limites de leitura de uma definição armazenada são contratos distintos.

### R04. Orçamento e estimativa de duração

Manter distintos a opção escolhida, o orçamento interno e a estimativa resultante:

| Faixa / enum | Orçamento interno recuperado, em minutos |
| --- | ---: |
| Até 20 / `max20` | 18 |
| 20–40 / `max40` | 30 |
| 40–60 / `max60` | 50 |
| 60–90 / `max90` | 75 |
| 90–120 / `max120` | 105 |
| Acima de 120 / `over120` | 125 |

A conversão não recupera o modelo de custo, descanso, aquecimento ou ajuste de
volume. O orçamento não pode ser passado como um teto de corte à política antiga
sem demonstrar equivalência. Não adicionar remoções arbitrárias para forçar uma
estimativa abaixo da faixa. A interface apresenta uma estimativa, sem prometer
duração física exata. Os fatores 0,5/0,6 encontrados no código não são uma fórmula
geral de volume ou séries.

### R05. Preferências musculares

Priorizado, neutro e despriorizado são estados distintos. Exclusão é uma restrição
separada. O formulário e o adaptador preservam todas as escolhas válidas por ID,
inclusive oito despriorizados com zero priorizados. Nenhum `.slice(0, 5)` ou
limite próprio equivalente pode descartar entradas.

O limite máximo final e o tratamento de combinações conflitantes dependem da
regra recuperada. Não inferir que oito é o novo máximo nem que não existe limite.
Uma limitação real deve ser informada antes de aceitar a escolha. Despriorização
deve ser considerada independentemente de haver grupos priorizados; seu efeito
exato em seleção e doses ainda precisa de recuperação. Não prometer redução de
séries, exclusão ou volume zero sem essa evidência.

### R06. Elegibilidade, ranking e impossibilidade

Equipamentos disponíveis, exclusões explícitas e confirmações obrigatórias são
restrições duras. Preferidos não as sobrepõem. Identificar separadamente os
critérios recuperados do MacroFactor e as restrições de produto do Taurifer.
Tipos, grupos de exclusão, repetições entre dias, tiers, ROM e estabilidade não
recebem pesos novos inventados para fazer um exemplo coincidir.

A sequência de flexibilização de preferências, se houver, deve ser explícita,
determinística e validada. Sem solução válida, retornar um conflito com as
escolhas relevantes e ações possíveis. Não ativar um programa parcial, substituir
por um starter ou descartar restrições silenciosamente. Tempo de execução
esgotado e cancelamento não provam que a configuração é impossível; seus estados
precisam permanecer distintos.

### R07. Fluxo de produção

Aplicar o mesmo contrato no formulário, adaptador, geração síncrona, worker,
fallback, resultado, edição/undo e reconstrução após mudança de resposta.
Resultado obsoleto de um worker não substitui uma requisição mais recente.
Reabrir o fluxo sem mudar entradas reproduz a mesma recomendação original;
editar ou restaurar a recomendação tem a semântica explícita do review.

Ativação persiste exatamente a definição revisada. Program, Today, Focus,
registro de sessão e reload devem consumir seus dias, exercícios e alvos reais.
A geração continua local, offline e sem introduzir backend ou dependências de
aplicação. Reutilizar as fronteiras existentes em vez de criar uma segunda engine.

### R08. Versões e dados existentes

Não exigir replay de versões anteriores, adaptadores legados, engines antigas
embarcadas ou migrações de formatos. Tampouco exigir compatibilidade retroativa
em qualquer outro consumidor alterado por esta iniciativa. A versão vigente
precisa funcionar integralmente entre seus próprios produtores e consumidores.

| Situação | Comportamento exigido |
| --- | --- |
| Programa/histórico ainda legível pelo contrato vigente | Preservar; não regenerar automaticamente nem reinterpretar IDs de movimentos. |
| Link, import ou receita incompatível | Recusar antes de persistir, explicar e preservar a fonte disponível. Não executar com a versão atual como se fosse a antiga. |
| Draft incompatível | Preservar os bytes disponíveis e oferecer recomeço explícito; não descartar silenciosamente no boot. |
| Armazenamento sem interpretação confiável | Manter a proteção/recovery existente; não confundir corrupção com escolha de recomeçar. |
| Usuário escolhe redefinir | Informar o conjunto afetado, executar pela fronteira transacional existente e preservar dados não abrangidos. Cancelar não escreve. |

Essa política não autoriza excluir dados ou código sem necessidade identificada.
Uma quebra deve listar formatos e consumidores afetados, comportamento de recusa
e prova de preservação/redefinição. Não usar a ausência de compatibilidade para
enfraquecer atomicidade, consentimento de compartilhamento ou a ativação explícita.

## 4. Evidência disponível e seus limites

Classificações obrigatórias: **observado**, **decodificado com pressupostos**,
**política Taurifer aprovada**, **hipótese** e **não recuperado**. Uma prova de
integridade de artefato não prova o algoritmo ou a aplicação.

| Fonte | O que sustenta | Limite |
| --- | --- | --- |
| E01: contrato `upperLowerFull.decoded.json`, investigação de 15/10 | Construtor `0xece100`, ramo `0xecf7e8`, ordem Upper/Lower/Full, campos +0x0c/+0x10/+0x14 | Avaliação simbólica de 228 instruções; sem execução no runtime original; sem política completa dos campos adicionais |
| E02: `auto-split.decoded.json` e `duration.decoded.json` | Resolver `0xeb87dc..0xeb886c`; conversão `0xee3314..0xee33f0`; label max60 em `0xecdccc` | 534 instruções conferidas no ELF; 5 casos automáticos, 65 de precedência explícita, 6 durações. Precedência não é validade da UI |
| E03: `godmode2.differential-fixture.json` | Questionário fotografado, perfil exportado com 82 equipamentos e programa de 18 exercícios/45 séries | Associação dos arquivos sem ID transacional; versão fotografada, estado aleatório e edições não confirmados |
| E04: [corpus Plano 067](../plans/067/README.md) | Catálogo e observações P1–P4 | Defaults escolhidos não são regras recuperadas |
| E05: investigação inicial de seleção | `getBestMatch` chama seleção `0xedf94c`, com `_Random` sem seed explícita | Não recupera todo ranking; a equivalência estatística de seleções não foi demonstrada |
| E06: recuperação e revisão de 16/10, [estado das regras](../plans/073/rule-recovery-status.md) | 13 construtores/17 variantes, frações regionais, 34 roles, seleção e ranking, alocação, distribuição, doses por objetivo/período, deload e custo | Modelo de fonte com bytes do ELF e SDK tipado finito, sem executar a VM ou o gerador original; inputs controlados não confirmam o perfil real de Godmode2 |

Identidade do binário E01/E02/E05, MacroFactor Workouts 1.4.0:
`a79f5db63bb7dffdd683fae131fe033deabaef20d14d6ce4e5d4a6debb3f1312`.
ZIP E03: `aa01f483cdc697d4b1f169402c62fd3eb00c9be73373b6e027f5e1ab23dda52b`.
XLSX E03: `059d9566ba2eb5347daa3683d772606ef3595eb7896d8190d6b2508192cf0bf8`.
Os arquivos citados por nome em E01–E03/E05 são privados, não links para conteúdo
incluído no repositório. O plano define a reprodução e o suplemento sanitizado.

Godmode2 observa objetivo both, Advanced, Static, três dias, Sem preferência,
40–60 minutos e deload desligado na última tela. Os grupos despriorizados são
Abs, Obliques, Serratus, Neck, Calves, Abductors, Adductors e Tibialis, sem
priorizados. Upper tem 5 exercícios/15 séries; Lower 6/13; Full 7/17.

O GodMode antigo tem 17/43. Nas 17 posições comparáveis, séries, repetições e RIR
coincidem; sete nomes são iguais. A nova posição é Machine Back Extension no
Lower, com duas séries. Isso não é um experimento com entradas iguais. Não
transferir o questionário novo para o treino antigo nem interpretar o campo
exportado Exercise Assessment como sete respostas afirmativas já confirmadas.

APKs, bibliotecas, dumps, ASM, workbooks completos, screenshots e dados pessoais
permanecem privados. O suplemento de evidência no repo admite apenas campos
necessários ao gerador, com fontes, hashes e limites. Nunca copiar a fixture
privada inteira para um teste público.

## 5. Aceitação e conclusão

| ID | Prova exigida antes de declarar implementação concluída |
| --- | --- |
| A01 | Mesma requisição canônica produz definição igual após reload, permutação de conjuntos, em worker e fallback; mudança relevante invalida o resultado anterior. Cobre R01/R07. |
| A02 | Matriz de defaults 2–6, preferência explícita válida, incompatibilidades e dias inválidos, com resultado real na interface. Cobre R02. |
| A03 | Upper/Lower/Full percorre questionário → adapter → gerador → review → ativação → Focus → sessão salva → reload, com estrutura/doses sustentadas pelas regras. Cobre R03/R07. |
| A04 | Seis conversões de duração conferidas; orçamento e estimativa não se confundem; ajuste de volume tem regra própria. Cobre R04. |
| A05 | Zero priorizados/oito despriorizados chegam intactos à engine e seu efeito confere com a regra recuperada; exclusão permanece distinta. Cobre R05. |
| A06 | Equipamento ausente, exclusão, confirmação pendente, preferência indisponível e pool vazio não produzem relaxamento oculto; cancelamento não é impossibilidade. Cobre R06. |
| A07 | Cada objetivo/experiência/periodização/deload anunciado como coberto tem condições, ciclos e limites verificados. Cobre R03. |
| A08 | Dados legíveis preservados; formatos incompatíveis recusados sem perda; redefinição explícita e cancelamento exercitados no caminho real. Nenhum replay legado exigido. Cobre R08. |
| A09 | Cada nova divisão tem estrutura, compatibilidade, distribuição e doses validadas antes de aparecer como opção. Cobre R02/R03. |
| A10 | Proveniência diferencia regras recuperadas, política determinística aprovada e pendências; corpus público passa revisão de campos permitidos. Cobre toda a spec. |

A tabela define o gate de conclusão, não um resultado de execução. O
[estado da implementação](../plans/073/implementation-status.md) associa cada
linha à prova executada ou pendente. Só a CI e a revisão do head final podem
encerrar o conjunto.

Uma etapa só termina quando sua cadeia completa de dependências estiver
validada, com casos capazes de detectar violações e prova no produto. A spec
inteira só termina quando todas as divisões e dimensões declaradas no escopo
tiverem cobertura. UI nova, contagem de testes, hash de arquivo ou coincidência
isolada com Godmode2 não substituem essa conclusão.
