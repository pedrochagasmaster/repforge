(function historyImportModule(root) {
  "use strict";

  const LIMITS = Object.freeze({
    maxBytes: 25 * 1024 * 1024,
    maxRows: 200000,
    maxCellChars: 16384,
  });
  const KG_PER_LB = 1 / 2.2046226218;
  const SOURCE_SCHEMAS = Object.freeze({
    hevy: "hevy-set-v1",
    strong: "strong-set-v1",
    "generic-csv": "generic-csv-v1",
  });

  const HEADER_ALIASES = Object.freeze({
    generic: Object.freeze({
      date: "date",
      workout_date: "date",
      session_date: "date",
      session: "sessionId",
      session_id: "sessionId",
      workout_id: "sessionId",
      title: "sessionTitle",
      day: "sessionTitle",
      workout_name: "sessionTitle",
      session_name: "sessionTitle",
      start_time: "startTime",
      start_at: "startTime",
      created: "startTime",
      name: "exerciseName",
      exercise: "exerciseName",
      exercise_name: "exerciseName",
      exercise_title: "exerciseName",
      movement: "exerciseName",
      exercise_id: "sourceExerciseId",
      source_exercise_id: "sourceExerciseId",
      movement_id: "sourceExerciseId",
      set: "setIndex",
      set_index: "setIndex",
      set_order: "setIndex",
      set_number: "setIndex",
      duration: "duration",
      duration_seconds: "durationSeconds",
      workout_duration: "duration",
      load: "weight",
      weight: "weight",
      weight_kg: "weightKg",
      weight_lbs: "weightLb",
      weight_unit: "weightUnit",
      unit: "weightUnit",
      load_unit: "weightUnit",
      reps: "reps",
      repetitions: "reps",
      rep_count: "reps",
      rir: "rir",
      rpe: "rpe",
      set_type: "setType",
      type: "setType",
      is_warmup: "warmup",
      exercise_note: "exerciseNote",
      exercise_notes: "exerciseNote",
      set_notes: "exerciseNote",
      notes: "sessionNote",
      workout_notes: "sessionNote",
      session_notes: "sessionNote",
      end_time: "endTime",
    }),
    hevy: Object.freeze({
      title: "sessionTitle",
      start_time: "startTime",
      end_time: "endTime",
      description: "sessionNote",
      exercise_title: "exerciseName",
      superset_id: "supersetId",
      exercise_notes: "exerciseNote",
      set_index: "setIndex",
      set_type: "setType",
      weight_lbs: "weightLb",
      weight_kg: "weightKg",
      reps: "reps",
      distance_miles: "distance",
      distance_km: "distance",
      duration_seconds: "durationSeconds",
      rpe: "rpe",
    }),
    strong: Object.freeze({
      workout: "sessionId",
      workout_number: "sessionId",
      date: "date",
      workout_name: "sessionTitle",
      duration: "duration",
      duration_sec: "durationSeconds",
      exercise_name: "exerciseName",
      set_order: "setIndex",
      weight: "weight",
      weight_kg: "weightKg",
      weight_lbs: "weightLb",
      weight_unit: "weightUnit",
      reps: "reps",
      rpe: "rpe",
      distance: "distance",
      seconds: "seconds",
      notes: "exerciseNote",
      workout_notes: "sessionNote",
    }),
  });

  const MONTHS = Object.freeze({
    jan: 1, january: 1, janeiro: 1,
    feb: 2, february: 2, fev: 2, fevereiro: 2,
    mar: 3, march: 3, marco: 3, março: 3,
    apr: 4, april: 4, abr: 4, abril: 4,
    may: 5, mai: 5, maio: 5,
    jun: 6, june: 6, junho: 6,
    jul: 7, july: 7, julho: 7,
    aug: 8, august: 8, ago: 8, agosto: 8,
    sep: 9, sept: 9, september: 9, set: 9, setembro: 9,
    oct: 10, october: 10, out: 10, outubro: 10,
    nov: 11, november: 11, novembro: 11,
    dec: 12, december: 12, dez: 12, dezembro: 12,
  });

  function fold(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function canonicalHeader(value) {
    return fold(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  async function sha256(value) {
    if (!root?.crypto?.subtle || typeof TextEncoder !== "function") return null;
    const bytes = new TextEncoder().encode(String(value));
    const digest = await root.crypto.subtle.digest("SHA-256", bytes);
    return `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")}`;
  }

  async function sha256Many(values) {
    const hashes = [];
    for (let start = 0; start < values.length; start += 64) {
      hashes.push(...await Promise.all(values.slice(start, start + 64).map(sha256)));
    }
    return hashes;
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function issue(code, row = null, detail = undefined) {
    return { code, ...(row == null ? {} : { row }), ...(detail == null ? {} : { detail }) };
  }

  function fatal(code, detail = undefined) {
    return { ok: false, status: "invalid", phase: "parse", issues: [issue(code, null, detail)] };
  }

  function countHeaderDelimiters(line) {
    const counts = new Map([[",", 0], [";", 0], ["\t", 0]]);
    let quoted = false;
    for (let index = 0; index < line.length; index++) {
      const char = line[index];
      if (char === '"') {
        if (quoted && line[index + 1] === '"') index++;
        else quoted = !quoted;
      } else if (!quoted && counts.has(char)) counts.set(char, counts.get(char) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  }

  function parseDelimited(text, delimiter) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    let afterQuote = false;
    let line = 1;
    let rowStartLine = 1;

    function pushRow() {
      row.push(cell);
      if (row.some(value => value.length > LIMITS.maxCellChars)) return issue("cell-too-large", rowStartLine);
      if (!(row.length === 1 && row[0] === "")) {
        if (rows.length >= LIMITS.maxRows + 1) return issue("too-many-rows", rowStartLine);
        rows.push({ cells: row, line: rowStartLine });
      }
      row = [];
      cell = "";
      afterQuote = false;
      rowStartLine = line + 1;
      return null;
    }

    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (quoted) {
        if (char === '"') {
          if (text[index + 1] === '"') {
            cell += '"';
            index++;
          } else {
            quoted = false;
            afterQuote = true;
          }
        } else {
          cell += char;
          if (char === "\n") line++;
        }
      } else if (afterQuote) {
        if (char === delimiter) {
          row.push(cell);
          cell = "";
          afterQuote = false;
        } else if (char === "\r" || char === "\n") {
          if (char === "\r" && text[index + 1] === "\n") index++;
          const error = pushRow();
          if (error) return { ok: false, error };
          line++;
        } else if (char === " " || char === "\t") {
          // Spreadsheet exports sometimes leave space between a closing quote
          // and the delimiter. It carries no field data.
        } else {
          return { ok: false, error: issue("malformed-quote", rowStartLine) };
        }
      } else if (char === '"') {
        if (cell.length) return { ok: false, error: issue("malformed-quote", rowStartLine) };
        quoted = true;
      } else if (char === delimiter) {
        row.push(cell);
        cell = "";
      } else if (char === "\r" || char === "\n") {
        if (char === "\r" && text[index + 1] === "\n") index++;
        const error = pushRow();
        if (error) return { ok: false, error };
        line++;
      } else {
        cell += char;
      }
      if (cell.length > LIMITS.maxCellChars) return { ok: false, error: issue("cell-too-large", rowStartLine) };
    }
    if (quoted) return { ok: false, error: issue("unterminated-quote", rowStartLine) };
    if (row.length || cell.length || afterQuote) {
      const error = pushRow();
      if (error) return { ok: false, error };
    }
    return { ok: true, rows };
  }

  function isTauriferCsv(headers) {
    const found = new Set(headers.map(canonicalHeader));
    return found.has("performed_name") && found.has("is_hard_set") &&
      found.has("session") && found.has("exercise_id");
  }

  function detectSource(headers) {
    const found = new Set(headers.map(canonicalHeader));
    const hevy = ["start_time", "exercise_title", "set_index", "set_type"]
      .every(field => found.has(field));
    const strong = ["date", "workout_name", "exercise_name", "set_order"]
      .every(field => found.has(field));
    if (hevy && strong) return { error: "ambiguous-source" };
    if (hevy) return { source: "hevy" };
    if (strong) return { source: "strong" };
    return { source: null };
  }

  function fieldForHeader(header, source) {
    const canonical = canonicalHeader(header);
    return HEADER_ALIASES[source]?.[canonical] || null;
  }

  function parseSourceText(text, { source = "auto" } = {}) {
    const input = String(text ?? "");
    const bytes = typeof TextEncoder === "function" ? new TextEncoder().encode(input).byteLength : input.length;
    if (bytes > LIMITS.maxBytes) return fatal("file-too-large");
    const content = input.replace(/^\uFEFF/, "");
    if (!content.trim()) return { ok: true, status: "empty", phase: "parse", source: null, records: [], issues: [] };

    const firstLine = content.split(/\r?\n/, 1)[0];
    const [delimiter, delimiterCount] = countHeaderDelimiters(firstLine);
    if (!delimiterCount) return fatal("missing-header");
    const parsedCsv = parseDelimited(content, delimiter);
    if (!parsedCsv.ok) return { ok: false, status: "invalid", phase: "parse", issues: [parsedCsv.error] };
    if (!parsedCsv.rows.length) return { ok: true, status: "empty", phase: "parse", source: null, records: [], issues: [] };

    const headers = parsedCsv.rows[0].cells.map(value => value.trim());
    if (headers.some(value => !value)) return fatal("blank-header");
    if (isTauriferCsv(headers)) return fatal("taurifer-log-export-use-json-backup");
    const detected = detectSource(headers);
    if (detected.error) return fatal(detected.error);

    let selectedSource = source;
    if (selectedSource === "auto") selectedSource = detected.source;
    if (selectedSource === "generic-csv") selectedSource = "generic";
    if (selectedSource == null) return fatal("source-selection-required");
    if (!["hevy", "strong", "generic"].includes(selectedSource)) return fatal("unsupported-schema");
    if (selectedSource !== "generic" && detected.source !== selectedSource) return fatal("unsupported-schema");
    const actualSource = selectedSource === "generic" ? "generic-csv" : selectedSource;
    const headerSource = selectedSource;

    const headerFields = headers.map((header, column) => ({ header, column, field: fieldForHeader(header, headerSource) }));
    const mapped = new Map();
    for (const entry of headerFields) {
      if (!entry.field) continue;
      if (mapped.has(entry.field)) return fatal("duplicate-header-field", entry.field);
      mapped.set(entry.field, [entry.column]);
    }
    const loadFields = ["weight", "weightKg", "weightLb"].filter(field => mapped.has(field));
    if (loadFields.length > 1) return fatal("duplicate-header-field", "weight");
    if (mapped.has("duration") && mapped.has("durationSeconds")) return fatal("duplicate-header-field", "duration");

    const required = actualSource === "hevy"
      ? ["sessionTitle", "startTime", "exerciseName", "setIndex", "setType", "reps"]
      : actualSource === "strong"
        ? ["date", "sessionTitle", "exerciseName", "setIndex"]
        : ["date", "exerciseName", "reps"];
    for (const field of required) if (!mapped.has(field)) return fatal("required-header-missing", field);

    const dataRows = parsedCsv.rows.slice(1);
    if (dataRows.length > LIMITS.maxRows) return fatal("too-many-rows");
    const unknownHeaders = headerFields.filter(entry => !entry.field).map(entry => entry.header);
    if (unknownHeaders.length) return fatal("unsupported-columns", unknownHeaders);

    const records = dataRows.map(({ cells, line }) => {
      const values = {};
      for (const entry of headerFields) {
        if (!entry.field) continue;
        const list = values[entry.field] ||= [];
        list.push(String(cells[entry.column] ?? "").trim());
      }
      const rowIssues = [];
      if (cells.length !== headers.length) rowIssues.push(issue("column-count", line));
      return { sourceRowNumber: line, values, rowIssues };
    });

    return {
      ok: true,
      status: records.length ? "parsed" : "empty",
      phase: "parse",
      source: actualSource,
      sourceSchema: SOURCE_SCHEMAS[actualSource],
      delimiter,
      headers,
      records,
      issues: [],
    };
  }

  function one(values, field) {
    const list = values[field] || [];
    return list.length ? list[0] : "";
  }

  function firstNonEmpty(values, fields) {
    for (const field of fields) {
      for (const value of values[field] || []) if (String(value).trim()) return String(value).trim();
    }
    return "";
  }

  function parseInteger(raw, { min = 0, max = 1000 } = {}) {
    const value = String(raw ?? "").trim();
    if (!/^\d+$/.test(value)) return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= min && number <= max ? number : null;
  }

  function parseDecimal(raw, { min = 0, max = Infinity } = {}) {
    let value = String(raw ?? "").trim();
    if (!value) return null;
    if (/^\d+,[0-9]+$/.test(value)) value = value.replace(",", ".");
    if (!/^\d+(?:\.\d+)?$/.test(value)) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max ? number : null;
  }

  function calendarDate(year, month, day) {
    if (!Number.isInteger(year) || year < 1900 || year > 2200 ||
        !Number.isInteger(month) || month < 1 || month > 12 ||
        !Number.isInteger(day) || day < 1 || day > 31) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function dateParts(value, dateOrder) {
    const text = String(value ?? "").trim();
    let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?=$|[Tt ]\d{1,2}:\d{2})/);
    if (match) return { date: calendarDate(+match[1], +match[2], +match[3]), timestamp: text };

    match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:$|[Tt ,])/);
    if (match) {
      const first = +match[1], second = +match[2], year = +match[3];
      let day, month;
      if (first > 12) { day = first; month = second; }
      else if (second > 12) { month = first; day = second; }
      else if (dateOrder === "DMY") { day = first; month = second; }
      else if (dateOrder === "MDY") { month = first; day = second; }
      else return { error: "date-order-required" };
      return { date: calendarDate(year, month, day), timestamp: text };
    }

    match = text.match(/^(\d{1,2})\s+([\p{L}.]+)\s+(\d{4})(?:,?\s+(\d{1,2}:\d{2}(?::\d{2})?))?$/u);
    if (match) {
      const monthName = fold(match[2]).replace(/\.$/, "");
      const month = MONTHS[monthName] || MONTHS[monthName.slice(0, 3)];
      if (!month) return { error: "date-invalid" };
      const time = match[4] || "";
      const combined = `${match[3]}-${String(month).padStart(2, "0")}-${String(+match[1]).padStart(2, "0")}${time ? ` ${time}` : ""}`;
      return { date: calendarDate(+match[3], month, +match[1]), timestamp: combined };
    }
    match = text.match(/^([\p{L}.]+)\s+(\d{1,2}),?\s+(\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?$/u);
    if (match) {
      const monthName = fold(match[1]).replace(/\.$/, "");
      const month = MONTHS[monthName] || MONTHS[monthName.slice(0, 3)];
      if (!month) return { error: "date-invalid" };
      const time = match[4] || "";
      const combined = `${match[3]}-${String(month).padStart(2, "0")}-${String(+match[2]).padStart(2, "0")}${time ? ` ${time}` : ""}`;
      return { date: calendarDate(+match[3], month, +match[2]), timestamp: combined };
    }
    return { error: "date-invalid" };
  }

  function parseDateTime(raw, dateOrder) {
    const parts = dateParts(raw, dateOrder);
    if (parts.error || !parts.date) return { ok: false, issue: parts.error || "date-invalid" };
    const text = String(parts.timestamp || "").trim();
    const timeMatch = text.match(/[Tt ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?$/);
    if (!timeMatch) {
      const isDateOnly = text === parts.date ||
        /^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(text) ||
        /^\d{1,2}\s+[\p{L}.]+\s+\d{4}$/u.test(text);
      if (!isDateOnly) return { ok: false, issue: "date-invalid" };
      return { ok: true, date: parts.date, created: parts.date, raw: String(raw ?? "").trim(), instant: null };
    }
    const hour = +timeMatch[1], minute = +timeMatch[2], second = +(timeMatch[3] || 0);
    const fraction = (timeMatch[4] || "").slice(0, 3).padEnd(3, "0");
    if (hour > 23 || minute > 59 || second > 59) return { ok: false, issue: "date-invalid" };
    const offset = timeMatch[5] || "";
    const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}.${fraction}`;
    if (!offset) return { ok: true, date: parts.date, created: `${parts.date}T${time}`, raw: String(raw ?? "").trim(), instant: null };
    const iso = `${parts.date}T${time}${offset}`;
    const instant = Date.parse(iso);
    if (!Number.isFinite(instant)) return { ok: false, issue: "date-invalid" };
    return { ok: true, date: parts.date, created: new Date(instant).toISOString(), raw: String(raw ?? "").trim(), instant };
  }

  function parseWeightUnit(raw) {
    const unit = fold(raw).replace(/\./g, "");
    if (["kg", "kgs", "kilogram", "kilograms"].includes(unit)) return "kg";
    if (["lb", "lbs", "pound", "pounds"].includes(unit)) return "lb";
    return null;
  }

  function parseDuration(raw, secondsColumn = false) {
    const text = String(raw ?? "").trim();
    if (!text) return { seconds: null, raw: "" };
    if (secondsColumn) {
      const seconds = parseDecimal(text, { max: 86400 * 7 });
      return seconds == null ? { error: "duration-invalid" } : { seconds, raw: text };
    }
    const clock = text.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
    if (clock) return { seconds: (+clock[1] || 0) * 3600 + +clock[2] * 60 + +clock[3], raw: text };
    const parts = [...text.toLowerCase().matchAll(/(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)/g)];
    if (!parts.length) return { error: "duration-invalid" };
    let seconds = 0;
    for (const part of parts) {
      const number = parseDecimal(part[1]);
      const unit = part[2];
      seconds += number * (/^h|hour/.test(unit) ? 3600 : /^m|min/.test(unit) ? 60 : 1);
    }
    return Number.isFinite(seconds) && seconds <= 86400 * 7 ? { seconds, raw: text } : { error: "duration-invalid" };
  }

  function parseSetKind(typeRaw, setIndexRaw, warmupRaw) {
    const type = fold(typeRaw).replace(/[ -]+/g, "_");
    const order = fold(setIndexRaw).replace(/[ -]+/g, "_");
    const warmupValue = fold(warmupRaw);
    if (["true", "1", "yes", "y"].includes(warmupValue) || /warm[_ ]?up|warmup|^w\b/.test(type) || /warm_?up|warmup/.test(order)) {
      return { kind: type || "warmup", warmup: true };
    }
    if (/rest[_ ]?timer|resttimer/.test(order) || type === "rest_timer") return { kind: "rest_timer", restTimer: true };
    if (/drop[_ ]?set|dropset/.test(type)) return { kind: "drop_set", warmup: false };
    if (["failure", "normal", "working", "cooldown", "cool_down"].includes(type)) {
      return { kind: type, warmup: false };
    }
    if (type) return { kind: type, warmup: false };
    return { kind: "normal", warmup: false };
  }

  function parseSourceUnit(values, options, loadColumnUnit) {
    const rowUnit = parseWeightUnit(one(values, "weightUnit"));
    const rowUnitRaw = one(values, "weightUnit");
    const override = parseWeightUnit(options.weightUnit);
    const overrideRaw = String(options.weightUnit ?? "").trim();
    if (rowUnitRaw && !rowUnit) return { error: "unit-invalid" };
    if (overrideRaw && !override) return { error: "unit-invalid" };
    if (loadColumnUnit && rowUnit && loadColumnUnit !== rowUnit) return { error: "unit-conflict" };
    return { unit: loadColumnUnit || rowUnit || override || null };
  }

  function recordDateRaw(record, source) {
    const values = record.values;
    if (source === "hevy") return firstNonEmpty(values, ["startTime", "endTime"]);
    if (source === "strong") return firstNonEmpty(values, ["date"]);
    const date = firstNonEmpty(values, ["date"]);
    const time = firstNonEmpty(values, ["startTime"]);
    if (date && time && !/[Tt ]\d{1,2}:\d{2}/.test(date)) {
      if (/^\d{4}-\d{1,2}-\d{1,2}[Tt ]/.test(time)) return time;
      return `${date} ${time}`;
    }
    return date || time;
  }

  function recordSessionKey(record, source, parsedDate, durationRaw) {
    const values = record.values;
    const external = firstNonEmpty(values, ["sessionId"]);
    if (external) return { reliable: true, key: [source, "id", external] };
    const title = fold(firstNonEmpty(values, ["sessionTitle"]));
    const start = firstNonEmpty(values, ["startTime"]) || (source === "strong" ? firstNonEmpty(values, ["date"]) : "");
    const fullStart = start && /[Tt ]\d{1,2}:\d{2}/.test(start)
      ? (/^\d{4}-\d{1,2}-\d{1,2}/.test(start) ? start : parsedDate?.raw)
      : "";
    if (fullStart) return { reliable: false, key: [source, "start", fullStart, title] };
    if (parsedDate?.date && durationRaw) return { reliable: false, key: [source, "date-title-duration", parsedDate.date, title, durationRaw] };
    if (parsedDate?.date) return { reliable: false, key: [source, "date-title", parsedDate.date, title] };
    return { reliable: false, key: [source, "unplaced-row", record.sourceRowNumber] };
  }

  async function normalizeSourceRecords(parsed, options = {}) {
    if (!parsed?.ok) return parsed;
    if (parsed.status === "empty") return { ok: true, status: "empty", phase: "normalize", source: parsed.source, sessions: [], issues: parsed.issues || [] };
    const source = parsed.source;
    const sessionMap = new Map();
    const diagnostics = [...(parsed.issues || [])];

    for (const record of parsed.records) {
      const values = record.values;
      const dateRaw = recordDateRaw(record, source);
      const dateResult = dateRaw ? parseDateTime(dateRaw, options.dateOrder) : { ok: false, issue: "date-missing" };
      const endRaw = firstNonEmpty(values, ["endTime"]);
      const endDateRaw = endRaw && dateResult.ok && /^\d{1,2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(endRaw)
        ? `${dateResult.date} ${endRaw}` : endRaw;
      const endResult = endRaw ? parseDateTime(endDateRaw, options.dateOrder) : null;
      const durationRaw = firstNonEmpty(values, ["durationSeconds", "duration"]);
      const durationParsed = durationRaw ? parseDuration(durationRaw, !!(values.durationSeconds || []).some(Boolean)) : null;
      const keyInfo = recordSessionKey(record, source, dateResult.ok ? dateResult : null, durationRaw);
      const keyText = JSON.stringify(keyInfo.key);
      let group = sessionMap.get(keyText);
      if (!group) {
        group = {
          source,
          sourceSchema: parsed.sourceSchema,
          sourceKey: keyText,
          reliableSourceKey: keyInfo.reliable,
          sourceSessionId: firstNonEmpty(values, ["sessionId"]) || null,
          title: firstNonEmpty(values, ["sessionTitle"]),
          date: dateResult.ok ? dateResult.date : null,
          start: dateResult.ok ? dateResult : null,
          end: endResult?.ok ? endResult : null,
          durationSeconds: durationParsed?.seconds ?? null,
          durationRaw: durationRaw || "",
          notes: firstNonEmpty(values, ["sessionNote"]),
          rows: [],
          skippedRows: [],
          issues: [],
          sourceRowNumbers: [],
          identityAmbiguous: false,
          duplicateRows: 0,
        };
        sessionMap.set(keyText, group);
      }
      group.sourceRowNumbers.push(record.sourceRowNumber);
      if (!dateResult.ok) group.issues.push(issue(dateResult.issue, record.sourceRowNumber));
      if (durationParsed?.error) group.issues.push(issue(durationParsed.error, record.sourceRowNumber));
      if (dateResult.ok && group.date && group.date !== dateResult.date) {
        group.issues.push(issue("session-date-conflict", record.sourceRowNumber));
      }
      if (dateResult.ok && !group.date) group.date = dateResult.date;
      if (endResult && !endResult.ok) group.issues.push(issue(endResult.issue, record.sourceRowNumber));
      if (record.rowIssues.length) group.issues.push(...record.rowIssues);

      const name = firstNonEmpty(values, ["exerciseName"]);
      const setIndexRaw = firstNonEmpty(values, ["setIndex"]);
      const setKind = parseSetKind(firstNonEmpty(values, ["setType"]), setIndexRaw, firstNonEmpty(values, ["warmup"]));
      if (setKind.restTimer) {
        group.skippedRows.push({
          sourceOrder: group.sourceRowNumbers.length,
          exerciseName: name,
          setIndex: setIndexRaw,
          setType: firstNonEmpty(values, ["setType"]),
          duration: firstNonEmpty(values, ["seconds", "durationSeconds", "duration"]),
          distance: firstNonEmpty(values, ["distance"]),
          notes: firstNonEmpty(values, ["exerciseNote"]),
        });
        diagnostics.push(issue("rest-timer-skipped", record.sourceRowNumber));
        continue;
      }

      const row = {
        sourceRowNumber: record.sourceRowNumber,
        sourceRowKey: null,
        name,
        sourceExerciseId: firstNonEmpty(values, ["sourceExerciseId"]) || null,
        supersetId: firstNonEmpty(values, ["supersetId"]) || null,
        exerciseKey: fold(firstNonEmpty(values, ["sourceExerciseId"]) || name),
        setIndexRaw,
        sourceSetIndex: parseInteger(setIndexRaw, { min: 0, max: 100000 }),
        loadKg: null,
        reps: parseInteger(firstNonEmpty(values, ["reps"]), { min: 1, max: 1000 }),
        rir: null,
        warmup: setKind.warmup === true,
        sourceSetType: setKind.kind,
        exerciseNote: firstNonEmpty(values, ["exerciseNote"]),
        sessionNote: firstNonEmpty(values, ["sessionNote"]),
        date: dateResult.ok ? dateResult.date : null,
        created: dateResult.ok ? (endResult?.ok ? endResult.created : dateResult.created) : null,
        sourceTimestamp: dateRaw,
        sourceEndTimestamp: endRaw || null,
        issues: [...record.rowIssues],
        valid: true,
        duplicate: false,
      };
      if (!name) row.issues.push(issue("exercise-name-missing", record.sourceRowNumber));
      if (setIndexRaw && row.sourceSetIndex == null) row.issues.push(issue("set-index-invalid", record.sourceRowNumber));
      if (!dateResult.ok) row.issues.push(issue(dateResult.issue, record.sourceRowNumber));
      if (row.reps == null) {
        const durationSet = parseDecimal(firstNonEmpty(values, ["seconds", "durationSeconds", "distance"]));
        row.issues.push(issue(durationSet > 0 ? "unsupported-non-strength-row" : "reps-invalid", record.sourceRowNumber));
      }

      const weightValues = ["weight", "weightKg", "weightLb"].map(field => ({ field, value: firstNonEmpty(values, [field]) })).filter(item => item.value);
      if (weightValues.length > 1) {
        row.issues.push(issue("multiple-load-values", record.sourceRowNumber));
      } else if (!weightValues.length) {
        row.loadKg = 0;
      } else {
        const selected = weightValues[0];
        const headerUnit = selected.field === "weightKg" ? "kg" : selected.field === "weightLb" ? "lb" : null;
        const parsedUnit = parseSourceUnit(values, options, headerUnit);
        const amount = parseDecimal(selected.value, { min: 0 });
        if (parsedUnit.error) row.issues.push(issue(parsedUnit.error, record.sourceRowNumber));
        else if (amount == null) row.issues.push(issue("load-invalid", record.sourceRowNumber));
        else if (amount === 0) row.loadKg = 0;
        else if (!parsedUnit.unit) row.issues.push(issue("unit-required", record.sourceRowNumber));
        else {
          const kg = parsedUnit.unit === "lb" ? amount * KG_PER_LB : amount;
          if (!Number.isFinite(kg) || kg > 1000) row.issues.push(issue("load-out-of-range", record.sourceRowNumber));
          else row.loadKg = kg;
        }
      }

      const explicitRirRaw = firstNonEmpty(values, ["rir"]);
      const rpeRaw = firstNonEmpty(values, ["rpe"]);
      if (explicitRirRaw) {
        const rir = parseDecimal(explicitRirRaw, { max: 10 });
        if (rir == null) row.issues.push(issue("rir-invalid", record.sourceRowNumber));
        else row.rir = rir;
      } else if (rpeRaw) {
        const rpe = parseDecimal(rpeRaw, { max: 10 });
        if (rpe == null) row.issues.push(issue("rpe-invalid", record.sourceRowNumber));
        else row.rir = rpe >= 6 ? 10 - rpe : null;
      }

      if (row.issues.some(item => ["date-order-required", "unit-required", "unit-invalid", "unit-conflict"].includes(item.code))) {
        row.blockingIssues = row.issues.filter(item => ["date-order-required", "unit-required", "unit-invalid", "unit-conflict"].includes(item.code));
      } else row.blockingIssues = [];
      if (row.issues.length) row.valid = !row.issues.some(item => !["unsupported-columns"].includes(item.code));
      if (!row.valid) group.issues.push(...row.issues);
      group.rows.push(row);
    }

    const sessionPlans = [];
    for (const group of sessionMap.values()) {
      for (const row of group.rows) row.exerciseOccurrence = 1;
      const setKeys = new Map();
      for (const row of group.rows) {
        if (row.sourceSetIndex == null) continue;
        const key = `${row.exerciseKey}\u0000${row.exerciseOccurrence}\u0000${row.sourceSetIndex}`;
        const previous = setKeys.get(key);
        if (!previous) { setKeys.set(key, row); continue; }
        const same = JSON.stringify([previous.loadKg, previous.reps, previous.rir, previous.warmup, previous.sourceSetType, previous.exerciseNote]) ===
          JSON.stringify([row.loadKg, row.reps, row.rir, row.warmup, row.sourceSetType, row.exerciseNote]);
        if (group.reliableSourceKey && same) {
          row.duplicate = true;
          row.valid = false;
          group.duplicateRows++;
          continue;
        }
        if (group.reliableSourceKey && !same) {
          row.issues.push(issue("duplicate-set-key-conflict", row.sourceRowNumber));
          row.valid = false;
          group.issues.push(...row.issues);
        } else {
          group.identityAmbiguous = true;
          group.issues.push(issue("session-identity-ambiguous", row.sourceRowNumber));
        }
      }
      for (let index = 0; index < group.rows.length; index++) {
        const row = group.rows[index];
        row.sourceRowKey = `${group.sourceRowNumbers[0]}:${row.sourceRowNumber}:${row.exerciseOccurrence}:${row.sourceSetIndex ?? index}`;
      }
      const validRows = group.rows.filter(row => row.valid && !row.duplicate);
      const allNumbered = validRows.length > 0 && validRows.every(row => row.sourceSetIndex != null);
      const byExercise = new Map();
      for (const row of group.rows) {
        const key = `${row.exerciseKey}\u0000${row.exerciseOccurrence}`;
        if (!byExercise.has(key)) byExercise.set(key, []);
        byExercise.get(key).push(row);
      }
      for (const rows of byExercise.values()) {
        rows.sort((a, b) => allNumbered
          ? a.sourceSetIndex - b.sourceSetIndex || a.sourceRowNumber - b.sourceRowNumber
          : a.sourceRowNumber - b.sourceRowNumber);
        rows.filter(row => row.valid && !row.duplicate).forEach((row, index) => { row.set = index + 1; });
      }
      const fingerprintFacts = group.rows.map(row => ({
        name: row.name,
        exerciseId: row.sourceExerciseId,
        sourceSetIndex: row.sourceSetIndex,
        supersetId: row.supersetId,
        loadKg: row.loadKg,
        reps: row.reps,
        rir: row.rir,
        warmup: row.warmup,
        sourceSetType: row.sourceSetType,
        exerciseNote: row.exerciseNote,
        issues: row.issues.map(item => item.code),
      }));
      const fingerprintPayload = JSON.stringify({
        date: group.date,
        title: group.title,
        start: group.start?.raw || null,
        end: group.end?.raw || null,
        duration: group.durationRaw,
        notes: group.notes,
        rows: fingerprintFacts,
        skippedRows: group.skippedRows,
      });
      sessionPlans.push({ group, fingerprintPayload });
    }
    const sessionHashes = await sha256Many(sessionPlans.flatMap(plan => [plan.group.sourceKey, plan.fingerprintPayload]));
    if (sessionHashes.some(value => !value)) {
      return { ok: false, status: "invalid", phase: "normalize", issues: [issue("hash-unavailable")] };
    }
    const sessions = [];
    for (let index = 0; index < sessionPlans.length; index++) {
      const { group } = sessionPlans[index];
      const sourceSessionKey = sessionHashes[index * 2];
      const sourceSessionFingerprint = sessionHashes[index * 2 + 1];
      const created = group.end?.created || group.start?.created || group.date;
      sessions.push({
        source: group.source,
        sourceSchema: group.sourceSchema,
        sourceKey: group.sourceKey,
        sourceSessionKey,
        sourceSessionFingerprint,
        sessionId: `history-import:v1:${source}:${sourceSessionKey.slice(7)}`,
        decisionKey: sourceSessionKey,
        sourceSessionId: group.sourceSessionId,
        reliableSourceKey: group.reliableSourceKey,
        title: group.title,
        date: group.date,
        created,
        durationSeconds: group.durationSeconds,
        durationRaw: group.durationRaw,
        notes: group.notes,
        rows: group.rows,
        issues: group.issues,
        identityAmbiguous: group.identityAmbiguous,
        duplicateRows: group.duplicateRows,
        status: group.issues.some(item => !["rest-timer-skipped"].includes(item.code)) ? "partial" : "complete",
      });
    }
    return { ok: true, status: sessions.length ? "normalized" : "empty", phase: "normalize", source, sessions, issues: diagnostics };
  }

  function defaultClassification(name) {
    return { status: "unmatched", matchId: null, candidateIds: [] };
  }

  async function reconcileCandidates(normalized, {
    classifyExercise = defaultClassification,
    getExercise = () => null,
    decisions = {},
  } = {}) {
    if (!normalized?.ok) return normalized;
    if (normalized.status === "empty") return { ...normalized, phase: "reconcile", reconciled: true };
    const source = normalized.source;
    const movementKeys = [];
    const movementKeySet = new Set();
    for (const session of normalized.sessions) {
      for (const row of session.rows) {
        const sourceMovementKey = row.sourceExerciseId
          ? `${source}\u0000id\u0000${row.sourceExerciseId}`
          : `${source}\u0000name\u0000${fold(row.name)}`;
        row.sourceMovementKey = sourceMovementKey;
        if (!movementKeySet.has(sourceMovementKey)) {
          movementKeySet.add(sourceMovementKey);
          movementKeys.push(sourceMovementKey);
        }
      }
    }
    const movementHashes = await sha256Many(movementKeys);
    if (movementHashes.some(value => !value)) {
      return { ok: false, status: "invalid", phase: "reconcile", issues: [issue("hash-unavailable")] };
    }
    const movementIds = new Map(movementKeys.map((key, index) => [key, movementHashes[index]]));
    for (const session of normalized.sessions) {
      for (const row of session.rows) {
        row.sourceMovementId = `history-import:${source}:${movementIds.get(row.sourceMovementKey).slice(7)}`;
      }
    }

    const classificationCache = new Map();
    const rowsByMovement = new Map();
    for (const session of normalized.sessions) {
      for (const row of session.rows) {
        const classificationKey = `${row.sourceMovementKey}\u0000${fold(row.name)}`;
        if (!classificationCache.has(classificationKey)) {
          let result;
          try {
            result = classifyExercise(row.name);
            if (result && typeof result.then === "function") result = await result;
          }
          catch { result = null; }
          classificationCache.set(classificationKey, result || defaultClassification(row.name));
        }
        row.classificationKey = classificationKey;
        row.classification = classificationCache.get(classificationKey);
        if (!rowsByMovement.has(row.sourceMovementId)) rowsByMovement.set(row.sourceMovementId, []);
        rowsByMovement.get(row.sourceMovementId).push(row);
      }
    }

    const movementSummary = new Map();
    for (const [movementId, relatedRows] of rowsByMovement) {
      const byLabel = new Map();
      for (const row of relatedRows) byLabel.set(row.classificationKey, row.classification);
      const relatedClassifications = [...byLabel.values()];
      const targetIds = new Set(relatedClassifications
        .filter(item => ["exact", "alias"].includes(item?.status) && typeof item.matchId === "string")
        .map(item => item.matchId));
      movementSummary.set(movementId, {
        relatedClassifications,
        targetIds,
        allNamesResolveConsistently: relatedClassifications.every(item =>
          ["exact", "alias"].includes(item?.status) && typeof item.matchId === "string") && targetIds.size === 1,
        candidates: [...new Set(relatedClassifications.flatMap(item =>
          Array.isArray(item?.candidateIds) ? item.candidateIds.filter(id => typeof id === "string") : []))].slice(0, 3),
      });
    }

    const requestedTargets = new Set();
    for (const [movementId, summary] of movementSummary) {
      const decision = decisions[movementId];
      summary.decision = decision;
      if (decision?.kind === "link" && typeof decision.libraryId === "string") {
        summary.targetId = decision.libraryId;
        summary.identityMode = "explicit-link";
      } else if (decision?.kind === "keep-source") {
        summary.identityMode = "kept-source";
      } else if (summary.allNamesResolveConsistently) {
        summary.targetId = [...summary.targetIds][0];
        summary.identityMode = "matched";
      } else {
        summary.identityMode = "unresolved";
      }
      if (summary.targetId) requestedTargets.add(summary.targetId);
    }

    const targetCache = new Map();
    const targetIds = [...requestedTargets];
    for (let start = 0; start < targetIds.length; start += 64) {
      const chunk = targetIds.slice(start, start + 64);
      const targets = await Promise.all(chunk.map(async targetId => {
        try { return await getExercise(targetId); } catch { return null; }
      }));
      chunk.forEach((targetId, index) => targetCache.set(targetId, targets[index]));
    }
    for (const summary of movementSummary.values()) {
      if (!summary.targetId) continue;
      summary.target = targetCache.get(summary.targetId);
      summary.targetUnavailable = !summary.target || summary.target.id !== summary.targetId;
    }

    for (const session of normalized.sessions) {
      for (const row of session.rows) {
        const classification = row.classification;
        const summary = movementSummary.get(row.sourceMovementId);
        let targetId = summary.targetId || null;
        let identity = classification?.status === "exact" || classification?.status === "alias"
          ? classification.status : classification?.status === "probable" ? "probable" : "unmatched";
        if (summary.identityMode === "explicit-link") {
          identity = "explicit-link";
        } else if (summary.identityMode === "kept-source") {
          identity = "kept-source";
        } else if (summary.identityMode === "unresolved" && ["exact", "alias"].includes(identity)) {
          identity = "unresolved";
        }

        if (summary.targetUnavailable) {
          row.identity = {
            status: "unresolved",
            reason: "target-unavailable",
            targetId: null,
            candidates: summary.candidates,
          };
          row.issues.push(issue("identity-target-unavailable", row.sourceRowNumber));
          continue;
        }
        const target = summary.target || null;
        row.identity = {
          status: targetId ? identity : identity === "exact" || identity === "alias" ? "unresolved" : identity,
          targetId,
          candidates: summary.candidates,
          target: target ? { id: target.id, primary: String(target.primary || ""), secondary: String(target.secondary || "") } : null,
          ...(summary.identityMode === "unresolved" && summary.targetIds.size
            ? { reason: "source-label-variants-unresolved" } : {}),
        };
      }
    }

    return { ...normalized, phase: "reconcile", reconciled: true };
  }

  function stableSessionRows(session) {
    return session.rows.filter(row => row.valid && !row.duplicate)
      .sort((a, b) => a.sourceRowNumber - b.sourceRowNumber);
  }

  function semanticFingerprintPayload(session) {
    const facts = stableSessionRows(session).map(row => ({
      identity: row.identity?.targetId ? `library:${row.identity.targetId}` : row.sourceMovementId,
      date: row.date,
      set: row.set,
      load: row.loadKg,
      reps: row.reps,
      rir: row.rir,
      warmup: row.warmup,
    }));
    facts.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return JSON.stringify({ date: session.date, rows: facts });
  }

  function groupExistingLog(log) {
    const groups = new Map();
    for (const row of Array.isArray(log) ? log : []) {
      if (!row || row.session == null) continue;
      const key = String(row.session);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    return [...groups.values()];
  }

  function existingSemanticFacts(rows) {
    return rows.map(row => ({
      identity: row.performedLibraryId ? `library:${row.performedLibraryId}`
        : row.performedMovementId ? `movement:${row.performedMovementId}`
          : `name:${fold(row.performedName || row.name)}`,
      date: row.date || null,
      set: Number(row.set) || 0,
      load: Number(row.load) || 0,
      reps: Number(row.reps) || 0,
      rir: row.rir == null || row.rir === "" ? null : Number(row.rir),
      warmup: row.warmup === true,
    })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }

  function semanticFactsKey(facts) {
    return JSON.stringify(facts);
  }

  function sessionDecision(value) {
    const kind = value?.kind;
    return {
      identity: value?.identityKind || (["keep-together", "split"].includes(kind) ? kind : null),
      duplicate: value?.duplicateKind || (["skip", "keep-separate"].includes(kind) ? kind : null),
      assignments: value?.assignments || {},
    };
  }

  async function buildImportProposal(reconciled, { existingLog = [], sessionDecisions = {} } = {}) {
    if (!reconciled?.ok) return reconciled;
    if (reconciled.status === "empty") return { ...reconciled, phase: "validate", status: "empty", proposal: null, blockers: [], warnings: reconciled.issues || [] };

    const existingGroups = groupExistingLog(existingLog);
    const sourceImports = new Map();
    const sourceSemanticFingerprints = new Set();
    const legacySemanticFacts = new Set();
    for (const rows of existingGroups) {
      const provenance = rows[0]?.historyImport;
      if (provenance?.sourceSessionKey && provenance?.sourceSessionFingerprint) {
        const key = `${provenance.source}\u0000${provenance.sourceSessionKey}`;
        sourceImports.set(key, provenance.sourceSessionFingerprint);
      }
      if (provenance?.semanticFingerprint) sourceSemanticFingerprints.add(provenance.semanticFingerprint);
      else legacySemanticFacts.add(semanticFactsKey(existingSemanticFacts(rows)));
    }

    const blockers = [];
    const warnings = [...(reconciled.issues || [])];
    const preparedSessions = [];
    const incomingSemantics = new Map();
    let skippedDuplicateSessions = 0;

    for (const original of reconciled.sessions) {
      const originalDecision = sessionDecision(sessionDecisions[original.decisionKey]);
      const duplicateKey = `${original.source}\u0000${original.sourceSessionKey}`;
      const existingSource = sourceImports.get(duplicateKey);
      if (existingSource === original.sourceSessionFingerprint) {
        skippedDuplicateSessions++;
        warnings.push(issue("already-imported-session", null, { sessionKey: original.decisionKey }));
        continue;
      }
      if (existingSource && existingSource !== original.sourceSessionFingerprint) {
        if (originalDecision.duplicate === "skip") {
          skippedDuplicateSessions++;
          warnings.push(issue("changed-session-skipped", null, { sessionKey: original.decisionKey }));
          continue;
        }
        if (originalDecision.duplicate !== "keep-separate") {
          blockers.push(issue("source-session-changed", null, { sessionKey: original.decisionKey }));
          continue;
        }
      }

      for (const row of original.rows) warnings.push(...row.issues);
      warnings.push(...original.issues);
      if (original.duplicateRows) {
        warnings.push(issue("duplicate-source-rows-removed", null, { count: original.duplicateRows }));
      }

      let sessions = [original];
      if (original.identityAmbiguous) {
        if (originalDecision.identity === "split") {
          const assigned = new Map();
          let splitInvalid = false;
          for (const row of original.rows) {
            const part = originalDecision.assignments[row.sourceRowKey];
            if (typeof part !== "string" || !part.trim()) {
              blockers.push(issue("session-split-incomplete", row.sourceRowNumber));
              splitInvalid = true;
              continue;
            }
            if (!assigned.has(part)) assigned.set(part, []);
            assigned.get(part).push(row);
          }
          if (splitInvalid) continue;
          if (assigned.size < 2) {
            blockers.push(issue("session-split-needs-two-groups", null, { sessionKey: original.decisionKey }));
            continue;
          }
          sessions = [];
          for (const rows of assigned.values()) {
            const rowKeys = rows.map(row => row.sourceRowKey);
            const sourceSessionKey = await sha256(JSON.stringify([original.sourceSessionKey, "split", rowKeys]));
            const sourceSessionFingerprint = await sha256(JSON.stringify([original.sourceSessionFingerprint, rowKeys]));
            if (!sourceSessionKey || !sourceSessionFingerprint) {
              return { ok: false, status: "invalid", phase: "validate", issues: [issue("hash-unavailable")] };
            }
            const dates = new Set(rows.map(row => row.date).filter(Boolean));
            const child = {
              ...original,
              rows,
              sourceSessionKey,
              sourceSessionFingerprint,
              sessionId: `history-import:v1:${original.source}:${sourceSessionKey.slice(7)}`,
              decisionKey: sourceSessionKey,
              reliableSourceKey: false,
              identityAmbiguous: false,
              splitGroupKey: original.decisionKey,
              issues: original.issues.filter(item => item.code !== "session-identity-ambiguous" && item.code !== "session-date-conflict"),
              date: dates.size === 1 ? [...dates][0] : original.date,
            };
            if (dates.size > 1) child.issues.push(issue("session-date-conflict"));
            child.status = child.issues.some(item => !["rest-timer-skipped"].includes(item.code)) || rows.some(row => !row.valid)
              ? "partial" : "complete";
            sessions.push(child);
          }
        } else if (originalDecision.identity === "keep-together") {
          warnings.push(issue("session-kept-together", null, { sessionKey: original.decisionKey }));
          sessions = [{
            ...original,
            identityAmbiguous: false,
            issues: original.issues.filter(item => item.code !== "session-identity-ambiguous"),
            status: original.issues.some(item => item.code !== "session-identity-ambiguous") ? "partial" : "complete",
          }];
        } else {
          blockers.push(issue("session-identity-ambiguous", null, { sessionKey: original.decisionKey }));
          continue;
        }
      }

      for (const session of sessions) {
        if (session.issues.some(item => ["duplicate-set-key-conflict", "session-date-conflict"].includes(item.code))) {
          blockers.push(issue("session-source-conflict", null, { sessionKey: session.decisionKey }));
          continue;
        }
        const badBlockingRows = session.rows.filter(row => row.blockingIssues?.length);
        for (const row of badBlockingRows) blockers.push(...row.blockingIssues);
        const sessionRows = stableSessionRows(session);
        if (!sessionRows.length) continue;
        for (const row of sessionRows) {
          const status = row.identity?.status;
          if (!["exact", "alias", "explicit-link", "kept-source"].includes(status)) {
            blockers.push(issue("exercise-identity-unresolved", row.sourceRowNumber, {
              sourceMovementId: row.sourceMovementId,
              candidateIds: row.identity?.candidates || [],
            }));
          }
        }
        if (badBlockingRows.length) continue;

        const newFacts = sessionRows.map(row => ({
          identity: row.identity?.targetId ? `library:${row.identity.targetId}` : `movement:${row.sourceMovementId}`,
          date: row.date,
          set: row.set,
          load: row.loadKg,
          reps: row.reps,
          rir: row.rir,
          warmup: row.warmup,
        })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
        preparedSessions.push({
          session,
          original,
          existingSource,
          newFacts,
          fingerprintPayload: semanticFingerprintPayload(session),
        });
      }
    }

    const semanticFingerprints = await sha256Many(preparedSessions.map(item => item.fingerprintPayload));
    if (semanticFingerprints.some(value => !value)) {
      return { ok: false, status: "invalid", phase: "validate", issues: [issue("hash-unavailable")] };
    }
    const readySessions = [];
    for (let index = 0; index < preparedSessions.length; index++) {
      const { session, original, existingSource, newFacts } = preparedSessions[index];
      const semFingerprint = semanticFingerprints[index];
      const sourceDuplicate = sourceSemanticFingerprints.has(semFingerprint);
      const localDuplicate = legacySemanticFacts.has(semanticFactsKey(newFacts));
      const previousSplitGroups = incomingSemantics.get(semFingerprint) || [];
      const incomingDuplicate = previousSplitGroups.some(splitGroupKey =>
        !session.splitGroupKey || splitGroupKey !== session.splitGroupKey);
      if (sourceDuplicate || localDuplicate || incomingDuplicate) {
        const choice = sessionDecision(sessionDecisions[session.decisionKey] || sessionDecisions[original.decisionKey]).duplicate;
        if (choice === "skip") {
          skippedDuplicateSessions++;
          warnings.push(issue("possible-duplicate-skipped", null, { sessionKey: session.decisionKey }));
          continue;
        }
        if (choice !== "keep-separate") {
          blockers.push(issue("possible-duplicate-session", null, { sessionKey: session.decisionKey }));
          continue;
        }
      }

      const preparedSession = { ...session, semanticFingerprint: semFingerprint };
      if (existingSource && existingSource !== original.sourceSessionFingerprint) {
        preparedSession.sessionId = `history-import:v1:${session.source}:${session.sourceSessionKey.slice(7)}:${session.sourceSessionFingerprint.slice(7)}`;
      }
      previousSplitGroups.push(session.splitGroupKey || null);
      incomingSemantics.set(semFingerprint, previousSplitGroups);
      readySessions.push(preparedSession);
    }

    const uniqueBlockers = new Map(blockers.map(item => [JSON.stringify(item), item]));
    const allBlockers = [...uniqueBlockers.values()];
    const rows = [];
    for (const session of readySessions) {
      const sessionStatus = session.status === "partial" ? "partial" : "complete";
      for (const row of stableSessionRows(session)) {
        const result = {
          session: session.sessionId,
          date: row.date || session.date,
          day: session.title,
          name: row.name,
          exerciseId: `${session.sessionId}:${row.sourceMovementId}:${row.exerciseOccurrence}`,
          set: row.set,
          load: row.loadKg ?? 0,
          reps: row.reps,
          rir: row.rir,
          notes: row.sessionNote || session.notes || "",
          created: row.created || session.created || session.date,
          performedName: row.name,
          ...(row.identity?.targetId ? {
            performedLibraryId: row.identity.targetId,
            performedPrimary: row.identity.target.primary,
            performedSecondary: row.identity.target.secondary,
          } : {
            performedMovementId: row.sourceMovementId,
            performedPrimary: "",
            performedSecondary: "",
          }),
          ...(row.exerciseNote ? { exNote: row.exerciseNote } : {}),
          ...(row.warmup ? { warmup: true } : {}),
          historyImport: {
            schemaVersion: 1,
            source: session.source,
            sourceSchema: session.sourceSchema,
            sourceSessionKey: session.sourceSessionKey,
            sourceSessionFingerprint: session.sourceSessionFingerprint,
            semanticFingerprint: session.semanticFingerprint,
            sourceRowKey: `${session.sourceSessionKey}:row:${row.sourceRowKey}`,
            sessionStatus,
            identity: row.identity.status,
            ...(row.sourceSetType !== "normal" ? { sourceSetType: row.sourceSetType } : {}),
            ...(row.supersetId ? { sourceSupersetId: row.supersetId } : {}),
            sourceTimestamp: row.sourceTimestamp || null,
            sourceEndTimestamp: row.sourceEndTimestamp || null,
          },
        };
        rows.push(result);
      }
    }
    if (allBlockers.length) {
      return {
        ok: true, status: "needs-review", phase: "validate", source: reconciled.source,
        blockers: allBlockers, warnings, sessions: reconciled.sessions,
        readySessionCount: readySessions.length, skippedDuplicateSessions,
        proposal: null,
      };
    }
    if (!rows.length) {
      return {
        ok: true, status: "no-new-sessions", phase: "validate", source: reconciled.source,
        blockers: [], warnings, sessions: reconciled.sessions,
        readySessionCount: 0, skippedDuplicateSessions,
        proposal: deepFreeze({ schemaVersion: 1, source: reconciled.source, rows: [], sessions: [], noOp: true }),
      };
    }
    const proposalId = await sha256(JSON.stringify(readySessions.map(session => [session.sourceSessionKey, session.sourceSessionFingerprint, session.semanticFingerprint])));
    if (!proposalId) return { ok: false, status: "invalid", phase: "validate", issues: [issue("hash-unavailable")] };
    const proposal = deepFreeze({
      schemaVersion: 1,
      proposalId,
      source: reconciled.source,
      sourceSchema: SOURCE_SCHEMAS[reconciled.source],
      rows,
      sessions: readySessions.map(session => ({
        session: session.sessionId,
        sourceSessionKey: session.sourceSessionKey,
        sourceSessionFingerprint: session.sourceSessionFingerprint,
        semanticFingerprint: session.semanticFingerprint,
        date: session.date,
        title: session.title,
        status: session.status,
      })),
      noOp: false,
    });
    return {
      ok: true, status: "ready", phase: "validate", source: reconciled.source,
      blockers: [], warnings, sessions: reconciled.sessions,
      readySessionCount: readySessions.length, skippedDuplicateSessions,
      proposal,
    };
  }

  async function prepareHistoryImport(text, options = {}) {
    const parsed = parseSourceText(text, options);
    if (!parsed.ok || parsed.status === "empty") {
      return parsed.status === "empty"
        ? { ...parsed, phase: "validate", proposal: null, blockers: [], warnings: [] }
        : parsed;
    }
    const normalized = await normalizeSourceRecords(parsed, options);
    if (!normalized.ok || normalized.status === "empty") {
      return normalized.status === "empty"
        ? { ...normalized, phase: "validate", proposal: null, blockers: [], warnings: normalized.issues || [] }
        : normalized;
    }
    const reconciled = await reconcileCandidates(normalized, options);
    if (!reconciled.ok) return reconciled;
    return buildImportProposal(reconciled, options);
  }

  const api = Object.freeze({
    LIMITS,
    SOURCE_SCHEMAS,
    parseSourceText,
    normalizeSourceRecords,
    reconcileCandidates,
    buildImportProposal,
    prepareHistoryImport,
  });

  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RepForgeHistoryImport = api;
})(typeof globalThis === "object" ? globalThis : this);
