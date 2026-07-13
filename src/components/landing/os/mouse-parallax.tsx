"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export function MouseParallaxLayer({
  children,
  depth = 20,
  className,
}: {
  children: React.ReactNode;
  depth?: number;
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [depth * 0.15, -depth * 0.15]), {
    stiffness: 120,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-depth * 0.15, depth * 0.15]), {
    stiffness: 120,
    damping: 20,
  });
  const x = useSpring(useTransform(mx, [-0.5, 0.5], [-depth, depth]), {
    stiffness: 120,
    damping: 20,
  });
  const y = useSpring(useTransform(my, [-0.5, 0.5], [-depth, depth]), {
    stiffness: 120,
    damping: 20,
  });

  useEffect(() => {
    if (reducedMotion || depth <= 0) return;
    // Skip parallax on coarse pointers (touch / mobile)
    if (window.matchMedia("(pointer: coarse)").matches) return;

    function onMove(e: MouseEvent) {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      mx.set(nx);
      my.set(ny);
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [mx, my, reducedMotion, depth]);

  if (reducedMotion || depth <= 0) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div style={{ rotateX, rotateY, x, y }} className={className}>
      {children}
    </motion.div>
  );
}
