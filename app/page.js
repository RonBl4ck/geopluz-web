'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import * as XLSX from 'xlsx';
import Sidebar from '@/components/Sidebar';
import FaultForm from '@/components/FaultForm';
import PresentationHUD from '@/components/PresentationHUD';
import PresentationTablePanel from '@/components/PresentationTablePanel';
import TicketConflictModal from '@/components/TicketConflictModal';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { exportExcelBySed } from '@/lib/excelUtils';
import { getCachedSeds, setCachedSeds } from '@/lib/dbCache';

// MapViewer importado dinámicamente para evitar SSR
const MapViewer = dynamic(() => import('@/components/MapViewer'), { ssr: false });

export default function Page() {
  // Estado de Datos
  const [localDatabase, setLocalDatabase] = useState({});
  const [numberedPointsList, setNumberedPointsList] = useState([]);

  // Estado de Conflictos de JSON (Centro de Control)
  const [conflictsList, setConflictsList] = useState([]);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [currentSourceName, setCurrentSourceName] = useState('');

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

  // Carga de Datos desde IndexedDB Caché / Supabase
  async function loadData() {
    // 1. Intentar cargar SEDS & Llaves desde caché IndexedDB primero para respuesta instantánea
    try {
      const cachedDb = await getCachedSeds();
      if (cachedDb && Object.keys(cachedDb).length > 0) {
        setLocalDatabase(cachedDb);
      }
    } catch (cErr) {
      console.warn('Error leyendo caché IndexedDB:', cErr);
    }

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
        // Guardar la versión actualizada en IndexedDB
        setCachedSeds(db);
        
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
            linkCroquis: f.link_croquis || '',
            fotos: f.fotos || []
          }));
          setNumberedPointsList(points);
        }
      }
    } catch (err) {
      console.log('Supabase no disponible, usando caché local:', err.message);
    }
  }

  // Filtrado de Puntos
  const getFilteredPoints = useCallback(() => {
    return numberedPointsList
      .map((pt, i) => ({ ...pt, originalIndex: i }))
      .filter(pt => {
        if (!currentSedId) return true;
        const ptSed = pt.sed || (pt.sedLlave ? pt.sedLlave.split('-')[0] : '');
        return ptSed === currentSedId || (pt.sedLlave && pt.sedLlave.includes(currentSedId));
      })
      .map((pt, i) => ({ ...pt, localNumber: i + 1 }));
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
          mergeJsonData(rawData, file.name);
        } catch(err) {
          alert(`❌ Error al leer el archivo JSON "${file.name}":\n` + err.message);
        }
      };
      reader.onerror = () => {
        alert(`❌ Error de lectura en "${file.name}". Es posible que el archivo esté bloqueado por el antivirus o por otra aplicación.`);
      };
      reader.readAsText(file);
    });
  }

  function handleImportJsonText(jsonText) {
    if (!jsonText || !jsonText.trim()) return;
    try {
      const rawData = JSON.parse(jsonText.trim());
      mergeJsonData(rawData, 'Texto Pegado');
    } catch(err) {
      alert('❌ Error al procesar el código JSON pegado. Verifique que el formato esté completo y sea un JSON válido.\nDetalle: ' + err.message);
    }
  }

  // Funciones auxiliares para extracción flexible de columnas/propiedades
  function getFlexibleValue(obj, possibleKeys) {
    if (!obj || typeof obj !== 'object') return '';
    for (const k of possibleKeys) {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
        return obj[k];
      }
    }
    const normalizedObj = {};
    for (const key in obj) {
      const normKey = key.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
      normalizedObj[normKey] = obj[key];
    }
    for (const k of possibleKeys) {
      const normSearchKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedObj[normSearchKey] !== undefined && normalizedObj[normSearchKey] !== null && normalizedObj[normSearchKey] !== '') {
        return normalizedObj[normSearchKey];
      }
    }
    return '';
  }

  function extractCoordsFromRow(row) {
    let lat = parseFloat(getFlexibleValue(row, ['latitud', 'lat', 'y', 'latitud1']));
    let lng = parseFloat(getFlexibleValue(row, ['longitud', 'lng', 'long', 'x', 'longitud1']));

    if (isNaN(lat) || isNaN(lng)) {
      const rawCoords = getFlexibleValue(row, ['coords', 'coordenadas', 'gps', 'location', 'coordenada']);
      if (typeof rawCoords === 'string' && rawCoords.includes(',')) {
        const parts = rawCoords.split(',');
        if (parts.length >= 2) {
          const pLat = parseFloat(parts[0].trim());
          const pLng = parseFloat(parts[1].trim());
          if (!isNaN(pLat) && !isNaN(pLng)) {
            lat = pLat;
            lng = pLng;
          }
        }
      } else if (Array.isArray(rawCoords) && rawCoords.length >= 2 && typeof rawCoords[0] === 'number') {
        lat = rawCoords[0];
        lng = rawCoords[1];
      }
    }

    if (!isNaN(lat) && !isNaN(lng)) {
      return [lat, lng];
    }
    return null;
  }

  function mergeJsonData(rawData, sourceName = 'Archivo') {
    if (!rawData) {
      alert(`⚠️ El contenido de ${sourceName} está vacío.`);
      return;
    }

    let processedAny = false;

    // 1. Estructura de red (SEDs y Llaves)
    let incoming = {};
    const rootSedsObj = rawData.seds || rawData.subestaciones || rawData.red || rawData.database;

    if (rootSedsObj && typeof rootSedsObj === 'object' && !Array.isArray(rootSedsObj)) {
      incoming = rootSedsObj;
    } else if (Array.isArray(rawData)) {
      // Si es un Array, comprobar si los elementos parecen SEDs (tienen 'llaves' o 'lines' o 'sedCoord')
      const looksLikeSeds = rawData.length > 0 && (rawData[0].llaves || rawData[0].sedCoord || (rawData[0].id && !rawData[0].ticket && !rawData[0].falla));
      if (looksLikeSeds) {
        rawData.forEach(item => { if (item && item.id) incoming[item.id] = item; });
      }
    } else if (rawData.id && (rawData.llaves || rawData.sedCoord)) {
      incoming[rawData.id] = rawData;
    } else if (typeof rawData === 'object' && !Array.isArray(rawData)) {
      for (const k in rawData) {
        if (rawData[k] && typeof rawData[k] === 'object' && (rawData[k].llaves || rawData[k].sedCoord || k.endsWith('S') || k.startsWith('SED'))) {
          incoming[k] = rawData[k];
        }
      }
    }

    if (Object.keys(incoming).length > 0) {
      processedAny = true;
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
          alert(`✅ ¡RED ELÉCTRICA CARGADA DESDE ${sourceName.toUpperCase()}!\n\nSe detectaron ${realCount} Subestación(es) (SEDs) con sus llaves.`);
        }, 100);

        return updated;
      });
    }

    // 2. Detección flexible de fallas/puntos en el JSON
    let incomingFallas = [];
    if (rawData.fallas && Array.isArray(rawData.fallas)) {
      incomingFallas = rawData.fallas;
    } else if (rawData.points && Array.isArray(rawData.points)) {
      incomingFallas = rawData.points;
    } else if (rawData.incidencias && Array.isArray(rawData.incidencias)) {
      incomingFallas = rawData.incidencias;
    } else if (rawData.averias && Array.isArray(rawData.averias)) {
      incomingFallas = rawData.averias;
    } else if (rawData.records && Array.isArray(rawData.records)) {
      incomingFallas = rawData.records;
    } else if (rawData.data && Array.isArray(rawData.data)) {
      incomingFallas = rawData.data;
    } else if (rawData.type === 'FeatureCollection' && Array.isArray(rawData.features)) {
      incomingFallas = rawData.features.map(f => ({
        ...(f.properties || {}),
        coords: f.geometry && f.geometry.coordinates ? [f.geometry.coordinates[1], f.geometry.coordinates[0]] : null
      }));
    } else if (Array.isArray(rawData)) {
      const first = rawData[0];
      if (first && (first.ticket || first.falla || first.falla_real || first.coords || first.latitud || first.incidencia || first.suministro)) {
        incomingFallas = rawData;
      }
    }

    let loadedFirstSed = null;

    if (incomingFallas.length > 0) {
      processedAny = true;
      let addedCount = 0;
      const detectedConflicts = [];

      setNumberedPointsList(prev => {
        const existing = [...prev];
        const existingMap = new Map();
        existing.forEach(p => {
          if (p.ticket) {
            existingMap.set(String(p.ticket).trim().toLowerCase(), p);
          }
        });

        incomingFallas.forEach(pt => {
          const ticketVal = String(getFlexibleValue(pt, ['ticket', 'nro', 'incidencia', 'id', 'nroticket'])).trim();
          const ticketKey = ticketVal ? ticketVal.toLowerCase() : '';

          const coords = pt.coords || extractCoordsFromRow(pt);
          const sedLlaveVal = String(getFlexibleValue(pt, ['sedllave', 'sed_llave', 'circuito']) || '00007S-3SP');
          const partes = sedLlaveVal.split('-');
          const sedVal = String(pt.sed || (partes[0] ? partes[0] : 'SED'));
          const llaveSysVal = String(pt.llaveSistema || (partes[1] ? partes[1] : 'LLAVE'));

          if (!loadedFirstSed && sedVal) {
            loadedFirstSed = sedVal;
          }

          const preparedPoint = {
            coords: coords,
            ticket: ticketVal || `TK-${existing.length + 1}`,
            horaInicio: String(getFlexibleValue(pt, ['horainicio', 'hora', 'fecha', 'inicio']) || new Date().toLocaleString()),
            zona: String(getFlexibleValue(pt, ['zona', 'distrito', 'area']) || 'Zona Norte'),
            set: String(getFlexibleValue(pt, ['set', 'subestacion']) || 'SET'),
            alimentador: String(getFlexibleValue(pt, ['alimentador', 'alim', 'circuito']) || 'Alim'),
            nota: String(getFlexibleValue(pt, ['nota', 'comentario', 'observacion']) || 'Falla atendida'),
            odm: String(getFlexibleValue(pt, ['odm', 'orden']) || 'ODM-000'),
            suministro: String(getFlexibleValue(pt, ['suministro', 'nis']) || 'N/A'),
            sedLlave: sedLlaveVal,
            sed: sedVal,
            llaveSistema: llaveSysVal,
            llaveCampo: String(pt.llaveCampo || `${llaveSysVal} (Campo)`),
            falla: String(getFlexibleValue(pt, ['falla', 'fallareal', 'averia', 'descripcion']) || 'Avería reparada'),
            causa: String(getFlexibleValue(pt, ['causa', 'diagnostico']) || 'Deterioro'),
            linkCroquis: String(getFlexibleValue(pt, ['linkcroquis', 'croquis', 'link', 'mapa', 'url']) || ''),
            fotos: pt.fotos || []
          };

          if (ticketKey && existingMap.has(ticketKey)) {
            // Detectado duplicado para el Centro de Control
            detectedConflicts.push({
              ticketKey: ticketKey,
              existing: existingMap.get(ticketKey),
              incoming: preparedPoint
            });
          } else {
            // Nuevo registro sin conflicto
            const pointNum = existing.length + 1;
            const newPoint = { ...preparedPoint, number: pointNum };
            existing.push(newPoint);
            if (ticketKey) existingMap.set(ticketKey, newPoint);
            addedCount++;
          }
        });

        return existing;
      });

      if (loadedFirstSed) {
        setCurrentSedId(loadedFirstSed);
      }

      if (detectedConflicts.length > 0) {
        setConflictsList(detectedConflicts);
        setCurrentSourceName(sourceName);
        setIsConflictModalOpen(true);
      } else {
        setTimeout(() => {
          alert(`✅ ¡FALLAS CARGADAS DESDE ${sourceName.toUpperCase()}!\n\n• Agregados: ${addedCount} registro(s) nuevo(s).`);
        }, 100);
      }
    }

    if (!processedAny) {
      const topKeys = typeof rawData === 'object' && rawData !== null ? Object.keys(rawData).slice(0, 8).join(', ') : 'Ninguna';
      alert(`⚠️ El archivo "${sourceName}" fue leído correctamente, pero su estructura no fue reconocida como Red de SEDs ni Registro de Fallas.\n\n• Claves encontradas en la raíz del JSON: [${topKeys}]\n\nSi el explorador bloquea el archivo, puede usar el botón 'Pegar JSON'.`);
    }
  }

  // Manejo de Selección de Datos (A vs B)
  const handleResolveConflicts = (decisions) => {
    let replacedCount = 0;
    let keptCount = 0;

    setNumberedPointsList(prev => {
      const updated = prev.map(pt => {
        const tKey = String(pt.ticket).trim().toLowerCase();
        const decision = decisions[tKey];
        if (!decision) return pt;

        const conflict = conflictsList.find(c => c.ticketKey === tKey);
        if (!conflict) return pt;

        if (decision === 'B') {
          replacedCount++;
          return {
            ...pt,
            ...conflict.incoming,
            number: pt.number // Preservar posición
          };
        } else {
          keptCount++;
          return pt;
        }
      });
      return updated;
    });

    setIsConflictModalOpen(false);
    setConflictsList([]);

    setTimeout(() => {
      alert(`✅ ¡SELECCIÓN APLICADA CON ÉXITO!\n\n• Conservados con el Registro Existente (Dato A): ${keptCount}\n• Reemplazados por el Nuevo del JSON (Dato B): ${replacedCount}`);
    }, 100);
  };

  // Importación Excel
  function handleImportExcel(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        let importedPoints = 0;
        let skippedPoints = 0;
        const newPoints = [...numberedPointsList];
        const existingTickets = new Set(newPoints.map(p => String(p.ticket).trim().toLowerCase()).filter(Boolean));
        let firstImportedSed = null;

        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          jsonRows.forEach(row => {
            const ticket = String(getFlexibleValue(row, ['ticket', 'nro', 'incidencia', 'id', 'nroticket'])).trim();
            const coords = extractCoordsFromRow(row);

            if (ticket || coords) {
              const ticketKey = ticket.toLowerCase();
              if (ticketKey && existingTickets.has(ticketKey)) {
                skippedPoints++;
                return;
              }
              if (ticketKey) existingTickets.add(ticketKey);

              const sedLlaveVal = String(getFlexibleValue(row, ['sedllave', 'sed_llave', 'circuito']) || sheetName || '00007S-5SP');
              const partes = sedLlaveVal.split('-');
              const sedVal = partes[0] || '00007S';
              const llaveVal = partes[1] || '5SP';

              if (!firstImportedSed && sedVal) {
                firstImportedSed = sedVal;
              }

              const pointNum = newPoints.length + 1;
              const pointData = {
                number: pointNum,
                coords: coords,
                ticket: ticket || `TK-${Math.floor(Math.random()*90000+10000)}`,
                horaInicio: String(getFlexibleValue(row, ['horainicio', 'hora', 'fecha', 'inicio']) || new Date().toLocaleString()),
                zona: String(getFlexibleValue(row, ['zona', 'distrito', 'area']) || 'Zona Centro'),
                set: String(getFlexibleValue(row, ['set', 'subestacion']) || 'SET'),
                alimentador: String(getFlexibleValue(row, ['alimentador', 'alim', 'circuito']) || 'Alim'),
                nota: String(getFlexibleValue(row, ['nota', 'comentario', 'observacion']) || 'Falla atendida'),
                odm: String(getFlexibleValue(row, ['odm', 'orden']) || 'ODM-000'),
                suministro: String(getFlexibleValue(row, ['suministro', 'nis']) || 'N/A'),
                sedLlave: sedLlaveVal,
                sed: sedVal,
                llaveSistema: llaveVal,
                llaveCampo: `${llaveVal} (Campo)`,
                falla: String(getFlexibleValue(row, ['falla', 'fallareal', 'averia', 'descripcion']) || 'Avería reparada'),
                causa: String(getFlexibleValue(row, ['causa', 'diagnostico']) || 'Deterioro'),
                linkCroquis: String(getFlexibleValue(row, ['linkcroquis', 'croquis', 'link', 'mapa', 'url']) || '')
              };
              newPoints.push(pointData);
              importedPoints++;
              saveFallaToSupabase(pointData);
            }
          });
        });

        setNumberedPointsList(newPoints);

        if (firstImportedSed) {
          setCurrentSedId(firstImportedSed);
        }

        let msg = `✅ EXCEL IMPORTADO:\n\n• Agregados: ${importedPoints} registros.`;
        if (skippedPoints > 0) {
          msg += `\n• Omitidos por Ticket duplicado: ${skippedPoints} registros.`;
        }
        alert(msg);
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
    const dataToExport = numberedPointsList.length > 0 ? numberedPointsList : filteredPoints;
    exportExcelBySed(dataToExport, currentSedId);
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
  // Usando useCallback para que la referencia se actualice cuando cambie relocatingPointIndex,
  // lo que permite que la ref en MapViewer siempre tenga el callback más reciente.
  const handleMapClick = useCallback(async (latlng) => {
    if (relocatingPointIndex !== null) {
      const allowed = await checkEditPermission();
      if (!allowed) {
        setRelocatingPointIndex(null);
        return;
      }
      setNumberedPointsList(prev => {
        const updated = [...prev];
        const targetPoint = updated[relocatingPointIndex];
        if (targetPoint) {
          updated[relocatingPointIndex] = {
            ...targetPoint,
            coords: [latlng.lat, latlng.lng]
          };
          saveFallaToSupabase(updated[relocatingPointIndex]);
          alert(`✅ Punto de Falla #${targetPoint.localNumber || targetPoint.number || ''} reubicado con éxito en: ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`);
        }
        return updated;
      });
      setRelocatingPointIndex(null);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relocatingPointIndex, isAddPointMode, isPresentationMode, numberedPointsList, currentSedId, currentLlaveId]);

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
        link_croquis: point.linkCroquis || null,
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
  async function handleDeletePoint(index) {
    const allowed = await checkEditPermission();
    if (!allowed) return;
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
  async function handleDeleteSed(sedId) {
    const allowed = await checkEditPermission();
    if (!allowed) return;
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

  async function handleDeleteLlave(sedId, llaveId) {
    const allowed = await checkEditPermission();
    if (!allowed) return;
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
  async function handleRelocatePoint(index) {
    const allowed = await checkEditPermission();
    if (!allowed) return;
    setRelocatingPointIndex(index);
    alert('Haz clic en el mapa en la nueva ubicación.');
  }

  async function saveSedsToSupabase(sedsToSave) {
    // Guardar en la caché local IndexedDB
    setCachedSeds(sedsToSave);

    if (!isSupabaseConfigured || !supabase) {
      try {
        await fetch('/api/seds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sedsToSave)
        });
      } catch (err) {
        console.warn('Error guardando SEDs vía API:', err.message);
      }
      return;
    }
    try {
      const sedsBatch = [];
      const llavesBatch = [];

      for (const sedId in sedsToSave) {
        const sed = sedsToSave[sedId];
        sedsBatch.push({
          id: sedId,
          name: sed.name || `SED ${sedId}`,
          sed_coord: sed.sedCoord || null
        });

        if (sed.llaves) {
          for (const llaveCode in sed.llaves) {
            const llave = sed.llaves[llaveCode];
            llavesBatch.push({
              sed_id: sedId,
              llave_code: llaveCode,
              name: llave.name || llaveCode,
              lines_data: llave.lines || []
            });
          }
        }
      }

      const CHUNK_SIZE = 500;
      for (let i = 0; i < sedsBatch.length; i += CHUNK_SIZE) {
        await supabase.from('seds').upsert(sedsBatch.slice(i, i + CHUNK_SIZE));
      }
      for (let i = 0; i < llavesBatch.length; i += CHUNK_SIZE) {
        await supabase.from('llaves').upsert(llavesBatch.slice(i, i + CHUNK_SIZE), { onConflict: 'sed_id,llave_code' });
      }
    } catch (err) {
      console.warn('Error guardando SEDs en Supabase:', err.message);
    }
  }

  async function handleSaveToMainDatabase() {
    const allowed = await checkEditPermission();
    if (!allowed) return;

    try {
      await saveSedsToSupabase(localDatabase);

      if (numberedPointsList.length > 0) {
        for (const point of numberedPointsList) {
          await saveFallaToSupabase(point);
        }
      }
      alert('✅ ¡Datos sincronizados exitosamente con la Base de Datos Principal en la Nube!');
    } catch (err) {
      alert('❌ Error al guardar en la Base Principal: ' + err.message);
    }
  }

  async function handleSedDragEnd(sedId, latlng) {
    const allowed = await checkEditPermission();
    if (!allowed) return;
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
          isRelocating={relocatingPointIndex !== null}
          isPresentationMode={isPresentationMode}
          onMapClick={handleMapClick}
          onSedDragEnd={handleSedDragEnd}
          onPointClick={(idx) => { setEditingPointIndex(idx); setIsFormOpen(true); }}
        />
      </div>
      
      {isPresentationMode && (
        <>
          <PresentationHUD
            sedId={currentSedId}
            sedName={localDatabase[currentSedId]?.name || currentSedId || 'Sin SED'}
            llaveName={currentLlaveId || 'Sin Llave'}
            sedsList={sedsList}
            onSelectSed={handleSedSelect}
            currentMapStyle={currentMapStyle}
            onPrevSed={() => navigateSed(-1)}
            onNextSed={() => navigateSed(1)}
            onToggleMapStyle={() => setCurrentMapStyle(s => s === 'clean' ? 'detailed' : 'clean')}
            onEnterEditMode={handleEnterEditMode}
            onExportExcel={handleExportExcel}
          />
          <PresentationTablePanel
            points={filteredPoints}
            onRowClick={handleFlyToPoint}
            onExportExcel={handleExportExcel}
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

      <TicketConflictModal
        isOpen={isConflictModalOpen}
        conflicts={conflictsList}
        onResolveAll={handleResolveConflicts}
      />
    </>
  );
}
