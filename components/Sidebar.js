'use client';

import { useRef, useState, useEffect } from 'react';
import FaultTable from './FaultTable';

export default function Sidebar({
  seds,
  faultPoints,
  filteredFaultPoints,
  currentSedId,
  setCurrentSedId,
  currentLlaveId,
  setCurrentLlaveId,
  currentTheme,
  setCurrentTheme,
  currentMapStyle,
  setCurrentMapStyle,
  isAddPointMode,
  setIsAddPointMode,
  isPresentationMode,
  isEditable,
  onTogglePresentationMode,
  onImportJson,
  onImportJsonText,
  onImportExcel,
  onExportJson,
  onExportExcel,
  onSaveToMainDatabase,
  onDeleteSed,
  onDeleteLlave,
  onEditPoint,
  onDeletePoint,
  onRelocatePoint
}) {
  const jsonInputRef = useRef(null);
  const excelInputRef = useRef(null);
  const [showJsonPasteModal, setShowJsonPasteModal] = useState(false);
  const [pastedJsonText, setPastedJsonText] = useState('');
  const [sedsMasterDB, setSedsMasterDB] = useState({});

  useEffect(() => {
    fetch('/seds_master_db.min.json')
      .then(res => res.ok ? res.json() : {})
      .then(data => setSedsMasterDB(data))
      .catch(err => console.warn('No se pudo cargar seds_master_db.min.json:', err));
  }, []);

  const getMasterSedInfo = (sedId) => {
    if (!sedId || !sedsMasterDB || Object.keys(sedsMasterDB).length === 0) return null;
    let master = sedsMasterDB[sedId] || 
                 sedsMasterDB[sedId.replace(/^0+/, '')] || 
                 sedsMasterDB[sedId + 'S'] || 
                 sedsMasterDB[sedId.padStart(6, '0')];
    if (!master) {
      const keys = Object.keys(sedsMasterDB);
      const foundKey = keys.find(k => k.includes(sedId) || sedId.includes(k));
      if (foundKey) master = sedsMasterDB[foundKey];
    }
    return master;
  };

  const currentMasterSed = getMasterSedInfo(currentSedId);

  const handleProcessPastedJson = () => {
    if (!pastedJsonText.trim()) {
      alert('⚠️ Por favor pega el código JSON en el recuadro antes de procesar.');
      return;
    }
    onImportJsonText(pastedJsonText);
    setPastedJsonText('');
    setShowJsonPasteModal(false);
  };

  // Toggle tema oscuro
  const toggleTheme = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setCurrentTheme(newTheme);
    if (newTheme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  };

  const handleJsonChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onImportJson(e.target.files);
      e.target.value = '';
    }
  };

  const handleExcelChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onImportExcel(e.target.files[0]);
      e.target.value = '';
    }
  };

  const sedsList = Object.keys(seds || {});
  const hasData = sedsList.length > 0;
  
  const currentLlaves = currentSedId && seds[currentSedId] && seds[currentSedId].llaves 
    ? Object.keys(seds[currentSedId].llaves) 
    : [];

  return (
    <div id="sidebar" className={`sidebar ${isPresentationMode ? 'hidden' : ''}`}>
      {/* Encabezado de Marca PLUZ */}
      <div className="header-brand">
        <div className="brand-info">
          <img src="/PLUZ.png" alt="PLUZ" style={{ height: '28px', objectFit: 'contain' }} />
          <div>
            <h1>GEOPLUZ EMERGENCIAS</h1>
            <span>Análisis Histórico de Reparaciones de SEDs</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button 
            className="theme-toggle-btn" 
            onClick={() => setCurrentMapStyle(prev => prev === 'clean' ? 'detailed' : 'clean')}
            title="Cambiar a mapa limpio sin comercios ni mercados para mayor rapidez"
          >
            <i className={`fa-solid ${currentMapStyle === 'clean' ? 'fa-layer-group' : 'fa-map-location-dot'}`}></i>
            <span>{currentMapStyle === 'clean' ? 'Mapa Limpio' : 'Mapa Detallado'}</span>
          </button>
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            <i className={`fa-solid ${currentTheme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
            <span>{currentTheme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
          </button>
        </div>
      </div>

      <div className="sidebar-content">
        {/* Ocultos */}
        <input 
          type="file" 
          ref={jsonInputRef}
          onChange={handleJsonChange}
          accept=".json,.geojson"
          multiple
          style={{ display: 'none' }}
        />
        <input 
          type="file" 
          ref={excelInputRef}
          onChange={handleExcelChange}
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
        />

        {/* Tarjeta 1: Carga y Fusión de JSONs */}
        <div className="card">
          <div className="card-title">
            <i className="fa-solid fa-layer-group"></i> 1. Carga & Fusión de Múltiples JSONs
          </div>
          <div className="form-group">
            <label>Estado de Base Local Acumulada:</label>
            <div className="status-badge">
              <i className="fa-solid fa-circle-info"></i> 
              <span>{hasData ? `${sedsList.length} SED(s) acumuladas` : 'Esperando archivos JSON...'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
            <button 
              className="btn btn-green" 
              style={{ flex: 1, padding: '7px 8px', fontSize: '11px' }}
              onClick={() => jsonInputRef.current && jsonInputRef.current.click()}
              title="Subir archivo JSON desde tu explorador de archivos"
            >
              <i className="fa-solid fa-file-circle-plus"></i> Cargar JSON
            </button>
            <button 
              className="btn btn-orange" 
              style={{ flex: 1, padding: '7px 8px', fontSize: '11px' }}
              onClick={() => setShowJsonPasteModal(true)}
              title="Pegar el texto/código del JSON directamente (si los archivos están bloqueados)"
            >
              <i className="fa-solid fa-paste"></i> Pegar JSON
            </button>
            <button 
              className="btn btn-outline" 
              style={{ width: 'auto', padding: '7px 10px', fontSize: '11px' }}
              onClick={onExportJson}
              disabled={!hasData}
              title="Descargar respaldo JSON"
            >
              <i className="fa-solid fa-download"></i>
            </button>
          </div>
          {hasData && (
            <button 
              className="btn btn-cyan" 
              style={{ marginTop: '8px' }}
              onClick={onSaveToMainDatabase}
              title="Solicita contraseña y sincroniza con la Base de Datos Principal en Supabase"
            >
              <i className="fa-solid fa-cloud-arrow-up"></i> ☁️ Guardar en Base Principal (Nube)
            </button>
          )}

          {/* Modal para Pegar Código JSON */}
          {showJsonPasteModal && (
            <div className="modal-backdrop active" style={{ zIndex: 10000 }}>
              <div className="point-form-modal" style={{ width: '580px' }}>
                <h3 style={{ color: 'var(--accent-cyan)', fontSize: '14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>📋 Pegar Código / Texto JSON</span>
                  <span onClick={() => setShowJsonPasteModal(false)} style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</span>
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Abre tu archivo JSON en el <b>Bloc de Notas</b> (Notepad), selecciona todo (<b>Ctrl + A</b>), copia (<b>Ctrl + C</b>) y pégalo (<b>Ctrl + V</b>) aquí:
                </p>
                <textarea
                  className="input-control"
                  style={{ width: '100%', height: '200px', fontFamily: 'monospace', fontSize: '11px', resize: 'vertical', padding: '8px' }}
                  placeholder="Pega aquí el código JSON { ... }"
                  value={pastedJsonText}
                  onChange={(e) => setPastedJsonText(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <button className="btn btn-green" style={{ flex: 1 }} onClick={handleProcessPastedJson}>
                    <i className="fa-solid fa-bolt"></i> ⚡ Cargar Red desde Texto Pegado
                  </button>
                  <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowJsonPasteModal(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tarjeta 2: Importar Excel */}
        <div className="card">
          <div className="card-title">
            <i className="fa-solid fa-file-excel" style={{ color: '#2e7d32' }}></i> 2. Cargar Excel con Registros (.xlsx)
          </div>
          <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Importa Excel con columnas de Ticket, Falla Real, Coordenadas y pestañas por SED-Llave.
          </p>
          <button 
            className="btn btn-orange" 
            onClick={() => excelInputRef.current && excelInputRef.current.click()}
          >
            <i className="fa-solid fa-upload"></i> Cargar Histórico Excel (.xlsx)
          </button>
        </div>

        {/* Tarjeta 3: Selección y Gestión de SED y Llave */}
        <div className="card">
          <div className="card-title">
            <i className="fa-solid fa-sitemap"></i> 3. Navegación & Gestión de SEDs / Llaves
          </div>
          <div className="form-group">
            <label>Subestación de Distribución (SED):</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <select 
                className="input-control"
                style={{ flex: 1 }}
                value={currentSedId || ''} 
                onChange={(e) => setCurrentSedId(e.target.value)}
              >
                <option value="">{hasData ? '-- Seleccione una SED --' : '-- Carga un JSON o Excel primero --'}</option>
                {sedsList.map(sed => (
                  <option key={sed} value={sed}>{seds[sed]?.name || `SED ${sed}`}</option>
                ))}
              </select>
              {currentSedId && (
                <button 
                  className="btn btn-outline" 
                  title="Eliminar SED Seleccionada"
                  style={{ width: 'auto', padding: '6px 10px', color: '#ff1744', borderColor: '#ff1744' }}
                  onClick={() => onDeleteSed(currentSedId)}
                >
                  <i className="fa-solid fa-trash"></i>
                </button>
              )}
            </div>
          </div>
          <div className="form-group">
            <label>Llave de Salida (Circuito):</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <select 
                className="input-control"
                style={{ flex: 1 }}
                value={currentLlaveId || ''} 
                onChange={(e) => setCurrentLlaveId(e.target.value)}
                disabled={!currentSedId}
              >
                <option value="">{currentSedId ? '-- Seleccione una Llave --' : '-- Seleccione una SED primero --'}</option>
                {currentLlaves.map(llave => (
                  <option key={llave} value={llave}>{llave}</option>
                ))}
              </select>
              {currentSedId && currentLlaveId && (
                <button 
                  className="btn btn-outline" 
                  title="Eliminar Llave Seleccionada"
                  style={{ width: 'auto', padding: '6px 10px', color: '#ff9800', borderColor: '#ff9800' }}
                  onClick={() => onDeleteLlave(currentSedId, currentLlaveId)}
                >
                  <i className="fa-solid fa-trash-can"></i>
                </button>
              )}
            </div>
          </div>

          {currentMasterSed && (
            <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(0,119,194,0.08)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px' }}>
              <div style={{ fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                <span>📋 Ficha Técnica SED Master</span>
                <span style={{ fontWeight: 600, fontSize: '10px', background: 'var(--accent-cyan)', color: '#fff', padding: '1px 6px', borderRadius: '10px' }}>
                  {currentMasterSed.sheet || 'SP'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', color: 'var(--text-main)' }}>
                <div>👥 <b>Clientes BT:</b> {currentMasterSed.cli !== undefined ? currentMasterSed.cli.toLocaleString() : 'N/A'}</div>
                <div>⚡ <b>Potencia:</b> {currentMasterSed.kva !== undefined ? `${currentMasterSed.kva} KVA` : 'N/A'} ({currentMasterSed.kv || 10} kV)</div>
                <div>🏗️ <b>Tipo:</b> {currentMasterSed.tipo_const || currentMasterSed.tipo_sed || 'Superficie'}</div>
                <div>🔌 <b>Alim.:</b> {currentMasterSed.alim || 'N/A'}</div>
                <div style={{ gridColumn: 'span 2' }}>📍 <b>Dirección:</b> {currentMasterSed.dir || 'Sin registro'} ({currentMasterSed.dist || ''})</div>
                <div style={{ gridColumn: 'span 2' }}>🏢 <b>UO:</b> {currentMasterSed.uo || 'UO COLONIAL'} {currentMasterSed.contratista ? `| ${currentMasterSed.contratista}` : ''}</div>
              </div>
            </div>
          )}
        </div>

        {/* Tarjeta 4: Registro de Fallas Reparadas */}
        <div className="card">
          <div className="card-title">
            <i className="fa-solid fa-location-dot" style={{ color: 'var(--accent-danger)' }}></i> 4. Registro de Fallas Reparadas
          </div>
          <button 
            className={`btn ${isAddPointMode ? 'btn-active-mode' : 'btn-cyan'}`} 
            style={{ marginBottom: '8px' }}
            onClick={() => setIsAddPointMode(!isAddPointMode)}
          >
            <i className={`fa-solid ${isAddPointMode ? 'fa-crosshairs' : 'fa-plus-node'}`}></i> 
            {isAddPointMode ? ' 📍 Haz Clic en el Mapa para Marcar Punto' : ' 📍 Marcar Punto de Falla Reparada'}
          </button>
          
          <div className="points-table-container">
            <FaultTable 
              points={filteredFaultPoints} 
              showActions={true}
              onEdit={onEditPoint}
              onDelete={onDeletePoint}
              onRelocate={onRelocatePoint}
            />
          </div>
        </div>

        {/* Tarjeta 5: Exportar Análisis a Excel */}
        <div className="card">
          <div className="card-title">
            <i className="fa-solid fa-file-excel" style={{ color: '#2e7d32' }}></i> 5. Exportar Análisis a Excel
          </div>
          <button 
            className="btn btn-green" 
            onClick={onExportExcel}
            disabled={faultPoints.length === 0}
          >
            <i className="fa-solid fa-file-excel"></i> Exportar Excel (Hojas por SED + Captura Imagen + 7 Cols)
          </button>
        </div>

        {/* Tarjeta 6: Visor / Modo Presentación Ejecutiva */}
        <div className="card">
          <div className="card-title">
            <i className="fa-solid fa-desktop" style={{ color: '#ab47bc' }}></i> 6. Visor Modo Presentación
          </div>
          <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Oculta controles de edición para exponer el mapa y tabla en pantalla completa durante reuniones.
          </p>
          <button 
            className="btn btn-purple" 
            onClick={onTogglePresentationMode}
          >
            <i className="fa-solid fa-desktop"></i> 📺 Activar Modo Presentación (Solo Lectura)
          </button>
        </div>
      </div>
    </div>
  );
}
