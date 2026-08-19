'use client';

import { useEffect, useRef, useState } from 'react';
import { CIRCUIT_STATUSES } from '@/lib/circuitAnalysis';

export default function PresentationHUD({ sedId, sedName, llaveName, sedsList = [], localDatabase = {}, circuitEntries = [], circuitStatus = 'cargado', onSelectSed, onSelectLlave, onSelectCircuit, currentMapStyle, currentTheme = 'light', onPrevSed, onNextSed, onToggleMapStyle, onToggleTheme, onEnterEditMode }) {
  const [searchText, setSearchText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [statusFilter, setStatusFilter] = useState('todos');
  const containerRef = useRef(null);
  const cleanSed = (sedName || sedId || 'Sin SED').replace(/^SED\s+/i, '').replace(/^Subestación\s+/i, '');
  const availableLlaves = sedId && localDatabase[sedId]?.llaves ? Object.keys(localDatabase[sedId].llaves) : [];
  const activeStatus = CIRCUIT_STATUSES[circuitStatus] || CIRCUIT_STATUSES.cargado;
  const search = searchText.trim().toLowerCase();
  const filtered = circuitEntries.filter(circuit => (statusFilter === 'todos' || circuit.status === statusFilter) && (!search || `${circuit.sedId} ${circuit.sedName} ${circuit.llaveId}`.toLowerCase().includes(search)));

  useEffect(() => {
    const handleClickOutside = (event) => { if (containerRef.current && !containerRef.current.contains(event.target)) setShowSuggestions(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(circuit) {
    setSearchText('');
    setShowSuggestions(false);
    if (onSelectCircuit) onSelectCircuit(circuit.sedId, circuit.llaveId);
    else onSelectSed?.(circuit.sedId);
  }

  return <div className="presentation-hud">
    <div className="hud-brand"><img src="/PLUZ.png" alt="PLUZ" /><div className="hud-badge"><i className="fa-solid fa-desktop"></i> PRESENTACIÓN</div></div>
    <div className="hud-context">
      <div className="hud-title"><span>SED {cleanSed}</span> | {availableLlaves.length > 1 ? <select value={llaveName || ''} onChange={(event) => onSelectLlave?.(event.target.value)}>{availableLlaves.map(llave => <option key={llave} value={llave}>Llave {llave}</option>)}</select> : <span>Llave {llaveName || 'Sin Llave'}</span>}<span className="circuit-status-chip" style={{ '--status-color': activeStatus.color }}>{activeStatus.label}</span></div>
      {sedsList.length > 0 && <div ref={containerRef} className="hud-search">
        <div className="hud-search-input"><i className="fa-solid fa-magnifying-glass"></i><input type="text" value={searchText} onChange={event => { setSearchText(event.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} placeholder="Buscar circuito..." /></div>
        <select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setShowSuggestions(true); }}><option value="todos">Todos los estados</option>{Object.entries(CIRCUIT_STATUSES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
        {showSuggestions && <div className="hud-suggestions">{filtered.length ? filtered.map(circuit => { const status = CIRCUIT_STATUSES[circuit.status] || CIRCUIT_STATUSES.cargado; const active = circuit.sedId === sedId && circuit.llaveId === llaveName; return <button key={`${circuit.sedId}:${circuit.llaveId}`} className={active ? 'active' : ''} onMouseDown={() => handleSelect(circuit)}>⚡ {circuit.sedId} · Llave {circuit.llaveId}<span style={{ background: status.color }}>{status.label}</span></button>; }) : <div>Sin circuitos para este filtro</div>}</div>}
      </div>}
    </div>
    <div className="hud-actions">
      <button className="hud-btn" onClick={onPrevSed}><i className="fa-solid fa-chevron-left"></i> SED Ant.</button>
      <button className="hud-btn" onClick={onNextSed}>SED Sig. <i className="fa-solid fa-chevron-right"></i></button>
      <button className="hud-btn" onClick={onToggleMapStyle}><i className={`fa-solid ${currentMapStyle === 'clean' ? 'fa-layer-group' : 'fa-map-location-dot'}`}></i><span>{currentMapStyle === 'clean' ? 'Mapa Limpio' : 'Mapa Detallado'}</span></button>
      <button className="hud-btn" onClick={onToggleTheme} title={currentTheme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}><i className={`fa-solid ${currentTheme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i><span>{currentTheme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span></button>
      <button className="hud-btn hud-edit-btn" onClick={onEnterEditMode}><i className="fa-solid fa-pen-to-square"></i> Modo Edición</button>
    </div>
  </div>;
}
