"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MagneticButtonProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof motion.button>,
    "children"
  > {
  variant?: "primary" | "ghost" | "outline";
  glow?: boolean;
  children: React.ReactNode;
}

export function MagneticButton({
  className,
  variant = "primary",
  glow = true,
  children,
  ...props
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [cursor, setCursor] = useState({ x: 50, y: 50 });

  function handleMove(e: React.MouseEvent<HTMLButtonElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setOffset({ x: x * 0.18, y: y * 0.18 });
    setCursor({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }

  function handleLeave() {
    setOffset({ x: 0, y: 0 });
  }

  const variants = {
    primary:
      "bg-cyan-500/10 text-cyan-50 border border-cyan-400/30 shadow-[0_0_40px_-12px_rgba(34,211,238,0.55)] hover:border-cyan-300/50",
    ghost: "bg-white/[0.03] text-zinc-300 border border-white/[0.06] hover:border-white/15",
    outline: "bg-transparent text-zinc-200 border border-zinc-700 hover:border-cyan-500/40",
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      animate={{ x: offset.x, y: offset.y }}
      transition={{ type: "spring", stiffness: 350, damping: 22, mass: 0.4 }}
      className={cn(
        "relative overflow-hidden rounded-full px-6 py-3 text-sm font-medium tracking-wide transition-colors duration-300",
        variants[variant],
        className
      )}
      {...props}
    >
      {glow && variant === "primary" && (
        <span
          className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${cursor.x}% ${cursor.y}%, rgba(34,211,238,0.35), transparent 55%)`,
          }}
        />
      )}
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
    </motion.button>
  );
}
