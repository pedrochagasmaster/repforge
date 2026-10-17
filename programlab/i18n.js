/* Lab-only copy and UI preference. Never reads or writes production preferences.
   Values use the repository's lowercase {placeholder} convention. */
(function attachProgramLabI18n(root) {
  'use strict';
  const preferenceKey = 'taurifer_programlab_ui_v1';
  let locale = 'en';
  try {
    const preference = JSON.parse(root.localStorage.getItem(preferenceKey) || 'null');
    if (preference?.language === 'pt') locale = 'pt';
  } catch { /* Storage failure does not prevent local inspection. */ }
  const pt = {
    'Skip to workbench': 'Ir para a área de trabalho',
    'TAURIFER / OWNER WORKBENCH': 'TAURIFER / ÁREA DE EXPERIMENTOS',
    'Compare explicit policies against the bundled production baseline.': 'Compare políticas explícitas com a referência de produção incluída nesta versão.',
    'Language': 'Idioma',
    'Checking build identity…': 'Verificando a identidade da versão…',
    'Source manifest': 'Manifesto dos arquivos de origem',
    'Experiment': 'Experimento',
    'Experiment name': 'Nome do experimento',
    'Untitled experiment': 'Experimento sem título',
    'Notes': 'Observações',
    'Unsaved draft': 'Rascunho não salvo',
    'Save experiment': 'Salvar experimento',
    'Export JSON': 'Exportar JSON',
    'Import JSON': 'Importar JSON',
    'Saved experiments': 'Experimentos salvos',
    'Choose an experiment': 'Escolha um experimento',
    'Load': 'Carregar',
    'Execution mode': 'Modo de execução',
    'Single': 'Individual',
    'Batch': 'Lote',
    'Sweep': 'Varredura',
    '01 / INPUTS': '01 / ENTRADAS',
    'Scenarios': 'Cenários',
    'Fixture': 'Cenário de referência',
    'Loading verified fixtures…': 'Carregando cenários verificados…',
    'Scenario name': 'Nome do cenário',
    'Seed': 'Identidade de geração',
    'Both policies receive the same normalized scenario. Generation identity follows this build’s rules.': 'As duas políticas recebem o mesmo cenário normalizado. A identidade de geração segue as regras desta versão.',
    'Apply scenario edits': 'Aplicar alterações do cenário',
    'Duplicate scenario': 'Duplicar cenário',
    'Ordered cases': 'Casos em ordem',
    'Single uses the selected case. Batch and Sweep use every listed case.': 'Individual usa o caso selecionado. Lote e Varredura usam todos os casos da lista.',
    'Move up': 'Mover para cima',
    'Move down': 'Mover para baixo',
    'Remove case': 'Remover caso',
    'Normalized request': 'Entradas normalizadas',
    'Normalized scenario request': 'Entradas normalizadas do cenário',
    'Advanced canonical request': 'Entradas canônicas avançadas',
    'Bypasses the answer adapter. Shared compiler validation applies.': 'Não usa o adaptador de respostas. A validação do compilador compartilhado continua sendo aplicada.',
    'Canonical request JSON': 'JSON das entradas canônicas',
    'Validate and apply request': 'Validar e aplicar entradas',
    '02 / POLICY': '02 / POLÍTICA',
    'Baseline → candidate': 'Referência → candidata',
    'Bundled default · build verification pending': 'Padrão incluído · verificação da versão pendente',
    'Candidate preset': 'Predefinição da candidata',
    'Loading shared policies…': 'Carregando políticas compartilhadas…',
    'Apply preset': 'Aplicar predefinição',
    'Final prescriptions also reflect experience, deload, emphasis and allocation rules.': 'As prescrições finais também refletem experiência, deload, ênfase e regras de distribuição.',
    'Bulk edits': 'Alterações em grupo',
    'Reset candidate to baseline': 'Restaurar candidata para a referência',
    'One-parameter sweep': 'Varredura de um parâmetro',
    'Numeric field': 'Campo numérico',
    'Explicit values (comma separated)': 'Valores explícitos (separados por vírgula)',
    'At most 20 distinct values; each complete policy must pass validation.': 'No máximo 20 valores distintos; cada política completa deve passar pela validação.',
    '03 / OBSERVED OUTPUT': '03 / RESULTADOS OBSERVADOS',
    'Results': 'Resultados',
    'Run a comparison to inspect actual generated prescriptions.': 'Execute uma comparação para inspecionar as prescrições geradas.',
    'Inputs changed · these results belong to the earlier snapshot.': 'Entradas alteradas · estes resultados pertencem ao registro anterior.',
    'Comparison': 'Comparação',
    'No results yet': 'Ainda não há resultados',
    'Cycle': 'Ciclo',
    'Cycle 1': 'Ciclo 1',
    'Bundled baseline': 'Referência incluída',
    'Candidate': 'Candidata',
    'Semantic changes': 'Alterações semânticas',
    'Constraint and allocation trace': 'Rastreamento de restrições e distribuição',
    'Raw selected comparison JSON': 'JSON completo da comparação selecionada',
    'Execution controls': 'Controles de execução',
    'Validating inputs…': 'Validando entradas…',
    'Initializing': 'Inicializando',
    'Compiler cells completed': 'Células do compilador concluídas',
    'Run comparison': 'Executar comparação',
    'Cancel run': 'Cancelar execução',
    'Run without saving': 'Executar sem salvar',
    'Local experiments · prescriptions are observations, not predicted training outcomes. Candidate programs cannot be activated here.': 'Experimentos locais · as prescrições são observações, não previsões de resultados do treino. Programas candidatos não podem ser ativados aqui.',
    'Unsaved changes': 'Alterações não salvas',
    'Apply or replace the pending scenario edits before saving, exporting or running.': 'Aplique ou substitua as alterações pendentes do cenário antes de salvar, exportar ou executar.',
    'Enter explicit numeric sweep values separated by commas.': 'Informe valores numéricos explícitos separados por vírgulas.',
    'Sweep values must be finite numbers.': 'Os valores da varredura devem ser números finitos.',
    'Resolve input errors before running.': 'Corrija os erros nas entradas antes de executar.',
    '{cases} scenario/seed pairs · {cells} compiler cells · {reuse} baseline reuses': '{cases} pares de cenário/identidade · {cells} células do compilador · {reuse} reutilizações da referência',
    'Unable to plan this draft.': 'Não foi possível planejar este rascunho.',
    'Policy': 'Política',
    'Volume': 'Volume', 'Reps': 'Repetições', 'Rest': 'Descanso',
    'Periodization & Deload': 'Periodização e deload', 'Emphasis': 'Ênfase', 'Time Model': 'Modelo de duração',
    'hypertrophyPrimaryCompound': 'Composto principal de hipertrofia',
    'hypertrophySecondaryCompound': 'Composto secundário de hipertrofia',
    'hypertrophyAccessory': 'Acessório de hipertrofia',
    'strengthPrimaryCompound': 'Composto principal de força',
    'strengthSecondaryCompound': 'Composto secundário de força', 'strengthAccessory': 'Acessório de força',
    'bilateral': 'bilateral', 'unilateral': 'unilateral',
    'reps': 'repetições', 'repsPerSide': 'repetições por lado',
    'loadKg': 'carga (kg)', 'loadPerSideKg': 'carga por lado (kg)', 'assistanceKg': 'assistência (kg)',
    'durationSeconds': 'duração (s)', 'durationPerSideSeconds': 'duração por lado (s)',
    'distanceShortMeters': 'distância (m)', 'distanceLongMeters': 'distância (m)',
    'distanceShortPerSideMeters': 'distância por lado (m)',
    'Reset': 'Restaurar',
    'Reset {field} to baseline': 'Restaurar {field} para a referência',
    'Baseline: {value}': 'Referência: {value}',
    'Execution seed': 'Semente de execução',
    'Canonical generation identity': 'Identidade canônica de geração',
    'Canonical input · use the advanced request editor to change this scenario.': 'Entrada canônica · use o editor avançado para alterar este cenário.',
    'Apply scenario edits to validate the mapped request.': 'Aplique as alterações do cenário para validar as entradas mapeadas.',
    'Unapplied scenario changes': 'Alterações do cenário não aplicadas',
    'Unavailable': 'Indisponível',
    'Not executed': 'Não executado',
    'Domain conflict': 'Conflito de domínio',
    'Execution error': 'Erro de execução',
    'rest': 'descanso',
    'unspecified execution': 'execução não especificada',
    'Manual targets': 'Metas manuais',
    'unspecified': 'não especificado',
    'manual': 'manual',
    '{ordinal}. {targets} · RIR {rir} · rest {rest}{manual}': '{ordinal}. {targets} · RIR {rir} · descanso {rest}{manual}',
    'Cycle {index} · {kind}': 'Ciclo {index} · {kind}',
    'ordinary': 'normal',
    'Run {id} · {status} · snapshot {revision}': 'Execução {id} · {status} · registro {revision}',
    'embedded': 'incluído',
    'No semantic prescription changes in this comparison.': 'Nenhuma alteração semântica nas prescrições desta comparação.',
    'This configuration has no saved execution snapshot.': 'Esta configuração não tem um registro de execução salvo.',
    'Saved · revision {revision}': 'Salvo · revisão {revision}',
    '{status} · {completed}/{total} cells{case}': '{status} · {completed}/{total} células{case}',
    'Unsaved run · export remains available': 'Execução não salva · a exportação continua disponível',
    'Saved run snapshot': 'Registro de execução salvo',
    '{description} Fields: {fields}': '{description} Campos: {fields}',
    'Canceling active worker…': 'Encerrando o worker ativo…',
    'Exported {count} archive part(s)': 'Exportado: {count} parte(s) do arquivo',
    'Imported archived result · exact replay unavailable on this build': 'Resultado arquivado importado · reprodução exata indisponível nesta versão',
    'Imported experiment': 'Experimento importado',
    'Generator {version} · {commit}{dirty} · catalog {catalog}': 'Gerador {version} · {commit}{dirty} · catálogo {catalog}',
    'uncommitted': 'sem commit',
    ' · modified build': ' · versão modificada',
    'Bundled default · generator {version} · {fingerprint}': 'Padrão incluído · gerador {version} · {fingerprint}',
    'Ready': 'Pronto',
    'Initialization failed': 'Falha na inicialização',
    'Build incomplete': 'Pacote incompleto',
    'Shared lab services are not assembled': 'Os serviços compartilhados do laboratório não foram reunidos',
    'This source checkout is missing the lab integration services. Build the complete standalone artifact; generation is unavailable until the shared policy, domain and store modules are connected.': 'Esta cópia não tem os serviços de integração do laboratório. Monte o pacote completo; a geração fica indisponível até que os módulos compartilhados de política, domínio e armazenamento sejam conectados.',
    'Language preference could not be saved. It applies to this tab only.': 'Não foi possível salvar o idioma. A preferência vale apenas nesta aba.',
    'Language cannot change while a run is active.': 'O idioma não pode mudar durante uma execução.',
    'validating': 'validando', 'running': 'em execução', 'completed': 'concluído',
    'canceled': 'cancelado', 'interrupted': 'interrompido', 'failed': 'falhou',
  };
  function t(key, values = {}) {
    const template = locale === 'pt' ? pt[key] || key : key;
    return template.replace(/\{([a-z][a-z0-9]*)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
  }
  let initialized = false;
  const staticNodes = [], staticAttributes = [], bindings = new Map();
  function bind(element, key, values = {}) {
    bindings.set(element, { key, values });
    element.textContent = t(key, typeof values === 'function' ? values() : values);
  }
  function localize(document) {
    document.documentElement.lang = locale;
    if (!initialized) {
      const walker = document.createTreeWalker(document.body, 4);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.parentElement.closest('script,style,pre')) continue;
        const original = node.nodeValue;
        const key = original.trim();
        if (Object.hasOwn(pt, key)) staticNodes.push({ node, original, key });
      }
      for (const element of document.querySelectorAll('[aria-label]')) staticAttributes.push({ element, key: element.getAttribute('aria-label') });
      initialized = true;
    }
    for (const { node, original, key } of staticNodes) if (node.isConnected) node.nodeValue = original.replace(key, t(key));
    for (const { element, key } of staticAttributes) element.setAttribute('aria-label', t(key));
    for (const [element, { key, values }] of bindings) element.textContent = t(key, typeof values === 'function' ? values() : values);
    document.getElementById('language').value = locale;
  }
  function setLocale(next) {
    if (!['en', 'pt'].includes(next)) throw new Error('Unsupported language');
    locale = next;
    try { root.localStorage.setItem(preferenceKey, JSON.stringify({ language: locale })); return true; }
    catch { return false; }
  }
  root.RepForgeProgramLabI18n = Object.freeze({ t, bind, localize, setLocale, locale: () => locale });
})(globalThis);
