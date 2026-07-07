"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

export function ParticleField({ density = 0.00008 }: { density?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const canvasEl = canvas;
    const context = ctx;
    let animationId = 0;
    let particles: Particle[] = [];

    function resize() {
      const parent = canvasEl.parentElement;
      if (!parent) return;
      canvasEl.width = parent.clientWidth;
      canvasEl.height = parent.clientHeight;
      const count = Math.floor(canvasEl.width * canvasEl.height * density);
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvasEl.width,
        y: Math.random() * canvasEl.height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        size: Math.random() * 1.6 + 0.4,
        alpha: Math.random() * 0.45 + 0.1,
      }));
    }

    function draw() {
      context.clearRect(0, 0, canvasEl.width, canvasEl.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvasEl.width;
        if (p.x > canvasEl.width) p.x = 0;
        if (p.y < 0) p.y = canvasEl.height;
        if (p.y > canvasEl.height) p.y = 0;

        context.beginPath();
        context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        context.fillStyle = `rgba(125, 211, 252, ${p.alpha})`;
        context.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.strokeStyle = `rgba(56, 189, 248, ${0.08 * (1 - dist / 110)})`;
            context.lineWidth = 0.5;
            context.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, [density]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />;
}
