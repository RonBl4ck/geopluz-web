import * as XLSX from 'xlsx';

/**
 * Exporta el listado de fallas a un archivo Excel (.xlsx) con pestañas separadas por SED.
 * @param {Array} pointsList - Lista de puntos de falla.
 * @param {string|null} currentSedId - ID de la SED actual (opcional, para priorizar su pestaña).
 */
export function exportExcelBySed(pointsList = [], currentSedId = null) {
  if (!pointsList || pointsList.length === 0) {
    alert('⚠️ No hay registros de fallas para exportar.');
    return;
  }

  try {
    // Agrupar los registros por SED
    const sedsGrouped = {};
    pointsList.forEach(pt => {
      let rawSed = pt.sed || (pt.sedLlave ? pt.sedLlave.split('-')[0].trim() : '') || 'GENERAL';
      // Limpiar prefijos duplicados tipo "SED 04487A" -> "04487A"
      let cleanSedKey = rawSed
        .replace(/^SED\s+/i, '')
        .replace(/^Subestación\s+/i, '')
        .trim() || 'GENERAL';

      if (!sedsGrouped[cleanSedKey]) {
        sedsGrouped[cleanSedKey] = [];
      }
      sedsGrouped[cleanSedKey].push(pt);
    });

    const wb = XLSX.utils.book_new();

    // Determinar orden de las pestañas: la SED seleccionada va primero si existe
    let sedKeys = Object.keys(sedsGrouped);
    const cleanCurrentSed = currentSedId
      ? currentSedId.replace(/^SED\s+/i, '').replace(/^Subestación\s+/i, '').trim()
      : null;

    if (cleanCurrentSed && sedsGrouped[cleanCurrentSed]) {
      sedKeys = sedKeys.filter(k => k !== cleanCurrentSed);
      sedKeys.unshift(cleanCurrentSed);
    }

    sedKeys.forEach((sedKey) => {
      const rows = sedsGrouped[sedKey];
      const excelRows = rows.map((r, idx) => {
        const coordsStr = r.coords && Array.isArray(r.coords) && !isNaN(r.coords[0]) && !isNaN(r.coords[1])
          ? `${r.coords[0].toFixed(6)}, ${r.coords[1].toFixed(6)}`
          : (r.latitud && r.longitud ? `${r.latitud.toFixed(6)}, ${r.longitud.toFixed(6)}` : 'Sin GPS');

        const fotosCount = r.fotos ? r.fotos.length : 0;
        const evidenciaStr = fotosCount > 0 ? `${fotosCount} foto(s)` : 'Sin foto';

        return {
          'NRO': r.localNumber || idx + 1,
          'TICKET': r.ticket || '',
          'SED-LLAVE': r.sedLlave || `${sedKey}-${r.llaveSistema || ''}`,
          'FALLA REAL': r.falla || r.fallaReal || '',
          'CAUSA': r.causa || '',
          'NOTA ESPECÍFICA': r.nota || '',
          'CROQUIS': r.linkCroquis || r.link_croquis || r.croquis || '-',
          'SUMINISTRO': r.suministro || '',
          'EVIDENCIAS': evidenciaStr,
          'COORDENADAS': coordsStr,
          'ESTADO': 'Atendido'
        };
      });

      const ws = XLSX.utils.json_to_sheet(excelRows);

      // Configurar anchos de columnas
      ws['!cols'] = [
        { wch: 6 },   // NRO
        { wch: 16 },  // TICKET
        { wch: 18 },  // SED-LLAVE
        { wch: 28 },  // FALLA REAL
        { wch: 24 },  // CAUSA
        { wch: 30 },  // NOTA ESPECÍFICA
        { wch: 35 },  // CROQUIS
        { wch: 16 },  // SUMINISTRO
        { wch: 14 },  // EVIDENCIAS
        { wch: 25 },  // COORDENADAS
        { wch: 12 }   // ESTADO
      ];

      // Nombre de la pestaña (máximo 31 caracteres según especificación de Excel)
      const sheetName = `SED ${sedKey}`.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = cleanCurrentSed
      ? `GEOPLUZ_FALLAS_SED_${cleanCurrentSed}_${dateStr}.xlsx`
      : `GEOPLUZ_FALLAS_POR_SED_${dateStr}.xlsx`;

    XLSX.writeFile(wb, fileName);
  } catch (err) {
    alert('❌ Error al exportar Excel: ' + err.message);
  }
}
