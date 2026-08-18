import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FAULT_CAUSES } from './constants';

/**
 * Captura la vista actual del mapa en la interfaz usando html2canvas.
 * @returns {Promise<string|null>} Imagen en base64 (dataURL) o null si falla.
 */
export async function captureMapSnapshot() {
  if (typeof window === 'undefined') return null;
  try {
    const mapElement = document.querySelector('.map-container') || document.querySelector('.leaflet-container');
    if (!mapElement) return null;

    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(mapElement, {
      useCORS: true,
      allowTaint: false,
      logging: false,
      scale: 1.5,
      ignoreElements: (el) => {
        return (
          el.classList?.contains('leaflet-control-container') ||
          el.classList?.contains('leaflet-control-zoom') ||
          el.classList?.contains('presentation-hud') ||
          el.classList?.contains('presentation-table-panel') ||
          el.classList?.contains('hud-container')
        );
      }
    });
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('No se pudo capturar la imagen del mapa:', err);
    return null;
  }
}

/**
 * Genera y descarga un reporte PDF profesional con el circuito, puntos de falla y tabla detallada.
 * 
 * @param {Array} pointsList - Lista de puntos de falla.
 * @param {string|null} currentSedId - ID o nombre de la SED.
 * @param {string|null} currentLlaveId - Código de la Llave.
 * @param {Object} extraInfo - Información adicional (estado del circuito, notas, etc.)
 */
export async function exportPdfReport(pointsList = [], currentSedId = null, currentLlaveId = null, extraInfo = {}) {
  if (!pointsList || pointsList.length === 0) {
    alert('⚠️ No hay registros de fallas para exportar con los filtros actuales.');
    return;
  }

  try {
    // 1. Capturar imagen del mapa con circuito y puntos
    const mapBase64 = await captureMapSnapshot();

    const cleanSed = (currentSedId || 'GENERAL')
      .replace(/^SED\s+/i, '')
      .replace(/^Subestación\s+/i, '')
      .trim();
    const cleanLlave = currentLlaveId
      ? currentLlaveId.split('/').pop().trim()
      : null;

    // 2. Crear documento PDF en formato horizontal (Landscape) A4
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm
    const margin = 12;

    // 3. ENCABEZADO CORPORATIVO
    doc.setFillColor(15, 41, 66); // #0f2942
    doc.rect(margin, 10, pageWidth - (margin * 2), 18, 'F');

    // Título
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    const titleText = `GEOPLUZ EMERGENCIAS - REPORTE TÉCNICO DE FALLAS | SED ${cleanSed}${cleanLlave ? ` - LLAVE ${cleanLlave}` : ''}`;
    doc.text(titleText, margin + 6, 19);

    // Metadatos
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(200, 225, 250);
    const nowStr = new Date().toLocaleString();
    const subtitleText = `Total Incidencias: ${pointsList.length} | Fecha de Emisión: ${nowStr} | Sistema: GEOPLUZ Web`;
    doc.text(subtitleText, margin + 6, 25);

    let currentY = 32;

    // 4. INSERCIÓN DEL MAPA DEL CIRCUITO
    if (mapBase64) {
      const imgWidth = pageWidth - (margin * 2);
      const imgHeight = 88;

      // Marco
      doc.setDrawColor(180, 200, 220);
      doc.setLineWidth(0.4);
      doc.rect(margin, currentY, imgWidth, imgHeight);

      // Imagen del circuito con puntos
      doc.addImage(mapBase64, 'PNG', margin, currentY, imgWidth, imgHeight, undefined, 'FAST');

      currentY += imgHeight + 4;

      // Mini Leyenda de Causas bajo el mapa
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('Leyenda de Causas:', margin, currentY + 3);

      let legendX = margin + 30;
      const topCauses = FAULT_CAUSES.slice(0, 6);
      topCauses.forEach(cause => {
        const hex = cause.color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.substring(4, 6), 16) || 0;

        doc.setFillColor(r, g, b);
        doc.circle(legendX + 2, currentY + 2.2, 1.8, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(50, 50, 50);
        doc.text(cause.label, legendX + 5, currentY + 3);
        legendX += doc.getTextWidth(cause.label) + 12;
      });

      currentY += 8;
    }

    // 5. TABLA DE FALLAS CON AUTOTABLE
    const tableColumns = [
      { header: 'N°', dataKey: 'num' },
      { header: 'TICKET', dataKey: 'ticket' },
      { header: 'SED-LLAVE', dataKey: 'sedLlave' },
      { header: 'FALLA REAL', dataKey: 'falla' },
      { header: 'CAUSA', dataKey: 'causa' },
      { header: 'NOTA / DETALLE', dataKey: 'nota' },
      { header: 'SUMINISTRO', dataKey: 'suministro' },
      { header: 'COORDENADAS', dataKey: 'coords' },
      { header: 'CROQUIS', dataKey: 'croquis' }
    ];

    const tableRows = pointsList.map((pt, idx) => {
      const coordsStr = pt.coords && Array.isArray(pt.coords) && !isNaN(pt.coords[0]) && !isNaN(pt.coords[1])
        ? `${pt.coords[0].toFixed(5)}, ${pt.coords[1].toFixed(5)}`
        : (pt.latitud && pt.longitud ? `${pt.latitud.toFixed(5)}, ${pt.longitud.toFixed(5)}` : '-');

      const rawSed = pt.sed || (pt.sedLlave ? pt.sedLlave.split('-')[0].trim() : cleanSed);
      const llavePart = pt.llaveSistema || (pt.sedLlave ? pt.sedLlave.split('-')[1]?.trim() : cleanLlave || '');
      const sedLlaveLabel = `${rawSed}${llavePart ? `-${llavePart}` : ''}`;

      const croquisLink = pt.linkCroquis || pt.link_croquis || pt.croquis || '';

      return {
        num: pt.localNumber || idx + 1,
        ticket: pt.ticket || '-',
        sedLlave: sedLlaveLabel,
        falla: pt.falla || pt.fallaReal || '-',
        causa: pt.causa || 'NO DETERMINADO',
        nota: pt.nota || '-',
        suministro: pt.suministro || '-',
        coords: coordsStr,
        croquis: croquisLink ? 'Croquis Disponible' : '-'
      };
    });

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin, bottom: 12 },
      columns: tableColumns,
      body: tableRows,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        overflow: 'linebreak',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [26, 82, 118], // #1a5276
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 8
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      columnStyles: {
        num: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
        ticket: { cellWidth: 22, halign: 'center' },
        sedLlave: { cellWidth: 24, halign: 'center' },
        falla: { cellWidth: 46 },
        causa: { cellWidth: 32 },
        nota: { cellWidth: 62 },
        suministro: { cellWidth: 22, halign: 'center' },
        coords: { cellWidth: 30, halign: 'center', fontSize: 6.8 },
        croquis: { cellWidth: 25, halign: 'center' }
      },
      didDrawPage: function (data) {
        const str = `Página ${doc.internal.getNumberOfPages()}`;
        doc.setFontSize(8);
        doc.setTextColor(130, 130, 130);
        doc.text(str, pageWidth - margin - 20, pageHeight - 6);
        doc.text('GEOPLUZ - Reporte de Emergencias', margin, pageHeight - 6);
      }
    });

    // 6. Nombre del archivo y descarga
    const dateStr = new Date().toISOString().slice(0, 10);
    let fileName = `GEOPLUZ_REPORTE_SED_${cleanSed}`;
    if (cleanLlave) {
      fileName += `_LLAVE_${cleanLlave}`;
    }
    fileName += `_${dateStr}.pdf`;

    doc.save(fileName);
  } catch (err) {
    console.error('Error al generar el reporte PDF:', err);
    alert('❌ Error al exportar Reporte PDF: ' + err.message);
  }
}
