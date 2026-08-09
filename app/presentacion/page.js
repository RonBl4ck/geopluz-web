'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import PresentationHUD from '@/components/PresentationHUD';
import PresentationTablePanel from '@/components/PresentationTablePanel';
import { supabase } from '@/lib/supabase';
import { exportExcelBySed } from '@/lib/excelUtils';

// MapViewer importado dinámicamente para evitar SSR
const MapViewer = dynamic(() => import('@/components/MapViewer'), { ssr: false });

export default function PresentacionPage() {
  // Estado de Datos
  const [localDatabase, setLocalDatabase] = useState({});
  const [numberedPointsList, setNumberedPointsList] = useState([]);

  // Estado de Navegación
  const [currentSedId, setCurrentSedId] = useState('');
  const [currentLlaveId, setCurrentLlaveId] = useState('');

  // Estado UI
  const [currentMapStyle, setCurrentMapStyle] = useState('clean');
  
  const mapRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  // Carga de Datos desde Supabase
  async function loadData() {
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
            linkCroquis: f.link_croquis || '',
            fotos: f.fotos || []
          }));
          setNumberedPointsList(points);
        }

        // Initialize with first SED
        const firstSed = Object.keys(db)[0];
        if (firstSed) {
           setCurrentSedId(firstSed);
           const llaves = Object.keys(db[firstSed].llaves);
           if (llaves.length > 0) setCurrentLlaveId(llaves[0]);
        }
      }
    } catch (err) {
      console.log('Error al cargar datos:', err.message);
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

  function handleFlyToPoint(point) {
    if (mapRef.current && point.coords) {
      mapRef.current.flyTo(point.coords, 18);
    }
  }

  function handleExportExcel() {
    const dataToExport = numberedPointsList.length > 0 ? numberedPointsList : filteredPoints;
    exportExcelBySed(dataToExport, currentSedId);
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
    
    const llaves = Object.keys(localDatabase[sedsList[newIndex]].llaves || {});
    if (llaves.length > 0) {
      setCurrentLlaveId(llaves[0]);
    } else {
      setCurrentLlaveId('');
    }
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigateSed(1);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navigateSed(-1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSedId, localDatabase]);

  const currentLlaveData = currentSedId && currentLlaveId && localDatabase[currentSedId]?.llaves?.[currentLlaveId]
    ? localDatabase[currentSedId].llaves[currentLlaveId]
    : null;

  const currentSedCoord = localDatabase[currentSedId]?.sedCoord || null;

  return (
    <>
      <div className="map-container">
        <MapViewer
          ref={mapRef}
          currentTheme="dark"
          currentMapStyle={currentMapStyle}
          llaveData={currentLlaveData}
          sedId={currentSedId}
          sedCoord={currentSedCoord}
          faultPoints={filteredPoints}
          isAddPointMode={false}
          isPresentationMode={true}
          onMapClick={() => {}}
          onSedDragEnd={() => {}}
          onPointClick={(idx) => handleFlyToPoint(filteredPoints.find(p => p.localNumber - 1 === idx))}
        />
      </div>
      
      <PresentationHUD
        sedId={currentSedId}
        sedName={localDatabase[currentSedId]?.name || currentSedId || 'Sin SED'}
        llaveName={currentLlaveId || 'Sin Llave'}
        sedsList={sedsList}
        onSelectSed={(sedId) => {
          setCurrentSedId(sedId);
          const llaves = Object.keys(localDatabase[sedId]?.llaves || {});
          if (llaves.length > 0) setCurrentLlaveId(llaves[0]);
          else setCurrentLlaveId('');
        }}
        currentMapStyle={currentMapStyle}
        onPrevSed={() => navigateSed(-1)}
        onNextSed={() => navigateSed(1)}
        onToggleMapStyle={() => setCurrentMapStyle(s => s === 'clean' ? 'detailed' : 'clean')}
        onEnterEditMode={() => { window.location.href = '/'; }}
        onExportExcel={handleExportExcel}
      />
      <PresentationTablePanel
        points={filteredPoints}
        onRowClick={handleFlyToPoint}
        onExportExcel={handleExportExcel}
      />
    </>
  );
}
