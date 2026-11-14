export const DEFAULT_CITIES = [
  { id: 'hyd', name: 'Hyderabad', region: 'Telangana, India', lat: 17.385, lon: 78.4867 },
  { id: 'blr', name: 'Bengaluru', region: 'Karnataka, India', lat: 12.9716, lon: 77.5946 },
  { id: 'bom', name: 'Mumbai', region: 'Maharashtra, India', lat: 19.076, lon: 72.8777 },
  { id: 'del', name: 'New Delhi', region: 'Delhi, India', lat: 28.6139, lon: 77.209 },
  { id: 'maa', name: 'Chennai', region: 'Tamil Nadu, India', lat: 13.0827, lon: 80.2707 },
];

export function decodeWeatherCode(code) {
  if (code === 0) return { label: 'Clear Sky', category: 'clear' };
  if (code === 1 || code === 2) return { label: 'Partly Cloudy', category: 'partly' };
  if (code === 3) return { label: 'Overcast', category: 'cloudy' };
  if (code === 45 || code === 48) return { label: 'Haze / Fog', category: 'fog' };
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code))
    return { label: 'Rain Showers', category: 'rain' };
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { label: 'Snowfall', category: 'snow' };
  if ([95, 96, 99].includes(code))
    return { label: 'Thunderstorm', category: 'storm' };
  return { label: 'Variable Sky', category: 'partly' };
}

export function classifyAQI(aqi) {
  if (aqi == null) return { label: 'Unavailable', color: 'text-zinc-500', dot: 'bg-zinc-400', advice: 'Telemetry offline for this coordinate.' };
  if (aqi <= 50) return { label: 'Good', color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', advice: 'Clean ambient air. Ideal for outdoor activity.' };
  if (aqi <= 100) return { label: 'Moderate', color: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', advice: 'Acceptable air quality; sensitive groups should pace exertion.' };
  if (aqi <= 150) return { label: 'Unhealthy (Sensitive)', color: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500', advice: 'Reduce prolonged outdoor exertion near high-traffic corridors.' };
  if (aqi <= 200) return { label: 'Unhealthy', color: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500', advice: 'Limit outdoor exposure; consider N95 filtration outdoors.' };
  return { label: 'Severe', color: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500', advice: 'Avoid outdoor exertion; keep indoor filtration active.' };
}