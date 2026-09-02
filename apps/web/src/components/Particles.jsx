import { useEffect, useRef } from 'react';

export default function Particles({ lowPerformance = false, reducedMotion = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (reducedMotion) return undefined;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    let frameId;
    let particles = [];
    let visible = !document.hidden;

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, lowPerformance ? 1 : 1.5);
      const isSmallScreen = window.innerWidth <= 640;
      const targetCount = lowPerformance
        ? isSmallScreen
          ? 12
          : 24
        : Math.min(48, Math.max(30, Math.floor(window.innerWidth / 36)));

      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      particles = Array.from({ length: targetCount }, (_, index) => createParticle(index, lowPerformance));
    }

    function draw() {
      if (!visible) {
        frameId = requestAnimationFrame(draw);
        return;
      }

      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      context.shadowBlur = 0;
      particles.forEach((particle) => {
        particle.y -= particle.speed;
        particle.x += particle.drift;

        if (particle.y < -8) {
          particle.cycles += 1;
          particle.y = window.innerHeight + 8;
          particle.x = seededUnit(particle.seed + particle.cycles * 17) * window.innerWidth;
        }

        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(139, 214, 255, ${particle.alpha})`;
        context.fill();
      });

      frameId = requestAnimationFrame(draw);
    }

    function handleVisibilityChange() {
      visible = !document.hidden;
    }

    resize();
    draw();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lowPerformance, reducedMotion]);

  if (reducedMotion) return null;

  return <canvas ref={canvasRef} className="particles" aria-hidden="true" />;
}

function createParticle(index, lowPerformance) {
  const seed = index + 1;

  return {
    seed,
    cycles: 0,
    x: seededUnit(seed * 3) * window.innerWidth,
    y: seededUnit(seed * 5) * window.innerHeight,
    radius: seededUnit(seed * 7) * (lowPerformance ? 1.2 : 1.6) + 0.35,
    speed: seededUnit(seed * 11) * (lowPerformance ? 0.12 : 0.2) + 0.04,
    drift: seededUnit(seed * 13) * 0.12 - 0.06,
    alpha: seededUnit(seed * 19) * 0.28 + 0.1
  };
}

function seededUnit(value) {
  const signal = Math.sin(value * 12.9898) * 43758.5453;
  return signal - Math.floor(signal);
}
