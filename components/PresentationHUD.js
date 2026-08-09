'use client';
import { useState, useRef, useEffect } from 'react';

export default function PresentationHUD({
  sedId,
  sedName,
  llaveName,
  sedsList = [],
  onSelectSed,
  currentMapStyle,
  onPrevSed,
  onNextSed,
  onToggleMapStyle,
  onEnterEditMode,
  onExportExcel
}) {
  const [searchText, setSearchText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Limpiar "SED" duplicado si name contiene "SED 04487A" o "Subestación SED..."
  const cleanSed = (sedName || sedId || 'Sin SED')
    .replace(/^SED\s+/i, '')
    .replace(/^Subestación\s+/i, '')
    .replace(/^SED\s+/i, '');

  // Limpiar "Llave" si contiene barras como "MI-07/04487A/2SP" -> extraer "2SP" o la última parte
  let cleanLlave = (llaveName || 'Sin Llave');
  if (cleanLlave.includes('/')) {
    const parts = cleanLlave.split('/');
    cleanLlave = parts[parts.length - 1];
  }

  // Filtrar SEDs según texto escrito
  const filtered = searchText.trim()
    ? sedsList.filter(s => s.toLowerCase().includes(searchText.toLowerCase()))
    : sedsList;

  // Cerrar sugerencias si se hace clic fuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(sed) {
    setSearchText('');
    setShowSuggestions(false);
    if (onSelectSed) onSelectSed(sed);
  }

  return (
    <div className="presentation-hud">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img src="/PLUZ.png" alt="PLUZ" style={{ height: '22px', objectFit: 'contain' }} />
        <div className="hud-badge"><i className="fa-solid fa-desktop"></i> PRESENTACIÓN</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div className="hud-title">
          <span>SED {cleanSed}</span> | <span>Llave {cleanLlave}</span>
        </div>

        {/* Buscador de SED con texto */}
        {sedsList.length > 0 && (
          <div ref={containerRef} style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-cyan)', borderRadius: '6px', padding: '2px 6px' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--accent-cyan)', fontSize: '10px' }}></i>
              <input
                ref={inputRef}
                type="text"
                value={searchText}
                onChange={e => { setSearchText(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Buscar SED..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-main)',
                  fontSize: '11px',
                  fontWeight: '600',
                  width: '130px',
                  cursor: 'text'
                }}
              />
              {searchText && (
                <button
                  onClick={() => { setSearchText(''); setShowSuggestions(false); inputRef.current?.focus(); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '10px', padding: '0', lineHeight: 1 }}
                  title="Limpiar búsqueda"
                >✕</button>
              )}
            </div>

            {/* Dropdown de sugerencias */}
            {showSuggestions && filtered.length > 0 && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                minWidth: '180px',
                maxHeight: '220px',
                overflowY: 'auto',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--accent-cyan)',
                borderRadius: '6px',
                zIndex: 9999,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
              }}>
                {filtered.map(s => (
                  <div
                    key={s}
                    onMouseDown={() => handleSelect(s)}
                    style={{
                      padding: '6px 10px',
                      fontSize: '11px',
                      fontWeight: s === sedId ? '700' : '500',
                      color: s === sedId ? 'var(--accent-cyan)' : 'var(--text-main)',
                      cursor: 'pointer',
                      background: s === sedId ? 'rgba(0,212,255,0.08)' : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.04)'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,255,0.12)'}
                    onMouseLeave={e => e.currentTarget.style.background = s === sedId ? 'rgba(0,212,255,0.08)' : 'transparent'}
                  >
                    ⚡ {s}
                  </div>
                ))}
              </div>
            )}

            {/* Sin resultados */}
            {showSuggestions && searchText && filtered.length === 0 && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                minWidth: '180px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--accent-cyan)',
                borderRadius: '6px',
                zIndex: 9999,
                padding: '8px 10px',
                fontSize: '11px',
                color: 'var(--text-muted)'
              }}>
                Sin resultados para "{searchText}"
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="hud-btn" onClick={onPrevSed}>
          <i className="fa-solid fa-chevron-left"></i> SED Ant.
        </button>
        <button className="hud-btn" onClick={onNextSed}>
          SED Sig. <i className="fa-solid fa-chevron-right"></i>
        </button>
        {onExportExcel && (
          <button className="hud-btn" onClick={onExportExcel} style={{ background: 'rgba(46, 125, 50, 0.25)', borderColor: '#2e7d32', color: '#4caf50' }} title="Descargar tabla de fallas en Excel agrupada por SED">
            <i className="fa-solid fa-file-excel"></i> 📊 Excel por SED
          </button>
        )}
        <button className="hud-btn" onClick={onToggleMapStyle} title="Cambiar estilo de mapa">
          <i className={`fa-solid ${currentMapStyle === 'clean' ? 'fa-layer-group' : 'fa-map-location-dot'}`}></i>
          <span>{currentMapStyle === 'clean' ? 'Mapa Limpio' : 'Mapa Detallado'}</span>
        </button>
        <button className="hud-btn" onClick={onEnterEditMode} style={{ background: 'rgba(255, 171, 0, 0.15)', borderColor: '#ffab00', color: '#ffab00' }}>
          <i className="fa-solid fa-pen-to-square"></i> ✏️ Modo Edición
        </button>
      </div>
    </div>
  );
}
