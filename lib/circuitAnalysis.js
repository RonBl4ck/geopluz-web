const ANALYSIS_MARKER = '__geopluz_circuit_analysis__';
export const CIRCUIT_STATUSES = {
  en_proceso: { label: 'En proceso', color: '#f9a825' },
  cargado: { label: 'Cargado', color: '#0288d1' },
  analizado: { label: 'Analizado', color: '#2e7d32' },
  requiere_revision: { label: 'Requiere revisión', color: '#e65100' }
};

export function normalizeCircuitAnalysis(analysis = {}) {
  const status = CIRCUIT_STATUSES[analysis.status] ? analysis.status : 'cargado';
  return { note: '', cableGroups: [], ...analysis, status };
}

export function readCircuitAnalysis(lines = []) {
  const marker = Array.isArray(lines) ? lines.find(line => line && line[ANALYSIS_MARKER]) : null;
  return normalizeCircuitAnalysis(marker?.[ANALYSIS_MARKER]);
}

export function readNetworkLines(lines = []) {
  return Array.isArray(lines) ? lines.filter(line => line && !line[ANALYSIS_MARKER]) : [];
}

export function serializeLlaveLines(llave = {}) {
  const lines = readNetworkLines(llave.lines);
  const analysis = llave.analysis || readCircuitAnalysis(llave.lines);
  return analysis.note || analysis.cableGroups?.length || analysis.status !== 'cargado' ? [...lines, { [ANALYSIS_MARKER]: analysis }] : lines;
}

export function hydrateLlave(llave = {}) {
  const lines = llave.lines_data || llave.lines || [];
  return { name: llave.name, lines: readNetworkLines(lines), analysis: readCircuitAnalysis(lines) };
}
