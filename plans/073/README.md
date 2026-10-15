# Suplemento S0 do Plano 073

Este pacote publica a projeção mínima de Godmode2 e de três contratos já
decodificados. Não altera a engine. A base da tarefa é
`d0242c4679ba6a00cea6fd48f42450f3b6e93322`. O histórico da investigação anterior
continua em `plans/067/`; seu extrator e verificador não foram substituídos.

`data/supplement.json` contém respostas de treino observadas, nomes de equipamentos
sem cargas, células de origem, nomes e doses do único ciclo exportado, hashes das
fontes e desconhecidos explícitos. O extrator projeta campos nomeados. O
verificador aplica esquemas exatos recursivos, inclusive dias e séries, e recusa
campos extras. A leitura JSON da CLI e das sete fontes do extrator recusa chaves
duplicadas em qualquer nível antes de construir os objetos. Nenhum workbook, screenshot, perfil pessoal, configuração pessoal,
log de treino ou assembly é distribuído.

## Reprodução

Python 3 e sua biblioteca padrão bastam. `SOURCE_DIR` deve apontar para o diretório
privado `godmode2-20261015`. Seu irmão
`continuation-20261015-split-contract` deve conter `upperLowerFull.decoded.json`.
Escolha um diretório novo de saída fora da árvore privada.

```sh
python3 plans/073/extract.py --source-dir "$SOURCE_DIR" --out "$OUTPUT_DIR"
cmp "$OUTPUT_DIR/supplement.json" plans/073/data/supplement.json
python3 plans/073/verify.py
python3 plans/073/test_verify.py
```

O verificador público funciona sem fontes privadas. O extrator valida antes de
publicar e recusa uma saída existente ou dentro da árvore privada. Hashes vinculam
as fontes normalizadas e decodificadas à versão examinada. Os hashes do arquivo
original e de seus membros vêm do manifesto recebido; o extrator não reabre os
originais para recalculá-los. A normalização prévia e a transcrição visual são
fontes desta etapa, não operações refeitas aqui.

## Contratos e fronteiras

| Regra | Gaps | Fonte e localização | Domínio e condição | Saída e classificação | Limites e dependências |
| --- | --- | --- | --- | --- | --- |
| S0-AUTO | G02 | `auto-split.decoded.json`, ramo `0xeb87dc..0xeb886c` | 2–6 dias, split nulo | fullBody; upperLowerFull; upperLowerUpperLower; pushPullLegsUpperLower; pushPullLegsPushPullLegs. Decodificado sob hipóteses simbólicas | Ponteiros simbólicos e Smi assumidos; validade UI de override explícito pendente |
| S0-TIME | G05 | `duration.decoded.json`, `0xee3314..0xee33ec`; rótulo em `0xecdccc` | max20/max40/max60/max90/max120/over120 | 18/30/50/75/105/125 minutos. Decodificado sob hipótese Duration em microssegundos | Entrada da montagem local; não duração medida nem teto rígido. TimeCalcAllocation e custos pendentes |
| S0-DAYS | G03 | `upperLowerFull.decoded.json`, alocações `0xecf8c4`, `0xecf9b0`, `0xecfa9c` | upperLowerFull, ordinal 3, três dias | Listas ordenadas nos offsets 0xc, 0x10, 0x14. Decodificado sob hipóteses de stubs e ponteiros Dart | Nomes Upper/Lower/Full corroborados pelo export; semântica dos offsets adicionais e distribuição pendentes. Não é execução na VM |
| S0-OBS | G08/G09/G11/G14 | `screenshots.transcribed.json`; `programs.normalized.json`, Training Programs A1:A25; `gym-profile.normalized.json`, Gym Profiles D3:E84 | Godmode2, smart, both, Advanced, Static, três dias, sem preferência, max60, zero priorizados/oito despriorizados, último deload observado desativado | Observação de Cycle 1, 18 exercícios/45 séries, Upper/Lower/Full com descansos | Sete ciclos declarados, só um exportado. Entradas não controladas transacionalmente; equipamentos exportados não provam seleção no momento da geração |

Cada fonte da tabela tem hash em `sources`; células de exercícios e séries ficam
junto do valor publicado. O pacote não atribui fórmulas gerais às doses observadas,
nem transforma despriorização em exclusão. Os 65 casos sintéticos de override não
são publicados como compatibilidade UI. O replay posterior dos seis scripts
históricos, em saída privada isolada, reproduziu 53 arquivos byte a byte,
incluindo instruções e normalização. Os 96 hashes das fontes e o estado de três
checkouts permaneceram iguais. A transcrição visual foi reutilizada; os modelos
simbólicos foram reproduzidos, sem executar o gerador original. O extrator público
continua consumindo os JSON decodificados. O registro da recuperação atual fica
em [rule-recovery-status.md](rule-recovery-status.md); `execution.json` preserva
o relato da execução inicial do suplemento, anterior a esse replay.

## Provas

`verify.py` contém expectativas semânticas independentes do extrator para defaults,
conversões, listas, ordem dos dias, nomes e cada dose. Os pins de transcrição
protegem respostas, equipamento e limitações; esses pins sozinhos não provam a
regra. Asserções das doses observadas não exigem que o futuro compilador escolha
os mesmos exercícios ou conserve 18/45 para toda entrada.

`test_verify.py` injeta campo pessoal aninhado, proveniência ausente, default
adulterado, RIR adulterado, nome adulterado e ordem de dias adulterada. Cada caso
precisa falhar tanto em `validate` quanto na CLI real. Essas são falhas de artefato
offline que o browser não consegue provar. O teste inicial foi escrito e executado antes
do verificador; a falha inicial foi a ausência do módulo `verify`.

A revisão R-S0-01 encontrou que o parser padrão aceitava chaves duplicadas.
Dois controles em bytes JSON, na raiz e no nome de um exercício, demonstraram
saída zero indevida da CLI antes da correção. Após adicionar leitura com
`object_pairs_hook`, ambos são rejeitados pela CLI e na leitura das fontes do
extrator. A mensagem de erro não repete o conteúdo da chave duplicada.

Não há alegação de paridade completa, de todos os ciclos observados ou de gates
S1/S2 encerrados. R01/R08, consumidores e demais evidências de S0 continuam sob
coordenação do plano. A revisão independente e CI do head final cabem ao PR.

A revisão R-S0-02 adicionou `test_committed_artifact_through_cli`, pois a leitura
normal de `good` no teste de mutações escondia duplicatas já presentes no arquivo
publicado. A suite atual tem três testes. O novo teste executa a CLI estrita no
artefato real e verifica seu relatório. Na verificação independente, uma cópia
temporária válida passou; cópias com duplicata na raiz ou no nome de exercício
falharam nesse teste com `duplicate JSON key`. Nenhuma fixture publicada foi
alterada para essa prova.
