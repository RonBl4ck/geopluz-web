export const TILE_LAYERS = {
  clean: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    options: {
      maxNativeZoom: 19,
      maxZoom: 22,
      attribution: '&copy; CartoDB Voyager (Mapa Limpio)'
    },
    label: 'Mapa Limpio',
    icon: 'fa-solid fa-layer-group'
  },
  detailed: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxNativeZoom: 19,
      maxZoom: 22,
      attribution: '&copy; OpenStreetMap (Mapa Detallado)'
    },
    label: 'Mapa Detallado',
    icon: 'fa-solid fa-map-location-dot'
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    options: {
      maxNativeZoom: 19,
      maxZoom: 22,
      attribution: '&copy; CartoDB Dark'
    },
    label: 'Mapa Oscuro',
    icon: 'fa-solid fa-moon'
  }
};

export const MAP_DEFAULT_CENTER = [-11.502289, -77.205444];
export const MAP_DEFAULT_ZOOM = 16;
export const MAP_MAX_ZOOM = 22;
