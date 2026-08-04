'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { fixCoord, getWeightForZoom } from '@/lib/coordUtils';
import { TILE_LAYERS, MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM, MAP_MAX_ZOOM } from '@/lib/constants';

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
    // Usamos ref para que siempre se llame la versión más reciente del callback
    map.on('click', (e) => {
      if (onMapClickRef.current) onMapClickRef.current(e.latlng);
    });

    map.on('zoomend', () => {
      const zoom = map.getZoom();
      const weight = getWeightForZoom(zoom);
      networkLayerGroupRef.current.eachLayer((layer) => {
        if (layer instanceof L.Polyline) {
          layer.setStyle({ weight });
        }
      });
    });

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

    const fixedSedCoord = sedCoord ? fixCoord(sedCoord) : null;

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
        sedMarkerRef.current.bindTooltip(`
          <div style="font-size:11px;">
            <b style="color:#ffab00;">⚡ SUBESTACIÓN (SED ${sedId})</b><br>
            <span>💡 Arrastra este cuadrado amarillo si necesitas mover la SED</span>
          </div>
        `, { sticky: true });
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
  }, [llaveData, sedCoord, sedId, currentTheme]);

  // Dibujar puntos de falla
  useEffect(() => {
    const L = LRef.current;
    if (!L || !mapInstanceRef.current) return;
    
    const pointsGroup = pointsLayerGroupRef.current;
    pointsGroup.clearLayers();

    if (faultPoints && faultPoints.length > 0) {
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
          const pointIcon = L.divIcon({
            className: 'fault-point-wrapper',
            html: `<div class="fault-marker" style="background-color: #f44336; color: white; border-radius: 50%; width: 25px; height: 25px; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.6);">${displayNum}</div>`,
            iconSize: [25, 25],
            iconAnchor: [12.5, 12.5]
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
          const causaHtml = pt.causa ? `<p style="margin: 3px 0;"><b>💡 Causa:</b> ${pt.causa}</p>` : '';

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
  }, [faultPoints, isPresentationMode, onPointClick]);

  // Manejar modo de añadir punto / reubicar
  useEffect(() => {
    if (!mapRef.current) return;
    if (isAddPointMode || isRelocating) {
      mapRef.current.style.cursor = 'crosshair';
    } else {
      mapRef.current.style.cursor = '';
    }
  }, [isAddPointMode, isRelocating]);

  return <div id="map" ref={mapRef} style={{ width: '100%', height: '100%' }}></div>;
});

MapViewer.displayName = 'MapViewer';
export default MapViewer;
