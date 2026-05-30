"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

interface WaveStream {
  yBase: number;
  amplitude: number;
  frequency: number;
  phase: number;
  speed: number;
  color: string;
  dotSpacing: number;
  spread: number;
  dotRadius: number;
  dotOpacity: number;
  dotCount: number;
  shimmerSpeed?: number;
  shimmerScale?: number;
}

const LANDING_WAVE_ANCHOR_ID = "how-it-works";

function WaveParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const noiseCache: number[][] = [];
    for (let i = 0; i < 2400; i++) {
      noiseCache.push(Array.from({ length: 16 }, () => (Math.random() - 0.5) * 2));
    }

    const streams: WaveStream[] = [
      {
        yBase: 0.47,
        amplitude: 0.13,
        frequency: 0.0041,
        phase: 0,
        speed: 0.00052,
        color: "16,163,127",
        dotSpacing: 6,
        spread: 58,
        dotRadius: 1.75,
        dotOpacity: 0.78,
        dotCount: 16,
        shimmerSpeed: 0.045,
        shimmerScale: 0.28,
      },
      {
        yBase: 0.47,
        amplitude: 0.13,
        frequency: 0.0041,
        phase: 0,
        speed: 0.00052,
        color: "64,210,190",
        dotSpacing: 8,
        spread: 82,
        dotRadius: 1.25,
        dotOpacity: 0.32,
        dotCount: 11,
        shimmerSpeed: 0.038,
        shimmerScale: 0.22,
      },
      {
        yBase: 0.57,
        amplitude: 0.12,
        frequency: 0.0036,
        phase: Math.PI * 1.15,
        speed: 0.0004,
        color: "96,124,196",
        dotSpacing: 6,
        spread: 56,
        dotRadius: 1.7,
        dotOpacity: 0.72,
        dotCount: 15,
        shimmerSpeed: 0.042,
        shimmerScale: 0.26,
      },
      {
        yBase: 0.57,
        amplitude: 0.12,
        frequency: 0.0036,
        phase: Math.PI * 1.15,
        speed: 0.0004,
        color: "26,86,219",
        dotSpacing: 9,
        spread: 76,
        dotRadius: 1.2,
        dotOpacity: 0.3,
        dotCount: 10,
        shimmerSpeed: 0.035,
        shimmerScale: 0.2,
      },
      {
        yBase: 0.52,
        amplitude: 0.085,
        frequency: 0.0062,
        phase: Math.PI * 0.62,
        speed: 0.00058,
        color: "45,198,181",
        dotSpacing: 7,
        spread: 34,
        dotRadius: 1.35,
        dotOpacity: 0.42,
        dotCount: 7,
        shimmerSpeed: 0.05,
        shimmerScale: 0.24,
      },
      {
        yBase: 0.54,
        amplitude: 0.09,
        frequency: 0.0051,
        phase: Math.PI * 1.85,
        speed: 0.00048,
        color: "140,160,220",
        dotSpacing: 8,
        spread: 38,
        dotRadius: 1.25,
        dotOpacity: 0.34,
        dotCount: 6,
        shimmerSpeed: 0.04,
        shimmerScale: 0.2,
      },
    ];

    let t = 0;

    const draw = () => {
      const H = canvas.height;
      const W = canvas.width;
      ctx.clearRect(0, 0, W, H);

      streams.forEach((s) => {
        const yBase = s.yBase * H;
        const amp = s.amplitude * H;
        const phaseAnim = s.phase + t * s.speed * Math.PI * 2;
        const cols = Math.ceil(W / s.dotSpacing) + 1;

        for (let ci = 0; ci < cols; ci++) {
          const x = ci * s.dotSpacing;
          const centerY = yBase + amp * Math.sin(s.frequency * x + phaseAnim);
          const noise = noiseCache[ci % noiseCache.length];

          for (let di = 0; di < s.dotCount; di++) {
            const n = noise[di % noise.length];
            const yOffset = n * s.spread;
            const distRatio = Math.abs(yOffset) / s.spread;
            const opacityFactor = Math.max(0, 1 - distRatio * distRatio * 1.35);
            const shimmer =
              1 -
              (s.shimmerScale ?? 0.2) +
              (s.shimmerScale ?? 0.2) *
                (0.5 +
                  0.5 *
                    Math.sin(
                      t * (s.shimmerSpeed ?? 0.04) + x * 0.011 + di * 0.65 + s.phase,
                    ));
            const finalOpacity = s.dotOpacity * opacityFactor * shimmer;

            if (finalOpacity < 0.015) continue;

            const xJitter = noise[(di + 3) % noise.length] * s.dotSpacing * 0.35;
            const xDrift = Math.sin(t * 0.0018 + ci * 0.08 + di) * 1.2;

            ctx.beginPath();
            ctx.arc(x + xJitter + xDrift, centerY + yOffset, s.dotRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${s.color},${finalOpacity})`;
            ctx.fill();
          }
        }
      });

      t++;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}

/** Волна только на GPT-лендинге — от блока «Как это работает» и ниже. */
export function LandingAnimatedBackground() {
  const shouldReduce = useReducedMotion();
  const [topPx, setTopPx] = useState<number | null>(null);

  useEffect(() => {
    const measure = () => {
      const anchor = document.getElementById(LANDING_WAVE_ANCHOR_ID);
      if (!anchor) return;
      setTopPx(Math.max(0, anchor.getBoundingClientRect().top + window.scrollY));
    };

    const anchor = document.getElementById(LANDING_WAVE_ANCHOR_ID);
    if (!anchor) return;

    measure();
    const raf = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);

    const observer = new ResizeObserver(measure);
    observer.observe(anchor);
    observer.observe(document.body);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("load", measure);
      observer.disconnect();
    };
  }, []);

  if (shouldReduce || topPx === null) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 overflow-hidden"
      style={{ zIndex: 0, top: topPx, background: "#ffffff" }}
    >
      <WaveParticleCanvas />
    </div>
  );
}
