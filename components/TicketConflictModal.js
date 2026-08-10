'use client';

import { useState } from 'react';

export default function TicketConflictModal({
  isOpen,
  conflicts = [],
  onResolveAll
}) {
  // Store decisions per ticket: 'A' (Registro Existente) or 'B' (Nuevo Registro del JSON)
  const [decisions, setDecisions] = useState({});

  if (!isOpen || !conflicts || conflicts.length === 0) return null;

  const getDecision = (ticketKey) => decisions[ticketKey] || 'A'; // default to A

  const setTicketDecision = (ticketKey, choice) => {
    setDecisions(prev => ({ ...prev, [ticketKey]: choice }));
  };

  const handleApplyAll = (choice) => {
    const updated = {};
    conflicts.forEach(c => {
      updated[c.ticketKey] = choice;
    });
    setDecisions(updated);
  };

  const handleConfirm = () => {
    const finalDecisions = {};
    conflicts.forEach(c => {
      finalDecisions[c.ticketKey] = decisions[c.ticketKey] || 'A';
    });
    onResolveAll(finalDecisions);
  };

  const countA = conflicts.filter(c => getDecision(c.ticketKey) === 'A').length;
  const countB = conflicts.filter(c => getDecision(c.ticketKey) === 'B').length;

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ width: '860px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ background: '#0077c2', color: '#fff', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '24px', color: '#ffb74d' }}></i>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                Este archivo JSON contiene tickets que ya están registrados
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '13px', opacity: 0.95 }}>
                Selecciona con cuál de los 2 datos deseas quedarte para cada ticket duplicado.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Bar */}
        <div style={{
          padding: '12px 20px',
          background: 'rgba(0, 119, 194, 0.06)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
            <i className="fa-solid fa-sliders" style={{ color: 'var(--accent-cyan)', marginRight: '6px' }}></i>
            Selección en lote para los {conflicts.length} tickets duplicados:
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn"
              style={{ fontSize: '12px', padding: '6px 14px', background: 'rgba(0, 119, 194, 0.15)', border: '1px solid #0077c2', color: 'var(--text-main)', fontWeight: 600 }}
              onClick={() => handleApplyAll('A')}
            >
              <i className="fa-solid fa-circle-check" style={{ marginRight: '6px', color: '#0077c2' }}></i>
              Quedarme con todos los Existentes (A)
            </button>
            <button
              type="button"
              className="btn"
              style={{ fontSize: '12px', padding: '6px 14px', background: 'rgba(237, 108, 2, 0.15)', border: '1px solid #ed6c02', color: 'var(--text-main)', fontWeight: 600 }}
              onClick={() => handleApplyAll('B')}
            >
              <i className="fa-solid fa-file-import" style={{ marginRight: '6px', color: '#ed6c02' }}></i>
              Quedarme con todos los Nuevos del JSON (B)
            </button>
          </div>
        </div>

        {/* Conflict Items List */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {conflicts.map((c, index) => {
            const ticketKey = c.ticketKey;
            const existing = c.existing;
            const incoming = c.incoming;
            const currentChoice = getDecision(ticketKey);

            return (
              <div key={ticketKey || index} style={{
                background: 'var(--bg-secondary)',
                border: `2px solid ${currentChoice === 'B' ? '#ed6c02' : '#0077c2'}`,
                borderRadius: '10px',
                marginBottom: '16px',
                overflow: 'hidden',
                boxShadow: '0 4px 15px rgba(0,0,0,0.06)'
              }}>
                {/* Item Banner */}
                <div style={{
                  padding: '10px 16px',
                  background: currentChoice === 'B' ? 'rgba(237, 108, 2, 0.12)' : 'rgba(0, 119, 194, 0.12)',
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <strong style={{ fontSize: '15px', color: 'var(--text-main)' }}>
                      <i className="fa-solid fa-ticket" style={{ marginRight: '6px', color: 'var(--accent-cyan)' }}></i>
                      Ticket N°: {existing.ticket || incoming.ticket}
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      (SED/Llave: {existing.sedLlave || incoming.sedLlave || 'N/A'})
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', fontWeight: 700 }}>
                    {currentChoice === 'A' ? (
                      <span style={{ color: '#0077c2' }}>
                        <i className="fa-solid fa-circle-check"></i> Te quedas con REGISTRO EXISTENTE (A)
                      </span>
                    ) : (
                      <span style={{ color: '#ed6c02' }}>
                        <i className="fa-solid fa-file-import"></i> Te quedas con NUEVO DEL JSON (B)
                      </span>
                    )}
                  </div>
                </div>

                {/* Question Prompt */}
                <div style={{ padding: '10px 16px 4px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Este ticket ya tiene un registro. ¿Con cuál de los dos datos deseas quedarte?
                </div>

                {/* Side-by-Side 2 Choices */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', padding: '12px 16px 16px 16px' }}>
                  
                  {/* DATO A (REGISTRO EXISTENTE) */}
                  <div 
                    onClick={() => setTicketDecision(ticketKey, 'A')}
                    style={{
                      background: currentChoice === 'A' ? 'rgba(0, 119, 194, 0.08)' : 'var(--bg-primary)',
                      border: currentChoice === 'A' ? '2px solid #0077c2' : '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#0077c2' }}>
                        <i className="fa-solid fa-database" style={{ marginRight: '6px' }}></i>
                        DATO A: Registro Existente
                      </span>
                      <input 
                        type="radio" 
                        name={`decision-${ticketKey}`} 
                        checked={currentChoice === 'A'} 
                        onChange={() => setTicketDecision(ticketKey, 'A')}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '5px', color: 'var(--text-main)' }}>
                      <div><strong>Hora Registro:</strong> {existing.horaInicio || 'Sin fecha'}</div>
                      <div><strong>Falla Real:</strong> {existing.falla || 'N/A'}</div>
                      <div><strong>Causa:</strong> {existing.causa || 'N/A'}</div>
                      <div><strong>Nota / Observación:</strong> <span style={{ fontStyle: 'italic' }}>{existing.nota || 'Sin notas'}</span></div>
                      <div><strong>Fotos anexas:</strong> {existing.fotos?.length || 0} foto(s)</div>
                    </div>
                    <div style={{
                      marginTop: '10px',
                      padding: '6px',
                      borderRadius: '4px',
                      textAlign: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: currentChoice === 'A' ? '#0077c2' : 'transparent',
                      color: currentChoice === 'A' ? '#ffffff' : 'var(--text-muted)',
                      border: '1px solid #0077c2'
                    }}>
                      {currentChoice === 'A' ? '✓ SELECCIONADO PARA CONSERVAR' : 'Haga clic para elegir el Dato A'}
                    </div>
                  </div>

                  {/* DATO B (NUEVO REGISTRO DEL JSON) */}
                  <div 
                    onClick={() => setTicketDecision(ticketKey, 'B')}
                    style={{
                      background: currentChoice === 'B' ? 'rgba(237, 108, 2, 0.08)' : 'var(--bg-primary)',
                      border: currentChoice === 'B' ? '2px solid #ed6c02' : '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#ed6c02' }}>
                        <i className="fa-solid fa-file-code" style={{ marginRight: '6px' }}></i>
                        DATO B: Nuevo en JSON
                      </span>
                      <input 
                        type="radio" 
                        name={`decision-${ticketKey}`} 
                        checked={currentChoice === 'B'} 
                        onChange={() => setTicketDecision(ticketKey, 'B')}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '5px', color: 'var(--text-main)' }}>
                      <div><strong>Hora Registro:</strong> {incoming.horaInicio || 'Sin fecha'}</div>
                      <div><strong>Falla Real:</strong> {incoming.falla || 'N/A'}</div>
                      <div><strong>Causa:</strong> {incoming.causa || 'N/A'}</div>
                      <div><strong>Nota / Observación:</strong> <span style={{ fontStyle: 'italic' }}>{incoming.nota || 'Sin notas'}</span></div>
                      <div><strong>Fotos anexas:</strong> {incoming.fotos?.length || 0} foto(s)</div>
                    </div>
                    <div style={{
                      marginTop: '10px',
                      padding: '6px',
                      borderRadius: '4px',
                      textAlign: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: currentChoice === 'B' ? '#ed6c02' : 'transparent',
                      color: currentChoice === 'B' ? '#ffffff' : 'var(--text-muted)',
                      border: '1px solid #ed6c02'
                    }}>
                      {currentChoice === 'B' ? '✓ SELECCIONADO PARA REEMPLAZAR' : 'Haga clic para elegir el Dato B'}
                    </div>
                  </div>

                </div>

              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{
          padding: '14px 20px',
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Te quedas con: <strong style={{ color: '#0077c2' }}>{countA} Existentes (A)</strong> | <strong style={{ color: '#ed6c02' }}>{countB} Nuevos del JSON (B)</strong>
          </div>
          <button
            className="btn btn-green"
            style={{ padding: '9px 22px', fontSize: '13px', fontWeight: 700 }}
            onClick={handleConfirm}
          >
            <i className="fa-solid fa-check-double" style={{ marginRight: '8px' }}></i>
            Confirmar y Aplicar Selección
          </button>
        </div>

      </div>
    </div>
  );
}
