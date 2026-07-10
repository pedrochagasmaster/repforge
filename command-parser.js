(function exposeCommandParser(root) {
  function normalizeCommandText(text) {
    return String(text ?? "").toLowerCase().replaceAll("×", "x").replace(/@/g, " rir ")
      .replace(/(\d),(\d)/g, "$1.$2").replace(/\breps\b/g, "").replace(/\s+/g, " ").trim();
  }

  function parseSetCommand(text) {
    const n = normalizeCommandText(text), warnings = [];
    let set = null, load, reps, rir = null, effort = null, unit = null, confidence = "low", gotReps = false;
    const setM = n.match(/(?:^|\s)(?:set\s*(\d+)|s\s*(\d+))\b/);
    if (setM) set = +(setM[1] || setM[2]);
    const commandWithoutSet = setM ? `${n.slice(0, setM.index)} ${n.slice(setM.index + setM[0].length)}`.replace(/\s+/g, " ").trim() : n;
    const primary = commandWithoutSet.match(/(\d+(?:\.\d+)?)\s*(kg|lb)?\s*(?:x|for)\s*(\d+)/);
    if (primary) { load = +primary[1]; unit = primary[2] || null; reps = +primary[3]; confidence = "high"; gotReps = true; }
    else {
      const nums = (commandWithoutSet.match(/\d+(?:\.\d+)?/g) || []).map(Number);
      if (!nums.length) return { ok: false, error: "Could not read a set from that.", warnings };
      if (nums.length < 2) return { ok: false, error: "Could not find reps.", warnings };
      load = nums[0]; reps = nums[1]; gotReps = true; if (nums.length >= 3) rir = nums[2];
    }
    if (!gotReps) return { ok: false, error: "Could not find reps.", warnings };
    const rirM = commandWithoutSet.match(/(?:rir|@)\s*(\d+(?:\.\d+)?)/); if (rirM) rir = +rirM[1];
    else { const tr = commandWithoutSet.match(/\b(\d+(?:\.\d+)?)\s*rir\b/); if (tr) rir = +tr[1]; }
    const ef = commandWithoutSet.match(/\b(easy|hard|max)\b/); if (ef) effort = ef[1];
    if (!unit) { const u = commandWithoutSet.match(/\b(\d+(?:\.\d+)?)\s*(kg|lb)\b/); if (u) unit = u[2]; }
    let exerciseName = null;
    const loadIndex = primary ? primary.index : commandWithoutSet.search(/\d/);
    if (loadIndex > 0) {
      const ex = commandWithoutSet.slice(0, loadIndex).trim();
      if (ex) exerciseName = ex;
    }
    return { ok: true, exerciseName, set, load, reps, rir, effort, unit, confidence, warnings };
  }

  const api = { normalizeCommandText, parseSetCommand };
  root.RepForgeCommandParser = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
