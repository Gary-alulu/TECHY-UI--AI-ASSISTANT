"use client";

import { useState, useEffect } from "react";

export function useDateTime(updateIntervalMs: number = 1000) {
  const [ready, setReady] = useState(false);
  const [date, setDate] = useState(() => new Date());

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));

    const interval = setInterval(() => {
      setDate(new Date());
    }, updateIntervalMs);

    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
  }, [updateIntervalMs]);

  if (!ready) {
    return {
      date: null,
      timeString: "",
      dateString: "",
      shortDateString: "",
    };
  }

  const timeString = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const dateString = date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const shortDateString = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return {
    date,
    timeString,
    dateString,
    shortDateString,
  };
}