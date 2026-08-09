'use client';

import FaultTable from './FaultTable';

export default function PresentationTablePanel({ points, onRowClick, onExportExcel }) {
  const count = points ? points.length : 0;
  
  return (
    <div className="presentation-table-panel">
      <div className="pres-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>📊 Registro de Fallas Atendidas en esta SED (<span>{count}</span>)</span>
          <span style={{ fontSize: '10px', color: 'var(--accent-cyan)' }}>Haz clic en una fila para volar al punto</span>
        </div>
        {onExportExcel && (
          <button
            onClick={onExportExcel}
            style={{
              background: 'linear-gradient(135deg, #2e7d32, #1b5e20)',
              color: '#ffffff',
              border: '1px solid #4caf50',
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'all 0.2s ease'
            }}
            title="Descargar tabla de fallas en Excel agrupada por SED"
          >
            <i className="fa-solid fa-file-excel"></i> Descargar Excel por SED
          </button>
        )}
      </div>
      <div className="pres-table-body">
        <FaultTable 
          points={points} 
          showActions={false} 
          onRowClick={onRowClick} 
        />
      </div>
    </div>
  );
}
