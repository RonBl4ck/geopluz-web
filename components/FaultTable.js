'use client';

import { useState } from 'react';
import { getCauseCategory } from '@/lib/constants';

export default function FaultTable({
  points = [],
  showActions = false,
  onEdit,
  onDelete,
  onRelocate,
  onRowClick,
  className = ''
}) {
  const [selectedGallery, setSelectedGallery] = useState(null);

  if (points.length === 0) {
    return (
      <table className={`points-table ${className}`}>
        <thead>
          <tr>
            <th>NRO</th>
            <th>TICKET</th>
            <th>SED-LLAVE</th>
            <th>FALLA REAL</th>
            <th>CAUSA</th>
            <th>SUMINISTRO</th>
            <th>EVIDENCIA</th>
            <th>ACCIÓN</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              No hay registros marcados.
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <>
      <table className={`points-table ${className}`}>
        <thead>
          <tr>
            <th>NRO</th>
            <th>TICKET</th>
            <th>SED-LLAVE</th>
            <th>FALLA REAL</th>
            <th>CAUSA</th>
            <th>NOTA ESPECÍFICA</th>
            <th>CROQUIS</th>
            <th>SUMINISTRO</th>
            <th>EVIDENCIA</th>
            <th>ACCIÓN</th>
          </tr>
        </thead>
        <tbody>
          {points.map((pt, idx) => {
            const displayNum = pt.localNumber || pt.number;
            const isMulti = pt.coords && Array.isArray(pt.coords[0]);
            const hasCoords = pt.coords && (isMulti ? pt.coords.length > 0 : (!isNaN(pt.coords[0]) && !isNaN(pt.coords[1])));
            const fotosCount = pt.fotos ? pt.fotos.length : 0;
            const causeCat = getCauseCategory(pt.causa);

            return (
              <tr 
                key={idx} 
                onClick={() => onRowClick && onRowClick(pt)}
                className={onRowClick ? 'pres-table-row' : ''}
              >
                <td>
                  <b style={{ color: 'var(--accent-danger)' }}>({displayNum})</b>
                </td>
                <td>
                  {pt.ticket} {isMulti && <span style={{ color: '#ed6c02', fontSize: '9.5px', fontWeight: 'bold' }}>[📍 2 Puntos]</span>} {!hasCoords && <span style={{ color: 'red', fontSize: '9px' }}>[Sin GPS]</span>}
                </td>
                <td>{pt.sedLlave}</td>
                <td>{pt.falla || pt.fallaReal}</td>
                <td>
                  {pt.causa ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      backgroundColor: causeCat.color,
                      color: causeCat.textColor || '#ffffff',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }}>
                      {pt.causa}
                    </span>
                  ) : '-'}
                </td>

                <td style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{pt.nota || '-'}</td>
                <td>
                  {(pt.linkCroquis || pt.link_croquis || pt.croquis) ? (
                    <a
                      href={pt.linkCroquis || pt.link_croquis || pt.croquis}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: 'var(--accent-cyan)', fontWeight: 'bold', textDecoration: 'underline', fontSize: '11px' }}
                    >
                      🗺️ Ver Croquis ↗
                    </a>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>-</span>
                  )}
                </td>
                <td>{pt.suministro}</td>
                <td>
                  {fotosCount > 0 ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedGallery(pt); }}
                      style={{ background: 'rgba(0, 229, 255, 0.15)', border: '1px solid var(--accent-cyan)', color: 'var(--accent-cyan)', borderRadius: '12px', padding: '2px 8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                      title="Ver Evidencias Fotográficas"
                    >
                      <i className="fa-solid fa-camera"></i> {fotosCount} foto(s)
                    </button>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Sin foto</span>
                  )}
                </td>
                <td>
                  {showActions ? (
                    <>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onRelocate && onRelocate(pt.originalIndex !== undefined ? pt.originalIndex : idx); }} 
                        title={hasCoords ? 'Reubicar en Mapa' : 'Ubicar en Mapa'} 
                        style={{ background: 'none', border: 'none', color: 'var(--accent-warning)', cursor: 'pointer', marginRight: '6px' }}
                      >
                        <i className="fa-solid fa-crosshairs"></i> {hasCoords ? 'Reubicar' : '📍 Ubicar'}
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onEdit && onEdit(pt.originalIndex !== undefined ? pt.originalIndex : idx); }} 
                        title="Editar Datos" 
                        style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', marginRight: '6px' }}
                      >
                        <i className="fa-solid fa-pen-to-square"></i>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDelete && onDelete(pt.originalIndex !== undefined ? pt.originalIndex : idx); }} 
                        title="Eliminar Registro" 
                        style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer' }}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </>
                  ) : (
                    <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>Atendido</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Modal Galería Fotográfica de Evidencia */}
      {selectedGallery && (
        <div className="modal-backdrop active" style={{ zIndex: 10005 }}>
          <div className="point-form-modal" style={{ width: '640px', background: 'var(--bg-secondary)' }}>
            <h3 style={{ color: 'var(--accent-cyan)', fontSize: '14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
              <span>📸 Evidencias Fotográficas: Ticket {selectedGallery.ticket}</span>
              <span onClick={() => setSelectedGallery(null)} style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</span>
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', maxHeight: '400px', overflowY: 'auto', padding: '6px' }}>
              {selectedGallery.fotos.map((foto, i) => (
                <div key={i} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
                  <a href={foto.url} target="_blank" rel="noopener noreferrer">
                    <img src={foto.url} alt={foto.name} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                  </a>
                  <div style={{ padding: '6px', fontSize: '10px', color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {foto.name}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button className="btn btn-outline" style={{ width: 'auto', padding: '6px 16px' }} onClick={() => setSelectedGallery(null)}>
                Cerrar Galería
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
