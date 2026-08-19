'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getCauseCategory } from '@/lib/constants';

function CauseBadge({ value }) {
  if (!value) return '-';
  const category = getCauseCategory(value);
  return <span className="cause-badge" style={{ backgroundColor: category.color, color: category.textColor || '#fff' }}>{value}</span>;
}

export default function FaultTable({ points = [], showActions = false, onEdit, onDelete, onRelocate, onRowClick, onFullViewChange, className = '' }) {
  const [selectedGallery, setSelectedGallery] = useState(null);
  const [showFullView, setShowFullView] = useState(false);

  useEffect(() => {
    onFullViewChange?.(showFullView);
    return () => onFullViewChange?.(false);
  }, [showFullView, onFullViewChange]);

  useEffect(() => {
    if (!showFullView) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setShowFullView(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [showFullView]);

  function renderActions(pt, idx, hasCoords) {
    if (!showActions) return null;
    const pointIndex = pt.originalIndex !== undefined ? pt.originalIndex : idx;
    return <div className="fault-row-actions">
      <button onClick={(e) => { e.stopPropagation(); onRelocate?.(pointIndex); }} title={hasCoords ? 'Reubicar en mapa' : 'Ubicar en mapa'}><i className="fa-solid fa-crosshairs"></i></button>
      <button onClick={(e) => { e.stopPropagation(); onEdit?.(pointIndex); }} title="Editar datos"><i className="fa-solid fa-pen-to-square"></i></button>
      <button className="danger" onClick={(e) => { e.stopPropagation(); onDelete?.(pointIndex); }} title="Eliminar registro"><i className="fa-solid fa-trash"></i></button>
    </div>;
  }

  function renderRows(full = false) {
    return points.map((pt, idx) => {
      const displayNum = pt.localNumber || pt.number || idx + 1;
      const isMulti = Array.isArray(pt.coords?.[0]);
      const hasCoords = Boolean(pt.coords && (isMulti ? pt.coords.length : !isNaN(pt.coords[0]) && !isNaN(pt.coords[1])));
      const croquis = pt.linkCroquis || pt.link_croquis || pt.croquis;
      const fotosCount = pt.fotos?.length || 0;
      return <tr key={pt.id || pt.ticket || idx} onClick={() => onRowClick?.(pt)} className={onRowClick ? 'pres-table-row' : ''}>
        <td><b className="fault-number">{displayNum}</b></td>
        <td className="ticket-cell">{pt.ticket || '-'}{isMulti && <small>2 puntos</small>}{!hasCoords && <small className="warning">Sin GPS</small>}</td>
        <td>{pt.horaInicio || '-'}</td>
        {full && <td>{pt.sedLlave || `${pt.sed || ''}-${pt.llaveSistema || ''}`}</td>}
        {full && <td>{pt.falla || pt.fallaReal || '-'}</td>}
        <td className="cause-cell"><CauseBadge value={pt.causa} /></td>
        {full && <td>{pt.suministro || '-'}</td>}
        {full && <td className="detail-text">{pt.nota || '-'}</td>}
        <td>{croquis ? <a href={croquis} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="table-link">Ver</a> : '-'}</td>
        {full && <td>{fotosCount ? <button className="table-link-button" onClick={(e) => { e.stopPropagation(); setSelectedGallery(pt); }}><i className="fa-solid fa-camera"></i> {fotosCount}</button> : 'Sin foto'}</td>}
        {showActions && <td>{renderActions(pt, idx, hasCoords)}</td>}
      </tr>;
    });
  }

  return <>
    <div className="fault-table-toolbar">
      <span>{points.length} {points.length === 1 ? 'registro' : 'registros'}</span>
      <button className="secondary-action" onClick={() => setShowFullView(true)} disabled={!points.length}><i className="fa-solid fa-table-columns"></i> Vista completa</button>
    </div>
    <table className={`points-table points-table-compact ${className}`}>
      <thead><tr><th>NRO</th><th>TICKET</th><th>INICIO</th><th>CAUSA</th><th>CROQUIS</th>{showActions && <th>ACCIONES</th>}</tr></thead>
      <tbody>{points.length ? renderRows(false) : <tr><td colSpan={showActions ? 6 : 5} className="empty-table">No hay registros marcados.</td></tr>}</tbody>
    </table>

    {showFullView && typeof document !== 'undefined' && createPortal(<div className="modal-backdrop active fault-full-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowFullView(false)}>
      <div className="fault-full-modal">
        <div className="modal-heading"><div><h3>Registro de fallas</h3><span>{points.length} registros · información completa</span></div><button className="icon-button" onClick={() => setShowFullView(false)} title="Cerrar"><i className="fa-solid fa-xmark"></i></button></div>
        <div className="fault-full-table-wrap"><table className="points-table points-table-full">
          <thead><tr><th>NRO</th><th>TICKET</th><th>INICIO</th><th>SED-LLAVE</th><th>FALLA REAL</th><th>CAUSA</th><th>SUMINISTRO</th><th>NOTA</th><th>CROQUIS</th><th>EVIDENCIA</th>{showActions && <th>ACCIONES</th>}</tr></thead>
          <tbody>{renderRows(true)}</tbody>
        </table></div>
      </div>
    </div>, document.body)}

    {selectedGallery && <div className="modal-backdrop active" style={{ zIndex: 10005 }}>
      <div className="point-form-modal evidence-modal">
        <div className="modal-heading"><div><h3>Evidencias fotográficas</h3><span>Ticket {selectedGallery.ticket}</span></div><button className="icon-button" onClick={() => setSelectedGallery(null)} title="Cerrar"><i className="fa-solid fa-xmark"></i></button></div>
        <div className="evidence-grid">{selectedGallery.fotos.map((foto, i) => <a key={i} href={foto.url} target="_blank" rel="noopener noreferrer" className="evidence-item"><img src={foto.url} alt={foto.name || `Evidencia ${i + 1}`} /><span>{foto.name || `Evidencia ${i + 1}`}</span></a>)}</div>
      </div>
    </div>}
  </>;
}
