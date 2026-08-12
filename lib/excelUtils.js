import ExcelJS from 'exceljs';

/**
 * Captura la vista actual del mapa en la interfaz usando html2canvas.
 * @returns {Promise<string|null>} Imagen en base64 (dataURL) o null si falla.
 */
async function captureMapSnapshot() {
  if (typeof window === 'undefined') return null;
  try {
    const mapElement = document.querySelector('.map-container') || document.querySelector('.leaflet-container');
    if (!mapElement) return null;

    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(mapElement, {
      useCORS: true,
      allowTaint: true,
      logging: false,
      scale: 1.2
    });
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('No se pudo capturar la imagen del mapa:', err);
    return null;
  }
}

/**
 * Exporta el listado de fallas a un archivo Excel (.xlsx) avanzado con ExcelJS.
 * Incluye la imagen del mapa en la parte superior (filas 4 a 18) y la tabla de fallas iniciando en la fila 20.
 * 
 * @param {Array} pointsList - Lista de puntos de falla filtrados.
 * @param {string|null} currentSedId - ID de la SED actual.
 * @param {string|null} currentLlaveId - Código de la Llave actual.
 */
export async function exportExcelBySed(pointsList = [], currentSedId = null, currentLlaveId = null) {
  if (!pointsList || pointsList.length === 0) {
    alert('⚠️ No hay registros de fallas para exportar con los filtros actuales.');
    return;
  }

  try {
    // Captura del mapa antes de generar el libro
    const mapBase64 = await captureMapSnapshot();

    // Agrupar los registros por SED
    const sedsGrouped = {};
    pointsList.forEach(pt => {
      let rawSed = pt.sed || (pt.sedLlave ? pt.sedLlave.split('-')[0].trim() : '') || 'GENERAL';
      let cleanSedKey = rawSed
        .replace(/^SED\s+/i, '')
        .replace(/^Subestación\s+/i, '')
        .trim() || 'GENERAL';

      if (!sedsGrouped[cleanSedKey]) {
        sedsGrouped[cleanSedKey] = [];
      }
      sedsGrouped[cleanSedKey].push(pt);
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GEOPLUZ Emergencias';
    workbook.created = new Date();

    let sedKeys = Object.keys(sedsGrouped);
    const cleanCurrentSed = currentSedId
      ? currentSedId.replace(/^SED\s+/i, '').replace(/^Subestación\s+/i, '').trim()
      : null;
    const cleanCurrentLlave = currentLlaveId
      ? currentLlaveId.split('/').pop().trim()
      : null;

    if (cleanCurrentSed && sedsGrouped[cleanCurrentSed]) {
      sedKeys = sedKeys.filter(k => k !== cleanCurrentSed);
      sedKeys.unshift(cleanCurrentSed);
    }

    sedKeys.forEach((sedKey) => {
      const rows = sedsGrouped[sedKey];
      let sheetTitle = `SED ${sedKey}`;
      if (cleanCurrentLlave && sedKeys.length === 1) {
        sheetTitle += ` (${cleanCurrentLlave})`;
      }
      const sheetName = sheetTitle.substring(0, 31);
      const ws = workbook.addWorksheet(sheetName);

      // 1. BANNER PRINCIPAL (Fila 1)
      ws.mergeCells('A1:K1');
      const titleCell = ws.getCell('A1');
      titleCell.value = `📍 REPORTE GEOPLUZ EMERGENCIAS - SED ${sedKey}${cleanCurrentLlave ? ` | LLAVE ${cleanCurrentLlave}` : ''}`;
      titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A5276' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(1).height = 28;

      // 2. SUBTÍTULO / METADATOS (Fila 2)
      ws.mergeCells('A2:K2');
      const infoCell = ws.getCell('A2');
      infoCell.value = `Total Incidencias Registradas: ${rows.length} | Fecha de Exportación: ${new Date().toLocaleString()}`;
      infoCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF333333' } };
      infoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAECEE' } };
      infoCell.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(2).height = 20;

      // 3. INSERCIÓN DE IMAGEN DEL MAPA (Filas 4 a 18)
      if (mapBase64) {
        try {
          const imageId = workbook.addImage({
            base64: mapBase64,
            extension: 'png',
          });

          ws.addImage(imageId, {
            tl: { col: 0.2, row: 3.2 },
            br: { col: 9.8, row: 18.2 },
            editAs: 'oneCell'
          });
        } catch (imgErr) {
          console.warn('No se pudo incrustar la imagen en la hoja:', imgErr);
        }
      }

      // 4. TITULO DE SECCIÓN TABLA (Fila 19)
      ws.mergeCells('A19:K19');
      const secCell = ws.getCell('A19');
      secCell.value = `📋 LISTADO Y DETALLE DE REGISTRO DE FALLAS REPARADAS`;
      secCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1A5276' } };
      secCell.alignment = { vertical: 'middle', horizontal: 'left' };
      ws.getRow(19).height = 22;

      // 5. ENCABEZADOS DE LA TABLA (Fila 20)
      const headers = [
        'NRO', 'TICKET', 'SED-LLAVE', 'FALLA REAL', 'CAUSA',
        'NOTA ESPECÍFICA', 'CROQUIS', 'SUMINISTRO', 'EVIDENCIAS', 'COORDENADAS', 'ESTADO'
      ];
      const headerRow = ws.getRow(20);
      headers.forEach((h, colIdx) => {
        const cell = headerRow.getCell(colIdx + 1);
        cell.value = h;
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E86DE' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF1A5276' } },
          bottom: { style: 'medium', color: { argb: 'FF1A5276' } },
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
        };
      });
      headerRow.height = 24;

      // 6. DATOS DE LA TABLA (Filas 21 en adelante)
      rows.forEach((r, idx) => {
        const rowNum = 21 + idx;
        const row = ws.getRow(rowNum);
        const isEven = idx % 2 === 0;
        const bgArgb = isEven ? 'FFFFFFFF' : 'FFF2F4F4';

        const coordsStr = r.coords && Array.isArray(r.coords) && !isNaN(r.coords[0]) && !isNaN(r.coords[1])
          ? `${r.coords[0].toFixed(6)}, ${r.coords[1].toFixed(6)}`
          : (r.latitud && r.longitud ? `${r.latitud.toFixed(6)}, ${r.longitud.toFixed(6)}` : 'Sin GPS');

        const fotosCount = r.fotos ? r.fotos.length : 0;
        const evidenciaStr = fotosCount > 0 ? `${fotosCount} foto(s)` : 'Sin foto';

        const rowValues = [
          r.localNumber || idx + 1,
          r.ticket || '',
          r.sedLlave || `${sedKey}-${r.llaveSistema || ''}`,
          r.falla || r.fallaReal || '',
          r.causa || '',
          r.nota || '',
          r.linkCroquis || r.link_croquis || r.croquis || '-',
          r.suministro || '',
          evidenciaStr,
          coordsStr,
          'Atendido'
        ];

        rowValues.forEach((val, colIdx) => {
          const cell = row.getCell(colIdx + 1);
          cell.value = val;
          cell.font = { name: 'Calibri', size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
          cell.alignment = {
            vertical: 'middle',
            horizontal: [0, 1, 2, 8, 10].includes(colIdx) ? 'center' : 'left'
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7E9' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7E9' } },
            left: { style: 'thin', color: { argb: 'FFE5E7E9' } },
            right: { style: 'thin', color: { argb: 'FFE5E7E9' } }
          };
        });
        row.height = 20;
      });

      // 7. ANCHO DE COLUMNAS
      ws.columns = [
        { width: 8 },   // NRO
        { width: 16 },  // TICKET
        { width: 18 },  // SED-LLAVE
        { width: 28 },  // FALLA REAL
        { width: 24 },  // CAUSA
        { width: 32 },  // NOTA ESPECÍFICA
        { width: 35 },  // CROQUIS
        { width: 16 },  // SUMINISTRO
        { width: 14 },  // EVIDENCIAS
        { width: 25 },  // COORDENADAS
        { width: 12 }   // ESTADO
      ];
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    let fileName = 'GEOPLUZ_FALLAS';
    if (cleanCurrentSed && cleanCurrentLlave) {
      fileName += `_SED_${cleanCurrentSed}_LLAVE_${cleanCurrentLlave}_${dateStr}.xlsx`;
    } else if (cleanCurrentSed) {
      fileName += `_SED_${cleanCurrentSed}_${dateStr}.xlsx`;
    } else {
      fileName += `_POR_SED_${dateStr}.xlsx`;
    }

    // Generación del Blob y descarga en el navegador
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('❌ Error al exportar Excel con mapa: ' + err.message);
  }
}
