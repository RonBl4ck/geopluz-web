'use client';

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
  onEnterEditMode
}) {
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

        {/* Buscador / Selector rápido de SED */}
        {sedsList.length > 0 && (
          <div style={{ position: 'relative' }}>
            <select
              value={sedId || ''}
              onChange={(e) => onSelectSed && onSelectSed(e.target.value)}
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                border: '1px solid var(--accent-cyan)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="" disabled>🔍 Buscar / Ir a SED...</option>
              {sedsList.map(s => (
                <option key={s} value={s}>
                  ⚡ {s}
                </option>
              ))}
            </select>
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
