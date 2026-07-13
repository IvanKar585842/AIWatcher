"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/components/landing/os/mouse-parallax";

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
  const reducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (reducedMotion || !visible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const canvasEl = canvas;
    const context = ctx;
    let animationId = 0;
    let particles: Particle[] = [];
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const effectiveDensity = isMobile ? density * 0.35 : density;
    const maxParticles = isMobile ? 28 : 55;
    const drawLinks = !isMobile;

    function resize() {
      const parent = canvasEl.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvasEl.width = Math.floor(w * dpr);
      canvasEl.height = Math.floor(h * dpr);
      canvasEl.style.width = `${w}px`;
      canvasEl.style.height = `${h}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(maxParticles, Math.floor(w * h * effectiveDensity));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        size: Math.random() * 1.4 + 0.4,
        alpha: Math.random() * 0.4 + 0.1,
      }));
    }

    function draw() {
      const w = canvasEl.clientWidth;
      const h = canvasEl.clientHeight;
      context.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        context.beginPath();
        context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        context.fillStyle = `rgba(125, 211, 252, ${p.alpha})`;
        context.fill();
      }

      if (drawLinks) {
        const linkDist = 90;
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const a = particles[i];
            const b = particles[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < linkDist) {
              context.beginPath();
              context.moveTo(a.x, a.y);
              context.lineTo(b.x, b.y);
              context.strokeStyle = `rgba(56, 189, 248, ${0.06 * (1 - dist / linkDist)})`;
              context.lineWidth = 0.5;
              context.stroke();
            }
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
  }, [density, reducedMotion, visible]);

  if (reducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
