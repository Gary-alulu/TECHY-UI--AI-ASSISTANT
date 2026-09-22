"use client";

import React, { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
}

export function AnimatedNumber({ value, duration = 500 }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(() => (Number.isFinite(value) ? value : 0));
  const displayRef = useRef(displayValue);

  useEffect(() => {
    displayRef.current = displayValue;
  });

  useEffect(() => {
    const endValue = Number.isFinite(value) ? value : 0;
    const startValue = displayRef.current;
    let frameId = 0;

    if (Math.abs(startValue - endValue) < 1) {
      frameId = requestAnimationFrame(() => setDisplayValue(Math.round(endValue)));
      return () => cancelAnimationFrame(frameId);
    }

    let startTimestamp: number | null = null;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);

      // Easing function: easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);

      const current = startValue + (endValue - startValue) * easeProgress;
      setDisplayValue(Math.round(current));

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [value, duration]);

  return <>{displayValue}</>;
}
