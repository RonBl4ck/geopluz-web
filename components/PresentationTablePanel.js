'use client';

import FaultTable from './FaultTable';

export default function PresentationTablePanel({ points, onRowClick }) {
  const count = points ? points.length : 0;
  
  return (
    <div className="presentation-table-panel">
      <div className="pres-table-header">
        <span>📊 Registro de Fallas Atendidas en esta SED (<span>{count}</span>)</span>
        <span style={{ fontSize: '10px', color: 'var(--accent-cyan)' }}>Haz clic en una fila para volar al punto</span>
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
