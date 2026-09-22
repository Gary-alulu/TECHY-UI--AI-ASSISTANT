"use client";

import React, { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Cpu, Mic, Volume2, AlertTriangle, Play } from "lucide-react";

export function AICore() {
  const { aiState } = useApp();
  const { state } = aiState;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Particle system for the AI Core background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Particle class
    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;
      alpha: number;

      constructor() {
        this.x = Math.random() * canvas!.width;
        this.y = Math.random() * canvas!.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.speedY = (Math.random() - 0.5) * 0.5;
        
        // Use cyan and violet colors based on AI state
        const isActionState = state === 'executing' || state === 'thinking';
        const hue = isActionState ? (Math.random() > 0.5 ? 190 : 260) : 190;
        this.color = `hsl(${hue}, 100%, 60%)`;
        this.alpha = Math.random() * 0.5 + 0.1;
      }

      update() {
        this.x += this.speedX * (state === 'thinking' ? 3 : 1);
        this.y += this.speedY * (state === 'thinking' ? 3 : 1);

        if (this.x > canvas!.width) this.x = 0;
        else if (this.x < 0) this.x = canvas!.width;
        if (this.y > canvas!.height) this.y = 0;
        else if (this.y < 0) this.y = canvas!.height;
      }

      draw() {
        if (!ctx) return;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.alpha * (state === 'listening' ? 1.5 : 1);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const particles: Particle[] = [];
    const particleCount = 80;
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    let animationFrameId: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw connection lines if thinking
      if (state === 'thinking' || state === 'executing') {
        for (let i = 0; i < particles.length; i++) {
          for (let j = i; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 100) {
              ctx.beginPath();
              ctx.strokeStyle = `rgba(34, 211, 238, ${0.15 * (1 - distance / 100)})`;
              ctx.lineWidth = 0.5;
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.stroke();
            }
          }
        }
      }

      for (const particle of particles) {
        particle.update();
        particle.draw();
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [state]);

  // Determine state-specific classes
  const isIdle = state === "idle";
  const isListening = state === "listening";
  const isThinking = state === "thinking";
  const isExecuting = state === "executing";
  const isSpeaking = state === "speaking";
  const isError = state === "error";

  // Configuration for the rings based on state
  const outerRingClass = cn(
    "absolute inset-0 rounded-full border border-dashed",
    isIdle && "border-cyan-500/20 animate-rotate-slow",
    isListening && "border-cyan-400/50 animate-[rotate-slow_10s_linear_infinite]",
    isThinking && "border-violet-500/50 animate-[rotate-slow_5s_linear_infinite]",
    isExecuting && "border-emerald-500/50 animate-[rotate-slow_8s_linear_infinite]",
    isSpeaking && "border-cyan-400/30 animate-[rotate-slow_15s_linear_infinite]",
    isError && "border-red-500/50 animate-pulse"
  );

  const middleRingClass = cn(
    "absolute inset-4 rounded-full border-t-2 border-r-2",
    isIdle && "border-cyan-500/30 animate-rotate-reverse",
    isListening && "border-cyan-400/60 animate-[rotate-slow_12s_linear_infinite_reverse]",
    isThinking && "border-violet-500/70 animate-[rotate-slow_6s_linear_infinite_reverse]",
    isExecuting && "border-emerald-500/60 animate-[rotate-slow_10s_linear_infinite_reverse]",
    isSpeaking && "border-cyan-400/40 animate-[rotate-slow_18s_linear_infinite_reverse]",
    isError && "border-red-500/60 animate-pulse"
  );

  const innerCoreClass = cn(
    "absolute inset-10 rounded-full blur-md transition-all duration-700 ease-in-out",
    isIdle && "bg-cyan-500/20 animate-pulse-glow",
    isListening && "bg-cyan-400/40 animate-[pulse-glow_1.5s_ease-in-out_infinite]",
    isThinking && "bg-violet-500/40 animate-[pulse-glow_1s_ease-in-out_infinite]",
    isExecuting && "bg-emerald-500/30 bg-circuit",
    isSpeaking && "bg-cyan-400/30 animate-[pulse-glow_0.5s_ease-in-out_infinite]",
    isError && "bg-red-500/40 animate-pulse-glow"
  );

  return (
    <div className="relative flex flex-col items-center justify-center w-full max-w-sm mx-auto h-[400px]">
      {/* Background Particles */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-[-100px] pointer-events-none opacity-60 mix-blend-screen"
      />

      {/* Main Core Assembly */}
      <div className="relative w-64 h-64 flex items-center justify-center">
        
        {/* Decorative Grid Lines (HUD effect) */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.05)_1px,transparent_1px)] bg-[size:20px_20px] rounded-full [mask-image:radial-gradient(circle,black,transparent_70%)]" />

        {/* Outer Ring */}
        <div className={outerRingClass} style={{ borderWidth: '2px' }} />
        
        {/* Middle Ring */}
        <div className={middleRingClass} />
        
        {/* Inner Glowing Core */}
        <div className={innerCoreClass} />
        
        {/* Center Orb */}
        <div className={cn(
          "relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500",
          "bg-navy-950/80 backdrop-blur-sm border border-white/10 shadow-[inset_0_0_20px_rgba(34,211,238,0.2)]",
          isListening && "shadow-[inset_0_0_30px_rgba(34,211,238,0.4)] border-cyan-400/40",
          isThinking && "shadow-[inset_0_0_30px_rgba(139,92,246,0.4)] border-violet-500/40",
          isExecuting && "shadow-[inset_0_0_30px_rgba(16,185,129,0.4)] border-emerald-500/40",
          isError && "shadow-[inset_0_0_30px_rgba(239,68,68,0.4)] border-red-500/40"
        )}>
          
          <AnimatePresence mode="wait">
            {isIdle && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
                className="w-10 h-10 rounded bg-cyan-950 border border-cyan-400/30 flex items-center justify-center glow-cyan"
              >
                <span className="text-cyan-400 font-display font-bold text-2xl leading-none">T</span>
              </motion.div>
            )}
            
            {isListening && (
              <motion.div
                key="listening"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-cyan-400 glow-text-cyan flex items-center justify-center h-full w-full"
              >
                <Mic size={32} />
              </motion.div>
            )}

            {isThinking && (
              <motion.div
                key="thinking"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-violet-400 flex items-center justify-center"
              >
                <Cpu size={32} className="animate-pulse" />
              </motion.div>
            )}

            {isExecuting && (
              <motion.div
                key="executing"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-emerald-400 flex items-center justify-center"
              >
                <Play size={32} className="fill-emerald-400/20" />
              </motion.div>
            )}

            {isSpeaking && (
              <motion.div
                key="speaking"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-cyan-400 flex items-center justify-center"
              >
                <Volume2 size={32} className="animate-pulse" />
              </motion.div>
            )}

            {isError && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-red-500 flex items-center justify-center"
              >
                <AlertTriangle size={32} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Orbiting Elements (only visible when active) */}
        {(!isIdle && !isError) && (
          <div className="absolute inset-0 animate-[orbit_8s_linear_infinite]" style={{ '--orbit-radius': '110px' } as React.CSSProperties}>
            <div className="w-2 h-2 rounded-full bg-cyan-400 glow-cyan-strong" />
          </div>
        )}
      </div>

      {/* Decorative side brackets */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[150px] pointer-events-none opacity-30">
        <div className="absolute left-0 top-0 bottom-0 w-4 border-l border-y border-cyan-400/50 rounded-l-xl" />
        <div className="absolute right-0 top-0 bottom-0 w-4 border-r border-y border-cyan-400/50 rounded-r-xl" />
      </div>
    </div>
  );
}
