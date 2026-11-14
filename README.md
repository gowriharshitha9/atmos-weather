# Atmos

A real-time weather and air quality telemetry console built with React, Tailwind CSS, and the Open-Meteo REST API. Supports global city geocoding, browser GPS geolocation, 24-hour temperature curves, and US AQI particulate breakdowns.

## Features

- **Live Dual-Stream Telemetry:** Fetches real-time meteorological forecasts and air quality metrics (`US AQI`, `PM2.5`, `PM10`, `O₃`, `NO₂`) in parallel via `Promise.all`.
- **Global City Search & GPS Locate:** Debounced geocoding autocomplete (`/` shortcut) with `AbortController` request cancellation, plus one-click browser geolocation.
- **Pinned Stations & Unit Toggle:** Pin custom cities to `localStorage` and switch dynamically between Celsius (`°C`) and Fahrenheit (`°F`).
- **24-Hour & 7-Day Visualizations:** Custom SVG temperature trajectory curve alongside scaled 7-day high/low thermal range bars.

## Tech Stack

- **Framework:** React (Vite)
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **APIs:** Open-Meteo Weather Forecast, Air Quality & Geocoding APIs

## Local Setup

```bash
git clone [https://github.com/gowriharshitha9/atmos-weather.git](https://github.com/gowriharshitha9/atmos-weather.git)
cd atmos-weather
npm install
npm run dev