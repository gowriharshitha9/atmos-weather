import { useState, useEffect, useRef } from 'react';
import {
  Search,
  MapPin,
  Sun,
  Moon,
  Wind,
  Droplets,
  Eye,
  Compass,
  Pin,
  PinOff,
  RefreshCw,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudFog,
  Snowflake,
  AlertTriangle,
} from 'lucide-react';
import { DEFAULT_CITIES, decodeWeatherCode, classifyAQI } from './data/weatherConfig';

const PINNED_KEY = 'atmos_pinned_cities_v1';

export default function App() {
  const [pinnedCities, setPinnedCities] = useState(() => {
    try {
      const saved = localStorage.getItem(PINNED_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_CITIES;
    } catch {
      return DEFAULT_CITIES;
    }
  });

  const [activeCity, setActiveCity] = useState(() => pinnedCities[0] || DEFAULT_CITIES[0]);
  const [unit, setUnit] = useState('C');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('atmos-theme') === 'dark');

  // Weather & AQI telemetry state
  const [weatherData, setWeatherData] = useState(null);
  const [aqiData, setAqiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Debounced geocoding search state
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(PINNED_KEY, JSON.stringify(pinnedCities));
  }, [pinnedCities]);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('atmos-theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('atmos-theme', 'light');
    }
  }, [darkMode]);

  // Keyboard shortcut "/" to focus city search
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch parallel Weather + Air Quality telemetry whenever activeCity changes
  const fetchTelemetry = async (city, signal) => {
    setLoading(true);
    setError(null);

    try {
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure&hourly=temperature_2m,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max&timezone=auto&forecast_days=7`;

      const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.lat}&longitude=${city.lon}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone&timezone=auto`;

      const [weatherRes, aqiRes] = await Promise.all([
        fetch(weatherUrl, { signal }),
        fetch(aqiUrl, { signal }),
      ]);

      if (!weatherRes.ok) throw new Error('Unable to reach atmospheric telemetry server.');

      const weatherJson = await weatherRes.json();
      const aqiJson = aqiRes.ok ? await aqiRes.json() : null;

      setWeatherData(weatherJson);
      setAqiData(aqiJson?.current || null);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to load weather data.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchTelemetry(activeCity, controller.signal);
    return () => controller.abort();
  }, [activeCity]);

  // Debounced Open-Meteo Geocoding API search
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            trimmed
          )}&count=6&language=en&format=json`,
          { signal: controller.signal }
        );
        const data = await res.json();
        setSearchResults(data.results || []);
        setShowDropdown(true);
      } catch (err) {
        if (err.name !== 'AbortError') setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // GPS Browser Geolocation
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setActiveCity({
          id: `gps-${pos.coords.latitude.toFixed(2)}`,
          name: 'Current Location',
          region: `${pos.coords.latitude.toFixed(2)}°N, ${pos.coords.longitude.toFixed(2)}°E`,
          lat: Number(pos.coords.latitude.toFixed(4)),
          lon: Number(pos.coords.longitude.toFixed(4)),
        });
      },
      () => {
        setLoading(false);
        setError('Location permission denied. Search any city above instead.');
      }
    );
  };

  const formatTemp = (celsius) => {
    if (celsius == null) return '--';
    const val = unit === 'C' ? celsius : (celsius * 9) / 5 + 32;
    return `${Math.round(val)}°`;
  };

  const isPinned = pinnedCities.some(
    (c) => Math.abs(c.lat - activeCity.lat) < 0.05 && Math.abs(c.lon - activeCity.lon) < 0.05
  );

  const togglePinCity = () => {
    if (isPinned) {
      if (pinnedCities.length <= 1) return;
      setPinnedCities((prev) =>
        prev.filter(
          (c) => !(Math.abs(c.lat - activeCity.lat) < 0.05 && Math.abs(c.lon - activeCity.lon) < 0.05)
        )
      );
    } else {
      setPinnedCities((prev) => [...prev, activeCity]);
    }
  };

  const renderConditionIcon = (code, className = 'w-5 h-5') => {
    const { category } = decodeWeatherCode(code);
    if (category === 'clear') return <Sun className={`${className} text-amber-500`} />;
    if (category === 'partly') return <Cloud className={`${className} text-zinc-500`} />;
    if (category === 'cloudy') return <Cloud className={`${className} text-zinc-400`} />;
    if (category === 'fog') return <CloudFog className={`${className} text-zinc-400`} />;
    if (category === 'rain') return <CloudRain className={`${className} text-sky-500`} />;
    if (category === 'snow') return <Snowflake className={`${className} text-cyan-400`} />;
    if (category === 'storm') return <CloudLightning className={`${className} text-amber-500`} />;
    return <Sun className={`${className} text-amber-500`} />;
  };

  // Prepare next 24 hours slice for SVG chart
  const hourlySlice = (() => {
    if (!weatherData?.hourly) return [];
    const nowIso = weatherData.current?.time?.slice(0, 13);
    const startIdx = Math.max(
      0,
      weatherData.hourly.time.findIndex((t) => t.startsWith(nowIso))
    );
    return weatherData.hourly.time.slice(startIdx, startIdx + 24).map((t, i) => ({
      hour: t.slice(11, 16),
      temp: weatherData.hourly.temperature_2m[startIdx + i],
      precip: weatherData.hourly.precipitation_probability[startIdx + i],
    }));
  })();

  // SVG Sparkline Coordinates
  const buildSparkline = () => {
    if (hourlySlice.length < 2) return { line: '', area: '', points: [] };
    const temps = hourlySlice.map((h) => h.temp);
    const min = Math.min(...temps) - 1;
    const max = Math.max(...temps) + 1;
    const width = 640;
    const height = 130;

    const coords = hourlySlice.map((item, idx) => {
      const x = (idx / (hourlySlice.length - 1)) * width;
      const y = height - ((item.temp - min) / (max - min || 1)) * (height - 28) - 14;
      return { x, y, ...item };
    });

    const line = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L ${width} ${height} L 0 ${height} Z`;
    return { line, area, points: coords };
  };

  const sparkline = buildSparkline();
  const aqiMeta = classifyAQI(aqiData?.us_aqi);

  // 7-day min/max bounds for range bar scaling
  const weekBounds = (() => {
    if (!weatherData?.daily) return { min: 0, max: 40 };
    return {
      min: Math.min(...weatherData.daily.temperature_2m_min),
      max: Math.max(...weatherData.daily.temperature_2m_max),
    };
  })();

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0C0E] text-zinc-900 dark:text-zinc-100 antialiased">
      {/* Top Telemetry Bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/90 dark:bg-[#0B0C0E]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-sm tracking-tight">Atmos</span>
            <span className="hidden md:inline-block font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-500">
              Open-Meteo Live
            </span>
          </div>

          {/* City Search Autocomplete */}
          <div ref={dropdownRef} className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search city (e.g., Pune, Tokyo, London)..."
              className="w-full pl-8 pr-8 py-1.5 text-xs rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-400 border border-zinc-200 dark:border-zinc-700 px-1 rounded">
              /
            </kbd>

            {showDropdown && (
              <div className="absolute left-0 right-0 mt-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14171D] shadow-xl overflow-hidden z-50">
                {isSearching ? (
                  <div className="px-3.5 py-3 text-xs text-zinc-400">Querying stations...</div>
                ) : searchResults.length === 0 ? (
                  <div className="px-3.5 py-3 text-xs text-zinc-400">No matching coordinates found.</div>
                ) : (
                  searchResults.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveCity({
                          id: String(item.id),
                          name: item.name,
                          region: [item.admin1, item.country].filter(Boolean).join(', '),
                          lat: item.latitude,
                          lon: item.longitude,
                        });
                        setQuery('');
                        setShowDropdown(false);
                      }}
                      className="w-full px-3.5 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center justify-between text-xs border-b last:border-b-0 border-zinc-100 dark:border-zinc-800/70"
                    >
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-[11px] text-zinc-400">
                          {[item.admin1, item.country].filter(Boolean).join(', ')}
                        </p>
                      </div>
                      <span className="font-mono text-[10px] text-zinc-400">
                        {item.latitude.toFixed(1)}°, {item.longitude.toFixed(1)}°
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleLocateMe}
              title="Use current GPS coordinates"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Locate</span>
            </button>

            <button
              onClick={() => setUnit(unit === 'C' ? 'F' : 'C')}
              title="Toggle Celsius / Fahrenheit"
              className="px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono text-xs font-medium hover:border-zinc-400 transition"
            >
              °{unit}
            </button>

            <button
              onClick={() => setDarkMode(!darkMode)}
              title="Toggle theme"
              className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Pinned Stations Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {pinnedCities.map((city) => {
            const selected =
              Math.abs(city.lat - activeCity.lat) < 0.05 &&
              Math.abs(city.lon - activeCity.lon) < 0.05;
            return (
              <button
                key={city.id}
                onClick={() => setActiveCity(city)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium shrink-0 border transition ${
                  selected
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                    : 'bg-white dark:bg-[#111317] text-zinc-600 dark:text-zinc-400 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                {city.name}
              </button>
            );
          })}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchTelemetry(activeCity)}
              className="px-2.5 py-1 rounded bg-rose-600 text-white font-medium shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Skeleton Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-pulse">
            <div className="lg:col-span-2 h-64 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/60" />
            <div className="h-64 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/60" />
            <div className="lg:col-span-2 h-56 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/60" />
            <div className="h-56 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/60" />
          </div>
        ) : (
          weatherData && (
            <>
              {/* Row 1: Current Station Hero + Air Quality Index */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Current Station Card */}
                <section className="lg:col-span-2 p-6 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#111317] flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-xl font-semibold tracking-tight">{activeCity.name}</h1>
                        <span className="font-mono text-[11px] text-zinc-400">
                          {activeCity.lat.toFixed(2)}°N, {activeCity.lon.toFixed(2)}°E
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">{activeCity.region}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={togglePinCity}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                      >
                        {isPinned ? (
                          <>
                            <PinOff className="w-3.5 h-3.5" />
                            <span>Pinned</span>
                          </>
                        ) : (
                          <>
                            <Pin className="w-3.5 h-3.5" />
                            <span>Pin City</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => fetchTelemetry(activeCity)}
                        title="Refresh live telemetry"
                        className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Primary Temperature Readout */}
                  <div className="my-6 flex flex-wrap items-end justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800">
                        {renderConditionIcon(weatherData.current.weather_code, 'w-9 h-9')}
                      </div>
                      <div>
                        <div className="text-5xl font-semibold tracking-tight font-mono tabular-nums">
                          {formatTemp(weatherData.current.temperature_2m)}
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">
                          {decodeWeatherCode(weatherData.current.weather_code).label} · Feels like{' '}
                          <span className="font-mono text-zinc-700 dark:text-zinc-300">
                            {formatTemp(weatherData.current.apparent_temperature)}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* 4 Secondary Atmospheric Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div className="p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200/60 dark:border-zinc-800/80">
                        <div className="flex items-center gap-1 text-zinc-400 mb-1">
                          <Droplets className="w-3 h-3" />
                          <span>Humidity</span>
                        </div>
                        <p className="font-mono font-semibold tabular-nums">
                          {weatherData.current.relative_humidity_2m}%
                        </p>
                      </div>

                      <div className="p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200/60 dark:border-zinc-800/80">
                        <div className="flex items-center gap-1 text-zinc-400 mb-1">
                          <Wind className="w-3 h-3" />
                          <span>Wind</span>
                        </div>
                        <p className="font-mono font-semibold tabular-nums">
                          {Math.round(weatherData.current.wind_speed_10m)} km/h
                        </p>
                      </div>

                      <div className="p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200/60 dark:border-zinc-800/80">
                        <div className="flex items-center gap-1 text-zinc-400 mb-1">
                          <Compass className="w-3 h-3" />
                          <span>Pressure</span>
                        </div>
                        <p className="font-mono font-semibold tabular-nums">
                          {Math.round(weatherData.current.surface_pressure)} hPa
                        </p>
                      </div>

                      <div className="p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200/60 dark:border-zinc-800/80">
                        <div className="flex items-center gap-1 text-zinc-400 mb-1">
                          <Eye className="w-3 h-3" />
                          <span>Max UV</span>
                        </div>
                        <p className="font-mono font-semibold tabular-nums">
                          {weatherData.daily.uv_index_max[0]?.toFixed(1) ?? '--'}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Air Quality Index Card */}
                <section className="p-6 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#111317] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Air Quality (US AQI)
                      </h2>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${aqiMeta.color}`}>
                        <span className={`w-2 h-2 rounded-full ${aqiMeta.dot}`} />
                        {aqiMeta.label}
                      </span>
                    </div>

                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="text-4xl font-semibold font-mono tabular-nums">
                        {aqiData?.us_aqi ?? '--'}
                      </span>
                      <span className="text-xs text-zinc-400 font-mono">AQI</span>
                    </div>

                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                      {aqiMeta.advice}
                    </p>
                  </div>

                  {/* Particulate Breakdown */}
                  <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-zinc-400 block text-[11px]">PM2.5 Fine</span>
                      <span className="font-mono font-medium tabular-nums">
                        {aqiData?.pm2_5 != null ? `${aqiData.pm2_5} µg/m³` : '--'}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block text-[11px]">PM10 Coarse</span>
                      <span className="font-mono font-medium tabular-nums">
                        {aqiData?.pm10 != null ? `${aqiData.pm10} µg/m³` : '--'}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block text-[11px]">Ozone (O₃)</span>
                      <span className="font-mono font-medium tabular-nums">
                        {aqiData?.ozone != null ? `${aqiData.ozone} µg/m³` : '--'}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block text-[11px]">NO₂</span>
                      <span className="font-mono font-medium tabular-nums">
                        {aqiData?.nitrogen_dioxide != null ? `${aqiData.nitrogen_dioxide} µg/m³` : '--'}
                      </span>
                    </div>
                  </div>
                </section>
              </div>

              {/* Row 2: 24-Hour Temperature Curve + 7-Day Outlook */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* 24-Hour Temperature Curve */}
                <section className="lg:col-span-2 p-6 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#111317] flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-sm font-semibold">24-Hour Temperature Trajectory</h2>
                      <p className="text-xs text-zinc-500">Hourly station interpolation</p>
                    </div>
                    <span className="font-mono text-[11px] text-zinc-400">
                      Timezone: {weatherData.timezone_abbreviation}
                    </span>
                  </div>

                  {/* Custom SVG Area Curve */}
                  <div className="w-full overflow-hidden">
                    <svg viewBox="0 0 640 130" className="w-full h-36 overflow-visible">
                      <defs>
                        <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {sparkline.area && <path d={sparkline.area} fill="url(#tempFill)" />}
                      {sparkline.line && (
                        <path
                          d={sparkline.line}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      )}
                      {sparkline.points
                        .filter((_, idx) => idx % 4 === 0)
                        .map((pt, i) => (
                          <g key={i}>
                            <circle cx={pt.x} cy={pt.y} r="3" fill="#10b981" />
                            <text
                              x={pt.x}
                              y={pt.y - 8}
                              textAnchor="middle"
                              className="fill-zinc-700 dark:fill-zinc-300 text-[10px] font-mono"
                            >
                              {formatTemp(pt.temp)}
                            </text>
                          </g>
                        ))}
                    </svg>
                  </div>

                  {/* 6-slot Hourly Strip */}
                  <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 grid grid-cols-6 gap-2 text-center text-xs">
                    {hourlySlice
                      .filter((_, idx) => idx % 4 === 0)
                      .map((slot, idx) => (
                        <div key={idx}>
                          <span className="font-mono text-[11px] text-zinc-400 block">
                            {slot.hour}
                          </span>
                          <span className="font-mono font-medium tabular-nums">
                            {formatTemp(slot.temp)}
                          </span>
                          <span className="block text-[10px] text-sky-500 font-mono">
                            {slot.precip}% rain
                          </span>
                        </div>
                      ))}
                  </div>
                </section>

                {/* 7-Day Forecast Table */}
                <section className="p-6 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#111317]">
                  <h2 className="text-sm font-semibold mb-4">7-Day Outlook</h2>
                  <div className="space-y-3">
                    {weatherData.daily.time.map((dateStr, idx) => {
                      const dMin = weatherData.daily.temperature_2m_min[idx];
                      const dMax = weatherData.daily.temperature_2m_max[idx];
                      const code = weatherData.daily.weather_code[idx];
                      const dayLabel =
                        idx === 0
                          ? 'Today'
                          : new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
                              weekday: 'short',
                            });

                      const totalSpan = weekBounds.max - weekBounds.min || 1;
                      const leftPct = ((dMin - weekBounds.min) / totalSpan) * 100;
                      const widthPct = Math.max(12, ((dMax - dMin) / totalSpan) * 100);

                      return (
                        <div
                          key={dateStr}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="w-12 font-medium text-zinc-700 dark:text-zinc-300">
                            {dayLabel}
                          </span>

                          {renderConditionIcon(code, 'w-4 h-4 shrink-0')}

                          <span className="w-8 text-right font-mono text-zinc-400 tabular-nums">
                            {formatTemp(dMin)}
                          </span>

                          <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full relative overflow-hidden">
                            <div
                              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                              className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-sky-400 to-amber-500"
                            />
                          </div>

                          <span className="w-8 font-mono font-medium tabular-nums">
                            {formatTemp(dMax)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </>
          )
        )}
      </main>
    </div>
  );
}