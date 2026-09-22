"use client";

import { useState, useEffect } from "react";

export interface WeatherForecastDay {
  day: string;
  temp: number;
  code: number;
}

export interface WeatherData {
  location: string;
  temp: number;
  humidity: number;
  wind: number;
  code: number;
  forecast: WeatherForecastDay[];
}

interface OpenMeteoCurrent {
  temperature_2m: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
  weather_code: number;
}

interface OpenMeteoDaily {
  time: string[];
  temperature_2m_max: number[];
  weather_code: number[];
}

const FALLBACK: WeatherData = {
  location: "San Francisco",
  temp: 24,
  humidity: 65,
  wind: 12,
  code: 2,
  forecast: [
    { day: "Tue", temp: 26, code: 0 },
    { day: "Wed", temp: 22, code: 61 },
    { day: "Thu", temp: 23, code: 2 },
    { day: "Fri", temp: 25, code: 0 },
  ],
};

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const apply = (data: WeatherData | null) => {
      if (cancelled) return;
      setLoading(false);
      if (data) {
        setWeather(data);
        setError(null);
      } else {
        setError("Unable to load weather for your location");
        setWeather(FALLBACK);
      }
    };

    const fromCoords = async (lat: number, lon: number, nameOverride?: string) => {
      try {
        const [loc, fc] = await Promise.all([
          nameOverride
            ? Promise.resolve({ city: nameOverride })
            : fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
              )
                .then((r) => (r.ok ? r.json() : null))
                .catch(() => null),
          fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=auto`
          )
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ]);

        if (!fc || !fc.current) {
          apply(null);
          return;
        }

        const current: OpenMeteoCurrent = fc.current;
        const daily: OpenMeteoDaily = fc.daily;

        const locationName =
          loc?.city || loc?.locality || loc?.principalSubdivision || "Your location";

        const forecast = (daily?.time ?? []).map((t: string, i: number) => ({
          day: new Date(`${t}T00:00:00`).toLocaleDateString(undefined, {
            weekday: "short",
          }),
          temp: Math.round(daily.temperature_2m_max[i]),
          code: daily.weather_code[i],
        }));

        apply({
          location: locationName,
          temp: Math.round(current.temperature_2m),
          humidity: Math.round(current.relative_humidity_2m),
          wind: Math.round(current.wind_speed_10m),
          code: current.weather_code,
          forecast,
        });
      } catch {
        apply(null);
      }
    };

    const fromIp = async () => {
      try {
        const res = await fetch("https://ipwho.is/");
        if (!res.ok) {
          apply(null);
          return;
        }
        const data = await res.json();
        if (data.success === false || typeof data.latitude !== "number") {
          apply(null);
          return;
        }
        const name = [data.city, data.region, data.country].filter(Boolean).join(", ");
        await fromCoords(data.latitude, data.longitude, name || undefined);
      } catch {
        apply(null);
      }
    };

    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void fromCoords(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          void fromIp();
        }
      );
    } else {
      void fromIp();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return { weather, loading, error };
}