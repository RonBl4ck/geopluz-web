'use client';
import { useState, useRef, useEffect } from 'react';
import { CIRCUIT_STATUSES } from '@/lib/circuitAnalysis';

export default function PresentationHUD({ sedId, sedName, llaveName, sedsList = [], localDatabase = {}, circuitEntries = [], circuitStatus = 'cargado', onSelectSed, onSelectLlave, onSelectCircuit, currentMapStyle, onPrevSed, onNextSed, onToggleMapStyle, onEnterEditMode }) {
  const [searchText, setSearchText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [statusFilter, setStatusFilter] = useState('todos');
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const cleanSed = (sedName || sedId || 'Sin SED').replace(/^SED\s+/i, '').replace(/^Subestación\s+/i, '').replace(/^SED\s+/i, '');
  const availableLlaves = sedId && localDatabase[sedId]?.llaves ? Object.keys(localDatabase[sedId].llaves) : [];
  const activeStatus = CIRCUIT_STATUSES[circuitStatus] || CIRCUIT_STATUSES.cargado;
  const search = searchText.trim().toLowerCase();
  const filtered = circuitEntries.filter(circuit => (statusFilter === 'todos' || circuit.status === statusFilter) && (!search || `${circuit.sedId} ${circuit.sedName} ${circuit.llaveId}`.toLowerCase().includes(search)));

  useEffect(() => {
    function handleClickOutside(e) { if (containerRef.current && !containerRef.current.contains(e.target)) setShowSuggestions(false); }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(circuit) {
    setSearchText('');
    setShowSuggestions(false);
    if (onSelectCircuit) onSelectCircuit(circuit.sedId, circuit.llaveId);
    else if (onSelectSed) onSelectSed(circuit.sedId);
  }

  return <div className="presentation-hud">
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><img src="/PLUZ.png" alt="PLUZ" style={{ height: '22px', objectFit: 'contain' }} /><div className="hud-badge"><i className="fa-solid fa-desktop"></i> PRESENTACIÓN</div></div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div className="hud-title"><span>SED {cleanSed}</span> | {availableLlaves.length > 1 ? <select value={llaveName || ''} onChange={(e) => onSelectLlave?.(e.target.value)} style={{ background: 'transparent', border: '1px solid var(--accent-cyan)', borderRadius: '4px', color: 'var(--accent-cyan)', fontWeight: 'bold', fontSize: '11px', padding: '1px 4px', cursor: 'pointer', outline: 'none' }}>{availableLlaves.map(ll => <option key={ll} value={ll} style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)' }}>Llave {ll}</option>)}</select> : <span>Llave {llaveName || 'Sin Llave'}</span>}<span style={{ marginLeft: '7px', padding: '2px 6px', borderRadius: '10px', fontSize: '9px', color: '#fff', background: activeStatus.color }}>{activeStatus.label}</span></div>
      {sedsList.length > 0 && <div ref={containerRef} style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-cyan)', borderRadius: '6px', padding: '2px 6px' }}><i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--accent-cyan)', fontSize: '10px' }}></i><input ref={inputRef} type="text" value={searchText} onChange={e => { setSearchText(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} placeholder="Buscar circuito..." style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-main)', fontSize: '11px', fontWeight: '600', width: '130px' }} /></div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setShowSuggestions(true); }} style={{ width: '100%', marginTop: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-cyan)', borderRadius: '4px', color: 'var(--text-main)', fontSize: '10px', padding: '2px 4px' }}><option value="todos">Todos los estados</option>{Object.entries(CIRCUIT_STATUSES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
        {showSuggestions && <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '290px', maxHeight: '250px', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--accent-cyan)', borderRadius: '6px', zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>{filtered.length ? filtered.map(circuit => { const status = CIRCUIT_STATUSES[circuit.status] || CIRCUIT_STATUSES.cargado; const active = circuit.sedId === sedId && circuit.llaveId === llaveName; return <div key={`${circuit.sedId}:${circuit.llaveId}`} onMouseDown={() => handleSelect(circuit)} style={{ padding: '6px 10px', fontSize: '11px', fontWeight: active ? '700' : '500', color: active ? 'var(--accent-cyan)' : 'var(--text-main)', cursor: 'pointer', background: active ? 'rgba(0,212,255,0.08)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>⚡ {circuit.sedId} · Llave {circuit.llaveId}<span style={{ marginLeft: '6px', padding: '1px 5px', borderRadius: '8px', fontSize: '9px', color: '#fff', background: status.color }}>{status.label}</span></div>; }) : <div style={{ padding: '8px 10px', fontSize: '11px', color: 'var(--text-muted)' }}>Sin circuitos para este filtro</div>}</div>}
      </div>}
    </div>
    <div style={{ display: 'flex', gap: '8px' }}><button className="hud-btn" onClick={onPrevSed}><i className="fa-solid fa-chevron-left"></i> SED Ant.</button><button className="hud-btn" onClick={onNextSed}>SED Sig. <i className="fa-solid fa-chevron-right"></i></button><button className="hud-btn" onClick={onToggleMapStyle}><i className={`fa-solid ${currentMapStyle === 'clean' ? 'fa-layer-group' : 'fa-map-location-dot'}`}></i><span>{currentMapStyle === 'clean' ? 'Mapa Limpio' : 'Mapa Detallado'}</span></button><button className="hud-btn" onClick={onEnterEditMode} style={{ background: 'rgba(255, 171, 0, 0.15)', borderColor: '#ffab00', color: '#ffab00' }}><i className="fa-solid fa-pen-to-square"></i> Modo Edición</button></div>
  </div>;
}
