// Current weather from Open-Meteo (free, no API key).

const CODES = {
  0: 'clear sky', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'freezing fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain',
  66: 'freezing rain', 67: 'freezing rain', 71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains',
  80: 'light showers', 81: 'showers', 82: 'violent showers', 85: 'snow showers', 86: 'snow showers',
  95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail',
};

const geoCache = new Map();

/**
 * @param {string} city
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<{ place, tempC, feelsC, description, code, highC, lowC, rainChance, isDay }>}
 */
export async function fetchWeather(city, fetchFn = fetch) {
  const q = String(city || '').trim();
  if (!q) throw new Error('Set your city in Settings so I can check the weather.');
  let geo = geoCache.get(q.toLowerCase());
  if (!geo) {
    const r = await fetchFn(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(q)}`);
    const j = await r.json();
    const hit = j?.results?.[0];
    if (!hit) throw new Error(`I couldn't find a place called “${q}”.`);
    geo = { lat: hit.latitude, lon: hit.longitude, place: [hit.name, hit.country_code].filter(Boolean).join(', ') };
    geoCache.set(q.toLowerCase(), geo);
  }
  const r = await fetchFn(
    `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}` +
      '&current=temperature_2m,apparent_temperature,weather_code,is_day' +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1',
  );
  const j = await r.json();
  const c = j?.current || {};
  return {
    place: geo.place,
    tempC: Math.round(c.temperature_2m),
    feelsC: Math.round(c.apparent_temperature),
    code: c.weather_code,
    description: CODES[c.weather_code] || 'unknown',
    isDay: c.is_day !== 0,
    highC: Math.round(j?.daily?.temperature_2m_max?.[0]),
    lowC: Math.round(j?.daily?.temperature_2m_min?.[0]),
    rainChance: j?.daily?.precipitation_probability_max?.[0] ?? null,
  };
}

export function describeWeather(w) {
  return (
    `${w.place}: ${w.tempC}°C and ${w.description}` +
    (w.feelsC !== w.tempC ? ` (feels like ${w.feelsC}°)` : '') +
    `. Today ${w.lowC}–${w.highC}°` +
    (w.rainChance != null ? `, ${w.rainChance}% chance of rain.` : '.')
  );
}
