'use client';

import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { fixCoord, getWeightForZoom } from '@/lib/coordUtils';
import { TILE_LAYERS, MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM, MAP_MAX_ZOOM, FAULT_CAUSES, DEFAULT_CAUSE_COLOR, getCauseCategory } from '@/lib/constants';


const MapViewer = forwardRef(({
  currentTheme,
  currentMapStyle,
  llaveData,
  sedId,
  sedCoord,
  faultPoints,
  isAddPointMode,
  isRelocating,
  isPresentationMode,
  onMapClick,
  onSedDragEnd,
  onPointClick
}, ref) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const cleanTileLayerRef = useRef(null);
  const osmTileLayerRef = useRef(null);
  const darkTileLayerRef = useRef(null);
  const networkLayerGroupRef = useRef(null);
  const pointsLayerGroupRef = useRef(null);
  const sedMarkerRef = useRef(null);
  const [sedsMasterDB, setSedsMasterDB] = useState({});
  const [mapViewport, setMapViewport] = useState({ bounds: null, zoom: MAP_DEFAULT_ZOOM });
  const [showLegend, setShowLegend] = useState(true);

  useEffect(() => {
    fetch('/seds_master_db.min.json')
      .then(res => res.ok ? res.json() : {})
      .then(data => setSedsMasterDB(data))
      .catch(err => console.warn('No se pudo cargar seds_master_db.min.json:', err));
  }, []);

  // Ref para mantener siempre la versión más reciente de onMapClick
  const onMapClickRef = useRef(onMapClick);

  // Actualizar la ref cada vez que cambie el prop
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);
  
  // Guardamos L en una ref para acceso posterior
  const LRef = useRef(null);

  useImperativeHandle(ref, () => ({
    flyTo: (coords, zoom) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo(coords, zoom, { duration: 1.5 });
      }
    },
    invalidateSize: () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    },
    fitBounds: (bounds) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }));

  // Inicializar mapa
  useEffect(() => {
    // Importación dinámica de Leaflet
    const L = require('leaflet');
    require('leaflet/dist/leaflet.css');
    LRef.current = L;

    if (!mapRef.current) return;
    if (mapInstanceRef.current) return; // Evitar reinicialización

    const map = L.map(mapRef.current, {
      center: MAP_DEFAULT_CENTER,
      zoom: MAP_DEFAULT_ZOOM,
      zoomControl: false,
      maxZoom: MAP_MAX_ZOOM,
      attributionControl: false
    });

    // Control de zoom
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Definir capas base
    cleanTileLayerRef.current = L.tileLayer(TILE_LAYERS.clean.url, TILE_LAYERS.clean.options);
    osmTileLayerRef.current = L.tileLayer(TILE_LAYERS.detailed.url, TILE_LAYERS.detailed.options);
    darkTileLayerRef.current = L.tileLayer(TILE_LAYERS.dark.url, TILE_LAYERS.dark.options);

    // Grupos de capas
    networkLayerGroupRef.current = L.layerGroup().addTo(map);
    pointsLayerGroupRef.current = L.layerGroup().addTo(map);

    // Eventos del mapa
    map.on('click', (e) => {
      if (onMapClickRef.current) onMapClickRef.current(e.latlng);
    });

    const updateViewport = () => {
      const zoom = map.getZoom();
      const bounds = map.getBounds();
      setMapViewport({ bounds, zoom });
      
      const weight = getWeightForZoom(zoom);
      networkLayerGroupRef.current.eachLayer((layer) => {
        if (layer instanceof L.Polyline) {
          layer.setStyle({ weight });
        }
      });
    };

    map.on('zoomend moveend', updateViewport);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Actualizar capa base según tema y estilo
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Remover todas primero
    map.removeLayer(cleanTileLayerRef.current);
    map.removeLayer(osmTileLayerRef.current);
    map.removeLayer(darkTileLayerRef.current);

    if (currentTheme === 'dark') {
      darkTileLayerRef.current.addTo(map);
    } else {
      if (currentMapStyle === 'clean') {
        cleanTileLayerRef.current.addTo(map);
      } else {
        osmTileLayerRef.current.addTo(map);
      }
    }
  }, [currentTheme, currentMapStyle]);

  // Dibujar red (llaveData y SED)
  useEffect(() => {
    const L = LRef.current;
    if (!L || !mapInstanceRef.current) return;
    
    const networkGroup = networkLayerGroupRef.current;
    networkGroup.clearLayers();

    const bounds = [];

    if (llaveData && llaveData.lines && llaveData.lines.length > 0) {
      const lineColor = currentTheme === 'dark' ? '#00e5ff' : '#0077c2';
      const zoom = mapInstanceRef.current.getZoom();
      const weight = getWeightForZoom(zoom);

      llaveData.lines.forEach(line => {
        if (line.coords && line.coords.length > 0) {
          const fixedCoords = line.coords.map(c => fixCoord(c));

          const polyline = L.polyline(fixedCoords, {
            color: lineColor,
            weight: weight,
            opacity: 0.9
          }).addTo(networkGroup);

          if (line.id || line.length) {
            polyline.bindTooltip(`
              <div style="font-size:11px;">
                <b>Circuito:</b> ${llaveData.name || 'Llave'}<br>
                <b>Longitud:</b> ${line.length || 0} m<br>
                <b>ID Tramo:</b> ${line.id || 'N/A'}
              </div>
            `, { sticky: true });
          }

          fixedCoords.forEach(c => bounds.push(c));
        }
      });
    }

    let masterSed = null;
    if (sedId && sedsMasterDB) {
      masterSed = sedsMasterDB[sedId] || 
                sedsMasterDB[sedId.replace(/^0+/, '')] || 
                sedsMasterDB[sedId + 'S'] || 
                sedsMasterDB[sedId.padStart(6, '0')];
      if (!masterSed) {
        const keys = Object.keys(sedsMasterDB);
        const foundKey = keys.find(k => k.includes(sedId) || sedId.includes(k));
        if (foundKey) masterSed = sedsMasterDB[foundKey];
      }
    }

    let fixedSedCoord = sedCoord ? fixCoord(sedCoord) : null;
    if (!fixedSedCoord && masterSed && masterSed.lat && masterSed.lng) {
      fixedSedCoord = [masterSed.lat, masterSed.lng];
    }

    if (fixedSedCoord && fixedSedCoord[0] !== 0 && fixedSedCoord[1] !== 0) {
      const sedIcon = L.divIcon({
        className: 'sed-substation-wrapper',
        html: `<div class="sed-substation-icon" title="SED ${sedId} (Arrastra para mover la SED)">⚡</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      sedMarkerRef.current = L.marker(fixedSedCoord, {
        icon: sedIcon,
        draggable: true,
        zIndexOffset: 2000
      }).addTo(networkGroup);

      if (sedId) {
        let tooltipContent = `<div style="font-size:11px; max-width:240px;">
          <b style="color:#ffab00;">⚡ SUBESTACIÓN (SED ${sedId})</b>`;

        if (masterSed) {
          tooltipContent += `<div style="margin-top:4px; border-top:1px dashed #bbb; padding-top:4px; font-size:10.5px; line-height:1.4;">
            ${masterSed.cli !== undefined ? `<div>👥 <b>Clientes BT:</b> ${masterSed.cli.toLocaleString()}</div>` : ''}
            ${masterSed.kva !== undefined ? `<div>⚡ <b>Potencia:</b> ${masterSed.kva} KVA (${masterSed.kv || 10} kV)</div>` : ''}
            ${masterSed.tipo_const ? `<div>🏗️ <b>Construcción:</b> ${masterSed.tipo_const}</div>` : ''}
            ${masterSed.dir ? `<div>📍 <b>Dirección:</b> ${masterSed.dir} (${masterSed.dist || ''})</div>` : ''}
            ${masterSed.uo ? `<div>🏢 <b>UO:</b> ${masterSed.uo}</div>` : ''}
          </div>`;
        }

        tooltipContent += `<div style="margin-top:4px; font-size:9.5px; color:#666;">💡 Arrastra este marcador si deseas ajustar su posición</div></div>`;

        sedMarkerRef.current.bindTooltip(tooltipContent, { sticky: true });
      }

      sedMarkerRef.current.on('dragend', (e) => {
        const marker = e.target;
        const position = marker.getLatLng();
        if (onSedDragEnd) {
          onSedDragEnd([position.lat, position.lng]);
        }
      });

      bounds.push(fixedSedCoord);
    }

    // Centrar y enfocar automáticamente el mapa a los límites de la Llave seleccionada
    if (bounds.length > 0 && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 18, animate: true });
    }
  }, [llaveData, sedCoord, sedId, currentTheme, sedsMasterDB]);

  // Dibujar puntos de falla
  useEffect(() => {
    const L = LRef.current;
    if (!L || !mapInstanceRef.current) return;
    
    const pointsGroup = pointsLayerGroupRef.current;
    pointsGroup.clearLayers();

    if (faultPoints && faultPoints.length > 0) {
      const mapBounds = mapViewport.bounds || (mapInstanceRef.current ? mapInstanceRef.current.getBounds() : null);
      const currentZoom = mapViewport.zoom || (mapInstanceRef.current ? mapInstanceRef.current.getZoom() : MAP_DEFAULT_ZOOM);

      // Si no hay SED seleccionada y el zoom está muy alejado (< 8), ocultar para no sobrecargar
      if (!sedId && currentZoom < 8 && faultPoints.length > 10) {
        return;
      }

      faultPoints.forEach((pt) => {
        if (!pt.coords) return;
        
        const displayNum = pt.localNumber || pt.number || '';
        
        let coordsList = [];
        if (Array.isArray(pt.coords)) {
          if (Array.isArray(pt.coords[0])) {
            coordsList = pt.coords.map(c => fixCoord(c));
          } else {
            coordsList = [fixCoord(pt.coords)];
          }
        }

        if (coordsList.length === 0) return;

        // BBOX Filtering: verificar si al menos 1 coordenada está dentro de la pantalla visible
        if (mapBounds && !sedId && faultPoints.length > 15) {
          const isVisible = coordsList.some(c => mapBounds.contains(L.latLng(c[0], c[1])));
          if (!isVisible) return;
        }

        // Si la falla tiene múltiples puntos de arreglo, trazar línea punteada de conexión
        if (coordsList.length > 1) {
          L.polyline(coordsList, {
            color: '#f44336',
            dashArray: '6, 6',
            weight: 2.5,
            opacity: 0.85
          }).addTo(pointsGroup);
        }

        coordsList.forEach((coord, subIdx) => {
          const causeCat = getCauseCategory(pt.causa);
          const markerBg = causeCat.color;
          const markerTextColor = causeCat.textColor || '#ffffff';

          const pointIcon = L.divIcon({
            className: 'fault-point-wrapper',
            html: `<div class="fault-marker" style="background-color: ${markerBg}; color: ${markerTextColor}; border-radius: 50%; width: 26px; height: 26px; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.6);">${displayNum}</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          });

          const marker = L.marker(coord, { icon: pointIcon }).addTo(pointsGroup);
          
          const subInfo = coordsList.length > 1 ? ` (Punto ${subIdx + 1} de ${coordsList.length})` : '';

          const linkCroquis = pt.linkCroquis || pt.link_croquis || pt.croquis || '';

          const croquisHtml = linkCroquis
            ? `<div style="margin-top: 8px;">
                <a href="${linkCroquis}" target="_blank" rel="noopener noreferrer" style="display: block; width: 100%; text-align: center; padding: 6px 8px; background: #00897b; color: white; border-radius: 4px; font-weight: bold; text-decoration: none; box-sizing: border-box;">
                  🗺️ Abrir Link del Croquis (PDF) ↗
                </a>
               </div>`
            : '<p style="margin: 4px 0; color: #888; font-style: italic;">Sin Link de Croquis</p>';

          const notaHtml = pt.nota ? `<p style="margin: 3px 0;"><b>📝 Nota Específica:</b> ${pt.nota}</p>` : '';
          const horaHtml = pt.horaInicio ? `<p style="margin: 3px 0;"><b>🕒 Hora de Inicio:</b> ${pt.horaInicio}</p>` : '';
          const causaBadge = `<span style="display: inline-block; background-color: ${causeCat.color}; color: ${causeCat.textColor}; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-left: 4px;">${causeCat.label}</span>`;
          const causaHtml = `<p style="margin: 3px 0;"><b>💡 Causa:</b> ${pt.causa || causeCat.label} ${causaBadge}</p>`;

          const fotosHtml = (pt.fotos && pt.fotos.length > 0)
            ? `<div style="display:flex; gap:4px; margin-top:6px; overflow-x:auto;">
                ${pt.fotos.map(f => `<a href="${f.url}" target="_blank"><img src="${f.url}" style="width:45px; height:45px; object-fit:cover; border-radius:4px; border:1px solid #0077c2;" title="${f.name}"></a>`).join('')}
               </div>`
            : '';

          const popupContent = `
            <div style="min-width: 220px; max-width: 280px; font-size: 11px; line-height: 1.4;">
              <h4 style="margin: 0 0 6px 0; border-bottom: 1px solid #ccc; padding-bottom: 4px; color:#d32f2f;">📍 Falla #${displayNum}${subInfo}</h4>
              <p style="margin: 3px 0;"><b>Ticket:</b> ${pt.ticket || '-'}</p>
              ${horaHtml}
              <p style="margin: 3px 0;"><b>Falla Real:</b> ${pt.falla || pt.fallaReal || '-'}</p>
              ${causaHtml}
              <p style="margin: 3px 0;"><b>Suministro:</b> ${pt.suministro || '-'}</p>
              ${notaHtml}
              ${croquisHtml}
              ${fotosHtml}
              ${!isPresentationMode ? `<button class="edit-btn-popup" data-id="${pt.originalIndex}" style="margin-top: 8px; width: 100%; padding: 5px; background: #0288d1; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight:bold;">📝 Editar Datos / Fotos</button>` : ''}
            </div>
          `;
          
          marker.bindPopup(popupContent);
          
          marker.on('click', () => {
            if (!isPresentationMode && onPointClick) {
              onPointClick(pt.originalIndex);
            }
          });
        });
      });
    }
  }, [faultPoints, isPresentationMode, onPointClick, mapViewport, sedId]);

  // Manejar modo de añadir punto / reubicar
  useEffect(() => {
    if (!mapRef.current) return;
    if (isAddPointMode || isRelocating) {
      mapRef.current.style.cursor = 'crosshair';
    } else {
      mapRef.current.style.cursor = '';
    }
  }, [isAddPointMode, isRelocating]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div id="map" ref={mapRef} style={{ width: '100%', height: '100%' }}></div>

      {/* Leyenda de Causas de Falla */}
      <div className="map-legend-container" style={{
        position: 'absolute',
        bottom: '24px',
        left: '12px',
        zIndex: 1000,
        background: currentTheme === 'dark' ? 'rgba(18, 25, 44, 0.92)' : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${currentTheme === 'dark' ? 'rgba(0, 229, 255, 0.3)' : '#cbd5e0'}`,
        borderRadius: '8px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.25)',
        padding: showLegend ? '10px 12px' : '6px 10px',
        maxWidth: '250px',
        transition: 'all 0.2s ease',
        color: currentTheme === 'dark' ? '#e0f7fa' : '#1a202c',
        fontSize: '11px',
        userSelect: 'none'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '11.5px',
          borderBottom: showLegend ? `1px solid ${currentTheme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}` : 'none',
          paddingBottom: showLegend ? '6px' : '0',
          marginBottom: showLegend ? '8px' : '0'
        }} onClick={() => setShowLegend(!showLegend)}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa-solid fa-palette" style={{ color: 'var(--accent-cyan)' }}></i> Leyenda de Causas
          </span>
          <span style={{ fontSize: '10px', marginLeft: '8px', color: 'var(--accent-cyan)' }}>
            {showLegend ? '▼' : '▲'}
          </span>
        </div>

        {showLegend && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '220px', overflowY: 'auto' }}>
            {FAULT_CAUSES.map(cause => (
              <div key={cause.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: cause.color,
                  border: '1px solid rgba(0,0,0,0.25)',
                  flexShrink: 0,
                  boxShadow: '0 0 3px rgba(0,0,0,0.3)'
                }}></span>
                <span style={{ fontSize: '10.5px', fontWeight: 500 }}>{cause.label}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: `1px dashed ${currentTheme === 'dark' ? 'rgba(255,255,255,0.15)' : '#e2e8f0'}`, paddingTop: '4px', marginTop: '2px' }}>
              <span style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: DEFAULT_CAUSE_COLOR.color,
                border: '1px solid rgba(0,0,0,0.25)',
                flexShrink: 0,
                boxShadow: '0 0 3px rgba(0,0,0,0.3)'
              }}></span>
              <span style={{ fontSize: '10.5px', fontStyle: 'italic', color: currentTheme === 'dark' ? '#90a4ae' : '#64748b' }}>
                {DEFAULT_CAUSE_COLOR.label}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

});

MapViewer.displayName = 'MapViewer';
export default MapViewer;
