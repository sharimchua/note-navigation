import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  color: string;
  opacity: number;
  radius: number;
}

interface ParticleTrailLayerProps {
  /** The active note Y positions in SVG viewBox coordinates (mapped to canvas) */
  activeNoteYs: { y: number; color: string }[];
  /** SVG viewBox dimensions so we can map to canvas pixels */
  viewBoxWidth: number;
  viewBoxHeight: number;
  /** Spawn x in viewBox coords — particles start here and drift left */
  spawnX: number;
}

// Pixels per frame in viewBox coords
const SPEED = 0.15;
// Opacity shed per frame (slower fade for longer trails)
const FADE_RATE = 0.0008;
// Spawn every N frames to throttle density
const SPAWN_EVERY = 4;

export function ParticleTrailLayer({
  activeNoteYs,
  viewBoxWidth,
  viewBoxHeight,
  spawnX,
}: ParticleTrailLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef(0);
  const rafRef = useRef<number>(0);
  const propsRef = useRef({ activeNoteYs, spawnX });

  // Keep props ref in sync without restarting the loop
  propsRef.current = { activeNoteYs, spawnX };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function loop() {
      const { activeNoteYs, spawnX } = propsRef.current;
      const c = canvasRef.current;
      if (!c) return;
      const ctx2 = c.getContext("2d");
      if (!ctx2) return;

      const w = c.width;
      const h = c.height;
      const scaleX = w / viewBoxWidth;
      const scaleY = h / viewBoxHeight;

      frameRef.current++;

      // Spawn new particles for active notes
      if (frameRef.current % SPAWN_EVERY === 0 && activeNoteYs.length > 0) {
        for (const { y, color } of activeNoteYs) {
          particlesRef.current.push({
            x: spawnX,
            y,
            color,
            opacity: 0.85,
            radius: 2.2,
          });
        }
      }

      // Update and prune
      particlesRef.current = particlesRef.current
        .map(p => ({ ...p, x: p.x - SPEED, opacity: p.opacity - FADE_RATE }))
        .filter(p => p.opacity > 0 && p.x > 0);

      // Cap total particles for performance
      if (particlesRef.current.length > 600) {
        particlesRef.current = particlesRef.current.slice(-600);
      }

      // Draw
      ctx2.clearRect(0, 0, w, h);
      for (const p of particlesRef.current) {
        ctx2.beginPath();
        ctx2.arc(p.x * scaleX, p.y * scaleY, p.radius * scaleX, 0, Math.PI * 2);
        ctx2.globalAlpha = p.opacity;
        ctx2.fillStyle = p.color;
        ctx2.fill();
      }
      ctx2.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      particlesRef.current = [];
    };
  }, [viewBoxWidth, viewBoxHeight]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={200}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
