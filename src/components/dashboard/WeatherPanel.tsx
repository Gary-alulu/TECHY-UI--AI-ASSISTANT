"use client";

import React from "react";
import { GlassPanel } from "../ui/GlassPanel";
import {
  CloudRain,
  Sun,
  Cloud,
  Wind,
  Droplets,
  MapPin,
  Cloudy,
  CloudFog,
  CloudSnow,
  CloudLightning,
} from "lucide-react";
import { useWeather } from "@/hooks/useWeather";

const CODE_TO_CONDITION: Record<number, string> = {
  0: "Clear Sky",
  1: "Mainly Clear",
  2: "Partly Cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Freezing Fog",
  51: "Light Drizzle",
  53: "Drizzle",
  55: "Dense Drizzle",
  56: "Freezing Drizzle",
  57: "Freezing Drizzle",
  61: "Light Rain",
  63: "Rain",
  65: "Heavy Rain",
  66: "Freezing Rain",
  67: "Freezing Rain",
  71: "Light Snow",
  73: "Snow",
  75: "Heavy Snow",
  77: "Snow Grains",
  80: "Rain Showers",
  81: "Rain Showers",
  82: "Violent Showers",
  85: "Snow Showers",
  86: "Snow Showers",
  95: "Thunderstorm",
  96: "Thunderstorm",
  99: "Severe Thunderstorm",
};

function conditionFor(code: number) {
  return CODE_TO_CONDITION[code] ?? "Unknown";
}

function WeatherIcon({
  code,
  size = 16,
  className = "text-slate-300",
}: {
  code: number;
  size?: number;
  className?: string;
}) {
  const Icon =
    code <= 1
      ? Sun
      : code === 2
        ? Cloud
        : code === 3
          ? Cloudy
          : code === 45 || code === 48
            ? CloudFog
            : code >= 51 && code <= 67
              ? CloudRain
              : code >= 71 && code <= 86
                ? CloudSnow
                : code >= 95
                  ? CloudLightning
                  : Cloud;
  return <Icon size={size} className={className} />;
}

export function WeatherPanel() {
  const { weather } = useWeather();

  if (!weather) {
    return (
      <GlassPanel header="Weather" className="h-full">
        <div className="flex items-center justify-center py-10">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest animate-pulse">
            Acquiring your location...
          </span>
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel header="Weather" className="h-full">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-1.5 text-slate-300 text-sm">
          <MapPin size={12} className="text-cyan-400" />
          {weather.location}
        </div>

        <div className="text-right">
          <div className="flex items-start justify-end">
            <span className="text-4xl font-display font-bold text-slate-100">{weather.temp}</span>
            <span className="text-lg text-cyan-400 mt-1">°C</span>
          </div>
          <div className="text-sm text-slate-400">{conditionFor(weather.code)}</div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 p-3 rounded-lg bg-navy-950/50 border border-slate-800/50">
        <div className="flex items-center gap-2">
          <Droplets size={16} className="text-cyan-400" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest">Humidity</span>
            <span className="text-xs font-mono text-slate-300">{weather.humidity}%</span>
          </div>
        </div>

        <div className="h-8 w-px bg-slate-800" />

        <div className="flex items-center gap-2">
          <Wind size={16} className="text-cyan-400" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest">Wind</span>
            <span className="text-xs font-mono text-slate-300">{weather.wind} km/h</span>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <h4 className="text-[10px] text-slate-400 uppercase tracking-wider font-mono mb-3">Forecast</h4>
        <div className="grid grid-cols-4 gap-2">
          {weather.forecast.slice(0, 4).map((day, i) => (
            <div key={i} className="flex flex-col items-center justify-between p-2 rounded bg-navy-950/30 border border-transparent hover:border-cyan-400/20 transition-colors">
              <span className="text-xs font-mono text-slate-400 mb-2">{day.day}</span>
              <WeatherIcon code={day.code} className="text-slate-300 mb-2" />
              <span className="text-sm font-medium text-slate-200">{day.temp}°</span>
            </div>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
}