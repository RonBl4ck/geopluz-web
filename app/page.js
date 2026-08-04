'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import FaultForm from '@/components/FaultForm';
import PresentationHUD from '@/components/PresentationHUD';
import PresentationTablePanel from '@/components/PresentationTablePanel';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// MapViewer importado dinámicamente para evitar SSR
const MapViewer = dynamic(() => import('@/components/MapViewer'), { ssr: false });

export default function Page() {
  // Estado de Datos
  const [localDatabase, setLocalDatabase] = useState({});
  const [numberedPointsList, setNumberedPointsList] = useState([]);

  // Estado de Navegación
  const [currentSedId, setCurrentSedId] = useState('');
  const [currentLlaveId, setCurrentLlaveId] = useState('');

  // Estado UI
  const [currentTheme, setCurrentTheme] = useState('light');
  const [currentMapStyle, setCurrentMapStyle] = useState('clean');
  const [isAddPointMode, setIsAddPointMode] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(true);
  const [relocatingPointIndex, setRelocatingPointIndex] = useState(null);

  // Estado del Formulario
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPointIndex, setEditingPointIndex] = useState(null);

  // Estado de Autenticación
  const [isEditable, setIsEditable] = useState(false);
  
  const mapRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  // Carga de Datos desde Supabase
  async function loadData() {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const { data: sedsData, error: sedsError } = await supabase.from('seds').select('*');
      const { data: llavesData } = await supabase.from('llaves').select('*');
      const { data: fallasData } = await supabase.from('fallas').select('*');
      
      if (!sedsError && sedsData) {
        const db = {};
        sedsData.forEach(sed => {
          db[sed.id] = {
            id: sed.id,
            name: sed.name,
            sedCoord: sed.sed_coord,
            llaves: {}
          };
        });
        
        if (llavesData) {
          llavesData.forEach(llave => {
            if (db[llave.sed_id]) {
              db[llave.sed_id].llaves[llave.llave_code] = {
                name: llave.name,
                lines: llave.lines_data || []
              };
            }
          });
        }
        setLocalDatabase(db);
        
        if (fallasData) {
          const points = fallasData.map((f, i) => ({
            id: f.id,
            number: i + 1,
            coords: (f.latitud && f.longitud) ? [f.latitud, f.longitud] : null,
            ticket: f.ticket || '',
            horaInicio: f.hora_inicio || '',
            zona: f.zona || '',
            set: f.set_alimentador ? f.set_alimentador.split('/')[0]?.trim() : '',
            alimentador: f.set_alimentador ? f.set_alimentador.split('/')[1]?.trim() : '',
            nota: f.nota || '',
            odm: f.odm || '',
            suministro: f.suministro || '',
            sedLlave: f.sed_llave || '',
            sed: f.sed_id || '',
            llaveSistema: f.llave_code || '',
            llaveCampo: `${f.llave_code || ''} (Campo)`,
            falla: f.falla_real || '',
            causa: f.causa || '',
            fotos: f.fotos || []
          }));
          setNumberedPointsList(points);
        }
      }
    } catch (err) {
      console.log('Supabase no disponible, modo local:', err.message);
    }
  }

  // Filtrado de Puntos
  const getFilteredPoints = useCallback(() => {
    let list = numberedPointsList;
    if (currentSedId) {
      list = list.filter(pt => {
        const ptSed = pt.sed || (pt.sedLlave ? pt.sedLlave.split('-')[0] : '');
        return ptSed === currentSedId || (pt.sedLlave && pt.sedLlave.includes(currentSedId));
      });
    }
    return list.map((pt, i) => ({ ...pt, localNumber: i + 1 }));
  }, [numberedPointsList, currentSedId]);

  const filteredPoints = getFilteredPoints();

  // Seleccionar SED y auto-seleccionar su primera llave
  const handleSedSelect = (sedId) => {
    setCurrentSedId(sedId);
    if (sedId && localDatabase[sedId] && localDatabase[sedId].llaves) {
      const llaves = Object.keys(localDatabase[sedId].llaves);
      if (llaves.length > 0) {
        setCurrentLlaveId(llaves[0]);
      } else {
        setCurrentLlaveId('');
      }
    } else {
      setCurrentLlaveId('');
    }
  };

  // Importación JSON
  function handleImportJson(files) {
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const rawData = JSON.parse(evt.target.result);
          mergeJsonData(rawData);
        } catch(err) {
          alert('Error al leer JSON: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
  }

  function handleImportJsonText(jsonText) {
    if (!jsonText || !jsonText.trim()) return;
    try {
      const rawData = JSON.parse(jsonText.trim());
      mergeJsonData(rawData);
    } catch(err) {
      alert('❌ Error al procesar el código JSON pegado. Verifique que el texto esté completo.\nDetalle: ' + err.message);
    }
  }

  function mergeJsonData(rawData) {
    let incoming = {};
    if (rawData.seds && typeof rawData.seds === 'object') {
      incoming = rawData.seds;
    } else if (Array.isArray(rawData)) {
      rawData.forEach(item => { if (item.id) incoming[item.id] = item; });
    } else if (rawData.id) {
      incoming[rawData.id] = rawData;
    } else {
      for (const k in rawData) {
        if (typeof rawData[k] === 'object' && rawData[k].llaves) {
          incoming[k] = rawData[k];
        }
      }
    }
    
    setLocalDatabase(prev => {
      const updated = { ...prev };
      for (const sedId in incoming) {
        if (!updated[sedId]) {
          updated[sedId] = incoming[sedId];
        } else {
          const existingLlaves = { ...(updated[sedId].llaves || {}) };
          const newLlaves = incoming[sedId].llaves || {};
          for (const llaveId in newLlaves) {
            existingLlaves[llaveId] = newLlaves[llaveId];
          }
          updated[sedId] = { ...updated[sedId], llaves: existingLlaves };
        }
      }

      // Buscar SED real prioritaria (ignorando plantilla SED_ACTIVA si existen SEDs reales con llaves)
      const sedKeys = Object.keys(updated);
      const realSedKey = sedKeys.find(k => k !== 'SED_ACTIVA' && Object.keys(updated[k]?.llaves || {}).length > 0) || sedKeys[0];

      if (realSedKey) {
        setCurrentSedId(realSedKey);
        const llaveKeys = Object.keys(updated[realSedKey]?.llaves || {});
        const realLlaveKey = llaveKeys.find(k => k !== 'CIRCUITO_ACTIVO') || llaveKeys[0];
        if (realLlaveKey) {
          setCurrentLlaveId(realLlaveKey);
        }
      }

      const realCount = sedKeys.filter(k => k !== 'SED_ACTIVA').length || sedKeys.length;

      setTimeout(() => {
        alert(`✅ ¡DATOS CARGADOS! Se detectaron ${realCount} Subestaciones de Distribución (SEDs) con sus llaves de circuito.`);
      }, 100);

      return updated;
    });
  }

  // Guardar en la Base Principal (Supabase) solicitando contraseña
  async function handleSaveToMainDatabase() {
    const allowed = await checkEditPermission();
    if (!allowed) return;

    if (!isSupabaseConfigured || !supabase) {
      alert('ℹ️ MODO LOCAL ACTIVO:\n\nPara guardar permanentemente en la nube, configura las variables NEXT_PUBLIC_SUPABASE_URL y KEY en el archivo .env.local.');
      return;
    }

    try {
      await saveSedsToSupabase(localDatabase);
      for (const pt of numberedPointsList) {
        await saveFallaToSupabase(pt);
      }
      alert('☁️ ✅ ¡SINCRONIZACIÓN EXITOSA!\n\nTodos los datos de red y fallas atendidas se han guardado permanentemente en la Base de Datos Principal en Supabase.');
    } catch(err) {
      alert('❌ Error al sincronizar con Supabase: ' + err.message);
    }
  }

  async function saveSedsToSupabase(database) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      for (const sedId in database) {
        const sed = database[sedId];
        await supabase.from('seds').upsert({
          id: sedId,
          name: sed.name || `SED ${sedId}`,
          sed_coord: sed.sedCoord || null
        });
        
        for (const llaveCode in sed.llaves) {
          const llave = sed.llaves[llaveCode];
          await supabase.from('llaves').upsert({
            sed_id: sedId,
            llave_code: llaveCode,
            name: llave.name || llaveCode,
            lines_data: llave.lines || []
          }, { onConflict: 'sed_id,llave_code' });
        }
      }
    } catch(err) {
      console.warn('Error guardando en Supabase:', err.message);
    }
  }

  // Importación Excel
  function handleImportExcel(file) {
    if (!checkEditPermission()) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const XLSX = require('xlsx');
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        let importedPoints = 0;
        const newPoints = [...numberedPointsList];
        
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          
          jsonRows.forEach(row => {
            const ticket = row['Ticket'] || row['TICKET'] || row['ticket'] || '';
            const lat = parseFloat(row['Latitud'] || row['LATITUD'] || row['Lat'] || row['lat']);
            const lng = parseFloat(row['Longitud'] || row['LONGITUD'] || row['Lng'] || row['lng']);
            
            if (ticket || (!isNaN(lat) && !isNaN(lng))) {
              const sedLlaveVal = row['Sed-Llave'] || row['SED-LLAVE'] || sheetName || '00007S-5SP';
              const partes = sedLlaveVal.split('-');
              
              const pointNum = newPoints.length + 1;
              const pointData = {
                number: pointNum,
                coords: (!isNaN(lat) && !isNaN(lng)) ? [lat, lng] : null,
                ticket: String(ticket || `TK-${Math.floor(Math.random()*90000+10000)}`),
                horaInicio: String(row['Hora de inicio'] || row['HORA INICIO'] || new Date().toLocaleString()),
                zona: String(row['Zona'] || row['ZONA'] || 'Zona Centro'),
                set: String(row['SET'] || row['set'] || 'SET'),
                alimentador: String(row['Alimentador'] || row['ALIMENTADOR'] || 'Alim'),
                nota: String(row['Nota específica'] || row['NOTA'] || 'Falla atendida'),
                odm: String(row['ODM'] || row['odm'] || 'ODM-000'),
                suministro: String(row['Suministro'] || row['SUMINISTRO'] || 'N/A'),
                sedLlave: sedLlaveVal,
                sed: partes[0] || '00007S',
                llaveSistema: partes[1] || '5SP',
                llaveCampo: `${partes[1] || '5SP'} (Campo)`,
                falla: String(row['Falla Real'] || row['FALLA REAL'] || 'Avería reparada'),
                causa: String(row['Causa'] || row['CAUSA'] || 'Deterioro')
              };
              newPoints.push(pointData);
              importedPoints++;
              saveFallaToSupabase(pointData);
            }
          });
        });
        
        setNumberedPointsList(newPoints);
        alert(`✅ EXCEL IMPORTADO: ${importedPoints} registros cargados.`);
      } catch(err) {
        alert('Error al procesar Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleExportJson() {
    const dataStr = JSON.stringify(localDatabase, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "geopluz_datos.json";
    link.click();
  }

  function handleExportExcel() {
    try {
      const XLSX = require('xlsx');
      const ws = XLSX.utils.json_to_sheet(numberedPointsList);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Fallas");
      XLSX.writeFile(wb, "geopluz_fallas.xlsx");
    } catch(err) {
      alert('Error exportando a Excel: ' + err.message);
    }
  }

  // Permisos de edición
  async function checkEditPermission() {
    if (isEditable) return true;
    
    const password = prompt('🔒 Ingrese la contraseña de edición:');
    if (!password) return false;
    
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data && data.success) {
        setIsEditable(true);
        return true;
      } else {
        alert('❌ Contraseña incorrecta');
        return false;
      }
    } catch {
      if (password === 'geopluz2026') {
        setIsEditable(true);
        return true;
      } else {
        alert('❌ Contraseña incorrecta');
        return false;
      }
    }
  }

  // Acciones en el mapa
  async function handleMapClick(latlng) {
    if (relocatingPointIndex !== null) {
      const allowed = await checkEditPermission();
      if (!allowed) {
        setRelocatingPointIndex(null);
        return;
      }
      const updated = [...numberedPointsList];
      updated[relocatingPointIndex] = {
        ...updated[relocatingPointIndex],
        coords: [latlng.lat, latlng.lng]
      };
      setNumberedPointsList(updated);
      setRelocatingPointIndex(null);
      saveFallaToSupabase(updated[relocatingPointIndex]);
      return;
    }
    
    if (!isAddPointMode || isPresentationMode) return;
    const allowed = await checkEditPermission();
    if (!allowed) return;
    
    const pointNum = numberedPointsList.length + 1;
    const newPoint = {
      number: pointNum,
      coords: [latlng.lat, latlng.lng],
      ticket: `TK-${Math.floor(Math.random()*90000+10000)}`,
      horaInicio: new Date().toLocaleString(),
      zona: 'Zona Lima Norte',
      set: 'SET San Juan',
      alimentador: 'Alim 1',
      nota: 'Empalme sustituido',
      odm: `ODM-${Math.floor(Math.random()*9000+1000)}`,
      suministro: 'Suministro',
      sedLlave: `${currentSedId}-${currentLlaveId}`,
      sed: currentSedId,
      llaveSistema: currentLlaveId,
      llaveCampo: `${currentLlaveId} (Campo)`,
      falla: 'Cable subterráneo cortado',
      causa: 'Excavación externa'
    };
    
    const updated = [...numberedPointsList, newPoint];
    setNumberedPointsList(updated);
    setEditingPointIndex(updated.length - 1);
    setIsFormOpen(true);
  }

  // Guardado de Falla
  function handleSavePoint(pointData) {
    const updated = [...numberedPointsList];
    if (editingPointIndex !== null && updated[editingPointIndex]) {
      updated[editingPointIndex] = { ...updated[editingPointIndex], ...pointData };
    } else {
       // if we are inserting without editing index... but normally editingPointIndex is set
       updated.push(pointData);
    }
    setNumberedPointsList(updated);
    setIsFormOpen(false);
    
    saveFallaToSupabase(updated[editingPointIndex !== null ? editingPointIndex : updated.length - 1]);
    setEditingPointIndex(null);
  }

  async function saveFallaToSupabase(point) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const record = {
        sed_id: point.sed,
        llave_code: point.llaveSistema,
        sed_llave: point.sedLlave,
        ticket: point.ticket,
        suministro: point.suministro,
        falla_real: point.falla,
        causa: point.causa,
        nota: point.nota,
        odm: point.odm,
        zona: point.zona,
        set_alimentador: `${point.set} / ${point.alimentador}`,
        hora_inicio: point.horaInicio,
        latitud: point.coords ? point.coords[0] : null,
        longitud: point.coords ? point.coords[1] : null,
        fotos: point.fotos || []
      };
      
      if (point.id) {
        await supabase.from('fallas').update(record).eq('id', point.id);
      } else {
        const { data, error } = await supabase.from('fallas').insert(record).select();
        if (data && data.length > 0) {
            // Update the id of the point in state so future edits use update instead of insert
            setNumberedPointsList(prev => prev.map(p => p.number === point.number ? { ...p, id: data[0].id } : p));
        }
      }
    } catch(err) {
      console.warn('Error guardando falla en Supabase:', err.message);
    }
  }

  // Eliminar Falla
  function handleDeletePoint(index) {
    if (!checkEditPermission()) return;
    if (confirm('¿Estás seguro de que deseas eliminar esta falla?')) {
      const point = numberedPointsList[index];
      const updated = numberedPointsList.filter((_, i) => i !== index);
      setNumberedPointsList(updated);
      if (point.id) {
         supabase.from('fallas').delete().eq('id', point.id).then();
      }
    }
  }

  // Eliminar SED y Llave
  function handleDeleteSed(sedId) {
    if (!checkEditPermission()) return;
    if (confirm(`¿Eliminar la SED ${sedId} por completo?`)) {
      const updated = { ...localDatabase };
      delete updated[sedId];
      setLocalDatabase(updated);
      if (currentSedId === sedId) {
        setCurrentSedId('');
        setCurrentLlaveId('');
      }
      fetch(`/api/seds?sed_id=${sedId}`, { method: 'DELETE' }).catch(console.error);
    }
  }

  function handleDeleteLlave(sedId, llaveId) {
    if (!checkEditPermission()) return;
    if (confirm(`¿Eliminar la llave ${llaveId} de la SED ${sedId}?`)) {
      const updated = { ...localDatabase };
      if (updated[sedId] && updated[sedId].llaves) {
        delete updated[sedId].llaves[llaveId];
        setLocalDatabase(updated);
        if (currentSedId === sedId && currentLlaveId === llaveId) {
           setCurrentLlaveId('');
        }
        fetch(`/api/seds?sed_id=${sedId}&llave_code=${llaveId}`, { method: 'DELETE' }).catch(console.error);
      }
    }
  }

  // Reubicación
  function handleRelocatePoint(index) {
    if (!checkEditPermission()) return;
    setRelocatingPointIndex(index);
    alert('Haz clic en el mapa en la nueva ubicación.');
  }

  function handleSedDragEnd(sedId, latlng) {
    if (!checkEditPermission()) return;
    const updated = { ...localDatabase };
    if (updated[sedId]) {
      updated[sedId].sedCoord = [latlng.lat, latlng.lng];
      setLocalDatabase(updated);
      saveSedsToSupabase({ [sedId]: updated[sedId] });
    }
  }

  function handleFlyToPoint(point) {
    if (mapRef.current && point.coords) {
      mapRef.current.flyTo(point.coords, 18);
    }
  }

  // Navegación
  const sedsList = Object.keys(localDatabase);
  function navigateSed(dir) {
    if (sedsList.length === 0) return;
    const currentIndex = sedsList.indexOf(currentSedId);
    let newIndex = currentIndex + dir;
    if (newIndex < 0) newIndex = sedsList.length - 1;
    if (newIndex >= sedsList.length) newIndex = 0;
    setCurrentSedId(sedsList[newIndex]);
    
    // Select first llave of the new SED
    const llaves = Object.keys(localDatabase[sedsList[newIndex]].llaves || {});
    if (llaves.length > 0) {
      setCurrentLlaveId(llaves[0]);
    } else {
      setCurrentLlaveId('');
    }
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isPresentationMode) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigateSed(1);
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navigateSed(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPresentationMode, currentSedId, localDatabase]);

  const currentLlaveData = currentSedId && currentLlaveId && localDatabase[currentSedId]?.llaves?.[currentLlaveId]
    ? localDatabase[currentSedId].llaves[currentLlaveId]
    : null;

  const currentSedCoord = localDatabase[currentSedId]?.sedCoord || null;

  async function handleEnterEditMode() {
    const allowed = await checkEditPermission();
    if (allowed) {
      setIsPresentationMode(false);
    }
  }

  return (
    <>
      {!isPresentationMode && (
        <Sidebar
          seds={localDatabase}
          faultPoints={numberedPointsList}
          filteredFaultPoints={filteredPoints}
          currentSedId={currentSedId}
          setCurrentSedId={handleSedSelect}
          currentLlaveId={currentLlaveId}
          setCurrentLlaveId={setCurrentLlaveId}
          currentTheme={currentTheme}
          setCurrentTheme={setCurrentTheme}
          currentMapStyle={currentMapStyle}
          setCurrentMapStyle={setCurrentMapStyle}
          isAddPointMode={isAddPointMode}
          setIsAddPointMode={setIsAddPointMode}
          isPresentationMode={isPresentationMode}
          isEditable={isEditable}
          onTogglePresentationMode={() => setIsPresentationMode(true)}
          onImportJson={handleImportJson}
          onImportJsonText={handleImportJsonText}
          onImportExcel={handleImportExcel}
          onExportJson={handleExportJson}
          onExportExcel={handleExportExcel}
          onSaveToMainDatabase={handleSaveToMainDatabase}
          onDeleteSed={handleDeleteSed}
          onDeleteLlave={handleDeleteLlave}
          onEditPoint={(idx) => { setEditingPointIndex(idx); setIsFormOpen(true); }}
          onDeletePoint={handleDeletePoint}
          onRelocatePoint={handleRelocatePoint}
        />
      )}
      
      <div className="map-container">
        <MapViewer
          ref={mapRef}
          currentTheme={currentTheme}
          currentMapStyle={currentMapStyle}
          llaveData={currentLlaveData}
          sedId={currentSedId}
          sedCoord={currentSedCoord}
          faultPoints={filteredPoints}
          isAddPointMode={isAddPointMode}
          isPresentationMode={isPresentationMode}
          onMapClick={handleMapClick}
          onSedDragEnd={handleSedDragEnd}
          onPointClick={(idx) => { setEditingPointIndex(idx); setIsFormOpen(true); }}
        />
      </div>
      
      {isPresentationMode && (
        <>
          <PresentationHUD
            sedName={localDatabase[currentSedId]?.name || currentSedId || 'Sin SED'}
            llaveName={currentLlaveId || 'Sin Llave'}
            currentMapStyle={currentMapStyle}
            onPrevSed={() => navigateSed(-1)}
            onNextSed={() => navigateSed(1)}
            onToggleMapStyle={() => setCurrentMapStyle(s => s === 'clean' ? 'detailed' : 'clean')}
            onEnterEditMode={handleEnterEditMode}
          />
          <PresentationTablePanel
            points={filteredPoints}
            onRowClick={handleFlyToPoint}
          />
        </>
      )}
      
      <FaultForm
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingPointIndex(null); }}
        onSave={handleSavePoint}
        editingPoint={editingPointIndex !== null ? numberedPointsList[editingPointIndex] : null}
        defaultSedLlave={`${currentSedId}-${currentLlaveId}`}
      />
    </>
  );
}
