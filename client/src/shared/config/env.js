const trimTrailingSlash = (value) => String(value || '').trim().replace(/\/+$/, '');

export const clientEnv = {
  apiBaseUrl: trimTrailingSlash(import.meta.env.VITE_API_BASE_URL || ''),
  geocodePhotonUrl: trimTrailingSlash(import.meta.env.VITE_GEOCODE_PHOTON_URL || 'https://photon.komoot.io/reverse'),
  geocodeNominatimUrl: trimTrailingSlash(import.meta.env.VITE_GEOCODE_NOMINATIM_URL || 'https://nominatim.openstreetmap.org/reverse'),
  geocodeBigDataCloudUrl: trimTrailingSlash(import.meta.env.VITE_GEOCODE_BIGDATACLOUD_URL || 'https://api.bigdatacloud.net/data/reverse-geocode-client'),
  geocodeOpenMeteoUrl: trimTrailingSlash(import.meta.env.VITE_GEOCODE_OPENMETEO_URL || 'https://geocoding-api.open-meteo.com/v1/reverse'),
};
