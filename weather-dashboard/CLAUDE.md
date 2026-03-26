# Weather Dashboard — Assignment Context

## Stack
Vanilla HTML/CSS/JS — no frameworks, no bundlers, no npm.

## API
- Provider: OpenWeatherMap
- Key: stored as `API_KEY` const at top of app.js
- Base URL: https://api.openweathermap.org/data/2.5/
- CORS allowed from static pages — no proxy needed

## Features Implemented
- City search by name
- Geolocation (📍 button)
- C/F toggle (radio buttons)
- Current conditions: temp, feels-like, humidity, wind, pressure, visibility
- Sunrise & sunset times
- Weather icon from OpenWeatherMap CDN
- 5-day forecast (noon sample per day)
- Search history via localStorage (last 5 cities)

## Files
- index.html  — markup
- style.css   — styles (matches penguinprotector portfolio aesthetic)
- app.js      — all API + DOM logic
