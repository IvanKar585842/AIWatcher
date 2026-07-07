"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { SignUpCTA } from "@/components/auth/clerk-wrappers";

function NetworkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let id = 0;
    const nodes = Array.from({ length: 40 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0004,
      vy: (Math.random() - 0.5) * 0.0004,
    }));

    const canvasEl = canvas;
    const context = ctx;
    function resize() {
      const parent = canvasEl.parentElement;
      if (!parent) return;
      canvasEl.width = parent.clientWidth;
      canvasEl.height = parent.clientHeight;
    }

    function draw() {
      context.clearRect(0, 0, canvasEl.width, canvasEl.height);
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > 1) n.vx *= -1;
        if (n.y < 0 || n.y > 1) n.vy *= -1;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = (a.x - b.x) * canvasEl.width;
          const dy = (a.y - b.y) * canvasEl.height;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 120) {
            context.strokeStyle = `rgba(56,189,248,${0.06 * (1 - d / 120)})`;
            context.beginPath();
            context.moveTo(a.x * canvasEl.width, a.y * canvasEl.height);
            context.lineTo(b.x * canvasEl.width, b.y * canvasEl.height);
            context.stroke();
          }
        }
      }

      for (const n of nodes) {
        context.beginPath();
        context.arc(n.x * canvasEl.width, n.y * canvasEl.height, 1.2, 0, Math.PI * 2);
        context.fillStyle = "rgba(125,211,252,0.35)";
        context.fill();
      }

      id = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-60" />;
}

export function OsFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.04] bg-[#090909]">
      <div className="relative h-48">
        <NetworkCanvas />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="text-2xl font-light text-zinc-200 md:text-3xl">
            Start observing the web
          </h2>
          <p className="mt-3 text-sm text-zinc-600">Deploy your first monitor in under 60 seconds.</p>
          <div className="mt-6 flex justify-center">
            <SignUpCTA className="!rounded-full !border-cyan-400/30 !bg-cyan-500/10 !px-8 !text-cyan-100">
              Initialize WatchFlow
            </SignUpCTA>
          </div>
        </motion.div>

        <div className="flex flex-col items-center justify-between gap-6 border-t border-white/[0.04] pt-8 md:flex-row">
          <p className="font-mono text-[10px] tracking-widest text-zinc-600">
            WATCHFLOW © {new Date().getFullYear()}
          </p>
          <div className="flex gap-8">
            {["Features", "Pricing", "FAQ", "Dashboard"].map((l) => (
              <Link
                key={l}
                href={l === "Dashboard" ? "/dashboard" : `#${l.toLowerCase()}`}
                className="text-xs uppercase tracking-[0.15em] text-zinc-600 transition-colors hover:text-cyan-500/80"
              >
                {l}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
