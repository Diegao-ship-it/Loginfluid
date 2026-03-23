import { useEffect, useRef, useState } from "react";

const NUM_BALLS = 38;
const GRAVITY = 0.12;
const DAMPING = 0.28;
const FRICTION = 0.96;
const BALL_RADIUS = 52;
const METABALL_THRESHOLD = 1.0;

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

function initBalls(containerX: number, containerW: number, containerH: number): Ball[] {
  const balls: Ball[] = [];
  for (let i = 0; i < NUM_BALLS; i++) {
    balls.push({
      x: containerX + Math.random() * containerW,
      y: containerH * 0.1 + Math.random() * containerH * 0.2,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3,
      r: BALL_RADIUS * (0.8 + Math.random() * 0.4),
    });
  }
  return balls;
}

export default function LoginPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>([]);
  const animFrameRef = useRef<number>(0);
  const modeRef = useRef<"login" | "register">("login");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [formData, setFormData] = useState({
    name: "", email: "", password: "", confirmPassword: "",
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let width = 0, height = 0;
    let imageData: ImageData;
    let leftX = 0, leftW = 0, rightX = 0, rightW = 0;

    const resize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width;
      canvas.height = height;
      imageData = ctx.createImageData(width, height);
      leftX = 0;
      leftW = Math.floor(width / 2);
      rightX = Math.floor(width / 2);
      rightW = width - rightX;
      if (ballsRef.current.length === 0) {
        ballsRef.current = initBalls(leftX, leftW, height);
      }
    };

    resize();
    window.addEventListener("resize", resize);

    const getContainer = () => {
      if (modeRef.current === "login") return { x: leftX, w: leftW };
      return { x: rightX, w: rightW };
    };

    const repelBalls = () => {
      const balls = ballsRef.current;
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i], b = balls[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = a.r * 0.9 + b.r * 0.9;
          if (dist < minDist && dist > 0) {
            const overlap = (minDist - dist) / dist;
            const fx = dx * overlap * 0.3;
            const fy = dy * overlap * 0.3;
            a.x -= fx; a.y -= fy;
            b.x += fx; b.y += fy;
            const nx = dx / dist, ny = dy / dist;
            const relV = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (relV < 0) {
              const impulse = relV * 0.18;
              a.vx += impulse * nx; a.vy += impulse * ny;
              b.vx -= impulse * nx; b.vy -= impulse * ny;
            }
          }
        }
      }
    };

    const update = () => {
      const balls = ballsRef.current;
      const con = getContainer();
      const floor = height;
      const ceiling = 0;

      for (const b of balls) {
        b.vy += GRAVITY;
        b.x += b.vx;
        b.y += b.vy;
        b.vx *= FRICTION;

        const wallLeft = con.x + b.r * 0.5;
        const wallRight = con.x + con.w - b.r * 0.5;

        if (b.x < wallLeft) {
          b.x = wallLeft;
          b.vx = Math.abs(b.vx) * DAMPING;
        } else if (b.x > wallRight) {
          b.x = wallRight;
          b.vx = -Math.abs(b.vx) * DAMPING;
        }

        if (b.y > floor - b.r * 0.4) {
          b.y = floor - b.r * 0.4;
          b.vy = -Math.abs(b.vy) * DAMPING;
          b.vx *= 0.85;
        }
        if (b.y < ceiling + b.r * 0.4) {
          b.y = ceiling + b.r * 0.4;
          b.vy = Math.abs(b.vy) * DAMPING;
        }
      }

      repelBalls();
    };

    const draw = () => {
      const balls = ballsRef.current;
      const data = imageData.data;

      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          let sum = 0;
          for (const b of balls) {
            const dx = px - b.x;
            const dy = py - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < b.r * b.r * 16) {
              sum += (b.r * b.r) / d2;
            }
          }

          const idx = (py * width + px) * 4;

          if (sum > METABALL_THRESHOLD) {
            const t = Math.min(1, (sum - METABALL_THRESHOLD) / 1.5);
            const isLeft = px < width / 2;

            const r1 = isLeft ? [99, 102, 241] : [59, 130, 246];
            const r2 = isLeft ? [139, 92, 246] : [6, 182, 212];

            const blend = px / width;
            const rr = r1[0] + (r2[0] - r1[0]) * blend;
            const gg = r1[1] + (r2[1] - r1[1]) * blend;
            const bb = r1[2] + (r2[2] - r1[2]) * blend;

            const edge = Math.min(1, Math.abs(sum - METABALL_THRESHOLD) * 2.5);
            const shine = Math.max(0, 1 - Math.abs(sum - 1.3) * 4) * 0.7;

            data[idx] = Math.min(255, rr + shine * 160);
            data[idx + 1] = Math.min(255, gg + shine * 160);
            data[idx + 2] = Math.min(255, bb + shine * 200);
            data[idx + 3] = Math.round(220 * Math.min(1, t * 3));
          } else {
            data[idx] = 0;
            data[idx + 1] = 0;
            data[idx + 2] = 0;
            data[idx + 3] = 0;
          }
        }
      }

      ctx.clearRect(0, 0, width, height);
      ctx.putImageData(imageData, 0, 0);
    };

    let lastTime = 0;
    const loop = (time: number) => {
      animFrameRef.current = requestAnimationFrame(loop);
      if (time - lastTime < 20) return;
      lastTime = time;
      update();
      draw();
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const switchMode = (newMode: "login" | "register") => {
    if (newMode === modeRef.current) return;
    modeRef.current = newMode;
    setMode(newMode);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    const targetX = newMode === "login" ? w * 0.25 : w * 0.75;

    const balls = ballsRef.current;
    balls.forEach((b) => {
      const pushDir = newMode === "register" ? 1 : -1;
      b.vx += pushDir * (3 + Math.random() * 5);
      b.vy -= Math.random() * 2;
    });
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0d0d1a] flex">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 1, mixBlendMode: "screen", opacity: 0.95 }}
      />

      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        <div className="w-1/2 h-full absolute left-0 bg-gradient-to-br from-[#12122a] to-[#0d0d1a]" />
        <div className="w-1/2 h-full absolute right-0 bg-gradient-to-bl from-[#0d1a2a] to-[#0d0d1a]" />
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/5" />
      </div>

      <div
        className="relative flex-1 flex flex-col items-center justify-center px-10 py-12 transition-all duration-500"
        style={{ zIndex: 10 }}
      >
        <div
          className={`w-full max-w-sm transition-all duration-500 ${
            mode === "login" ? "opacity-100 scale-100" : "opacity-25 scale-95 pointer-events-none"
          }`}
        >
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/80 to-purple-600/80 mb-4 shadow-xl shadow-indigo-500/20 backdrop-blur-sm border border-white/10">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-lg">Bem-vindo</h1>
            <p className="text-slate-300/70 mt-1 text-sm">Entre na sua conta para continuar</p>
          </div>

          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="block text-xs font-semibold text-slate-300/60 mb-1.5 uppercase tracking-widest">E-mail</label>
              <input
                type="email" name="email" value={formData.email} onChange={handleInput}
                placeholder="seu@email.com"
                className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400/50 focus:bg-black/40 transition-all text-sm backdrop-blur-md"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300/60 mb-1.5 uppercase tracking-widest">Senha</label>
              <input
                type="password" name="password" value={formData.password} onChange={handleInput}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400/50 focus:bg-black/40 transition-all text-sm backdrop-blur-md"
                autoComplete="current-password"
              />
            </div>
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-400 cursor-pointer select-none">
                <input type="checkbox" className="rounded border-white/20 bg-white/5 accent-indigo-500" />
                Lembrar de mim
              </label>
              <button type="button" className="text-indigo-300/80 hover:text-indigo-200 transition-colors">
                Esqueci a senha
              </button>
            </div>
            <button
              type="submit"
              className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm transition-all shadow-xl shadow-indigo-600/30 hover:-translate-y-0.5 active:translate-y-0 mt-2"
            >
              Entrar
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Não tem conta?{" "}
            <button onClick={() => switchMode("register")} className="text-indigo-300 hover:text-indigo-200 font-semibold transition-colors">
              Cadastre-se
            </button>
          </p>
        </div>
      </div>

      <div
        className="relative flex-1 flex flex-col items-center justify-center px-10 py-12 transition-all duration-500"
        style={{ zIndex: 10 }}
      >
        <div
          className={`w-full max-w-sm transition-all duration-500 ${
            mode === "register" ? "opacity-100 scale-100" : "opacity-25 scale-95 pointer-events-none"
          }`}
        >
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/80 to-cyan-500/80 mb-4 shadow-xl shadow-blue-500/20 backdrop-blur-sm border border-white/10">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-lg">Criar Conta</h1>
            <p className="text-slate-300/70 mt-1 text-sm">Preencha para começar agora</p>
          </div>

          <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="block text-xs font-semibold text-slate-300/60 mb-1.5 uppercase tracking-widest">Nome completo</label>
              <input
                type="text" name="name" value={formData.name} onChange={handleInput}
                placeholder="Seu nome"
                className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400/50 focus:bg-black/40 transition-all text-sm backdrop-blur-md"
                autoComplete="name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300/60 mb-1.5 uppercase tracking-widest">E-mail</label>
              <input
                type="email" name="email" value={formData.email} onChange={handleInput}
                placeholder="seu@email.com"
                className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400/50 focus:bg-black/40 transition-all text-sm backdrop-blur-md"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300/60 mb-1.5 uppercase tracking-widest">Senha</label>
              <input
                type="password" name="password" value={formData.password} onChange={handleInput}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400/50 focus:bg-black/40 transition-all text-sm backdrop-blur-md"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300/60 mb-1.5 uppercase tracking-widest">Confirmar senha</label>
              <input
                type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInput}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400/50 focus:bg-black/40 transition-all text-sm backdrop-blur-md"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold text-sm transition-all shadow-xl shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0 mt-1"
            >
              Criar conta
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Já tem conta?{" "}
            <button onClick={() => switchMode("login")} className="text-blue-300 hover:text-blue-200 font-semibold transition-colors">
              Entrar
            </button>
          </p>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2" style={{ zIndex: 20 }}>
        <button
          onClick={() => switchMode("login")}
          className={`px-5 py-2 rounded-full text-xs font-bold transition-all backdrop-blur-sm ${
            mode === "login"
              ? "bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/40 border border-indigo-400/30"
              : "bg-white/8 text-slate-400 hover:bg-white/12 border border-white/10"
          }`}
        >
          Login
        </button>
        <button
          onClick={() => switchMode("register")}
          className={`px-5 py-2 rounded-full text-xs font-bold transition-all backdrop-blur-sm ${
            mode === "register"
              ? "bg-blue-600/90 text-white shadow-lg shadow-blue-600/40 border border-blue-400/30"
              : "bg-white/8 text-slate-400 hover:bg-white/12 border border-white/10"
          }`}
        >
          Cadastro
        </button>
      </div>
    </div>
  );
}
