import { Component, onMount, onCleanup } from 'solid-js';

export const ParticleBackground: Component = () => {
  let canvasRef: HTMLCanvasElement | undefined;
  let animationId: number;

  onMount(() => {
    if (!canvasRef) return;

    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      if (canvasRef) {
        canvasRef.width = window.innerWidth;
        canvasRef.height = window.innerHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
    }

    const particles: Particle[] = [];
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvasRef.width,
        y: Math.random() * canvasRef.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.2,
      });
    }

    const animate = () => {
      if (!canvasRef || !ctx) return;
      
      ctx.fillStyle = 'rgba(10, 22, 40, 0.1)';
      ctx.fillRect(0, 0, canvasRef.width, canvasRef.height);

      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvasRef.width;
        if (p.x > canvasRef.width) p.x = 0;
        if (p.y < 0) p.y = canvasRef.height;
        if (p.y > canvasRef.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${p.opacity})`;
        ctx.fill();

        particles.slice(i + 1).forEach((p2) => {
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(0, 212, 255, ${(1 - distance / 150) * 0.1})`;
            ctx.stroke();
          }
        });
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    onCleanup(() => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    });
  });

  return (
    <canvas
      ref={canvasRef}
      class="fixed inset-0 pointer-events-none z-0"
      style="opacity: 0.6"
    />
  );
};
