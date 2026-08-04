'use client';

export default function PresentationHUD({
  sedName,
  llaveName,
  currentMapStyle,
  onPrevSed,
  onNextSed,
  onToggleMapStyle,
  onEnterEditMode
}) {
  return (
    <div className="presentation-hud">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img src="/PLUZ.png" alt="PLUZ" style={{ height: '22px', objectFit: 'contain' }} />
        <div className="hud-badge"><i className="fa-solid fa-desktop"></i> PRESENTACION</div>
      </div>
      <div className="hud-title">
        <span>SED {sedName || '--'}</span> | <span>Llave {llaveName || '--'}</span>
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
