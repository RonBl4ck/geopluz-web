const ANALYSIS_MARKER = '__geopluz_circuit_analysis__';

export function readCircuitAnalysis(lines = []) {
  const marker = Array.isArray(lines) ? lines.find(line => line && line[ANALYSIS_MARKER]) : null;
  return marker?.[ANALYSIS_MARKER] || { note: '', cableGroups: [] };
}

export function readNetworkLines(lines = []) {
  return Array.isArray(lines) ? lines.filter(line => line && !line[ANALYSIS_MARKER]) : [];
}

export function serializeLlaveLines(llave = {}) {
  const lines = readNetworkLines(llave.lines);
  const analysis = llave.analysis || readCircuitAnalysis(llave.lines);
  return analysis.note || analysis.cableGroups?.length ? [...lines, { [ANALYSIS_MARKER]: analysis }] : lines;
}

export function hydrateLlave(llave = {}) {
  const lines = llave.lines_data || llave.lines || [];
  return { name: llave.name, lines: readNetworkLines(lines), analysis: readCircuitAnalysis(lines) };
}
