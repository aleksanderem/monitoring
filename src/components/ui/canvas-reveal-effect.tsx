"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cx } from "@/utils/cx";

interface CanvasRevealEffectProps {
  animationSpeed?: number;
  containerClassName?: string;
  colors?: [number, number, number][];
  dotSize?: number;
  showGradient?: boolean;
}

export function CanvasRevealEffect({
  animationSpeed = 0.4,
  containerClassName,
  colors = [[0, 255, 255]],
  dotSize = 3,
  showGradient = true,
}: CanvasRevealEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    const gap = dotSize + 3;
    const cols = Math.ceil(dimensions.width / gap);
    const rows = Math.ceil(dimensions.height / gap);
    const totalDots = cols * rows;

    // Each dot gets a random delay and the animation progresses over time
    const delays = new Float32Array(totalDots);
    for (let i = 0; i < totalDots; i++) {
      delays[i] = Math.random();
    }

    let startTime = performance.now();

    let done = false;

    const draw = (now: number) => {
      if (done) return;

      const elapsed = (now - startTime) * 0.001 * animationSpeed;
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      let allDone = true;

      for (let i = 0; i < totalDots; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * gap + gap / 2;
        const y = row * gap + gap / 2;

        const progress = Math.min(1, Math.max(0, (elapsed - delays[i]) * 2));
        if (progress <= 0) { allDone = false; continue; }
        if (progress < 1) allDone = false;

        const colorIndex = (col + row) % colors.length;
        const [r, g, b] = colors[colorIndex];

        ctx.beginPath();
        ctx.arc(x, y, (dotSize / 2) * progress, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${progress * 0.8})`;
        ctx.fill();
      }

      if (allDone) {
        done = true;
        return;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dimensions, colors, dotSize, animationSpeed]);

  return (
    <div ref={containerRef} className={cx("absolute inset-0", containerClassName)}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
      />
      {showGradient && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/90 via-white/40 to-transparent dark:from-gray-950/90 dark:via-gray-950/50" />
      )}
    </div>
  );
}

export function CanvasRevealCardWrapper({
  children,
  revealContent,
  className,
}: {
  children: React.ReactNode;
  revealContent: React.ReactNode;
  className?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cx("relative overflow-hidden", className)}
    >
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
          >
            {revealContent}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
