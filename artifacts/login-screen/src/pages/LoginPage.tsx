import { useEffect, useRef, useState } from "react";

const NUM_BALLS = 80;
const GRAVITY = 0.42;
const BOUNCE = 0.05;
const FRICTION = 0.982;
const REPULSE_STRENGTH = 0.6;
const R_MIN = 26;
const R_MAX = 52;

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  el: HTMLDivElement;
}

function spawnBalls(
  container: HTMLDivElement,
  count: number,
  cLeft: number,
  cRight: number,
  height: number
): Ball[] {
  const balls: Ball[] = [];
  const w = cRight - cLeft;
  const cols = Math.ceil(Math.sqrt(count * (w / height) * 1.5));
  const rows = Math.ceil(count / cols);
  const spacingX = w / (cols + 1);
  const spacingY = (height * 0.72) / (rows + 1);

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const r = R_MIN + Math.random() * (R_MAX - R_MIN);

    const x = cLeft + spacingX * (col + 1) + (Math.random() - 0.5) * spacingX * 0.5;
    const y = height - spacingY * (row + 1) + (Math.random() - 0.5) * spacingY * 0.4 + height * 0.05;

    const el = document.createElement("div");
    el.style.cssText = `
      position:absolute;
      border-radius:50%;
      width:${r * 2}px;
      height:${r * 2}px;
      left:${x - r}px;
      top:${y - r}px;
      background: radial-gradient(circle at 38% 35%, rgba(180,180,255,0.45) 0%, rgba(99,102,241,1) 55%, rgba(67,56,202,1) 100%);
      will-change: transform;
    `;
    container.appendChild(el);
    balls.push({ x, y, vx: (Math.random() - 0.5) * 0.5, vy: Math.random() * 1, r, el });
  }
  return balls;
}

export default function LoginPage() {
  const liquidRef = useRef<HTMLDivElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const ballsRef = useRef<Ball[]>([]);
  const frameRef = useRef<number>(0);
  const modeRef = useRef<"login" | "register">("login");
  const transitionRef = useRef(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [formData, setFormData] = useState({ name: "", email: "", password: "", confirmPassword: "" });

  useEffect(() => {
    const container = liquidRef.current;
    const floorEl = floorRef.current;
    if (!container || !floorEl) return;

    let W = container.offsetWidth;
    let H = container.offsetHeight;

    const getWalls = () => {
      const m = modeRef.current;
      if (transitionRef.current) {
        return { left: 0, right: W };
      }
      return m === "login"
        ? { left: 0, right: W / 2 }
        : { left: W / 2, right: W };
    };

    const updateFloor = (targetMode: "login" | "register") => {
      const half = W / 2;
      floorEl.style.left = (targetMode === "login" ? 0 : half) + "px";
      floorEl.style.width = half + "px";
    };

    W = container.offsetWidth;
    H = container.offsetHeight;
    updateFloor("login");

    const balls = spawnBalls(container, NUM_BALLS, 0, W / 2, H);
    ballsRef.current = balls;

    const repulse = () => {
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i], b = balls[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          const minD = (a.r + b.r) * 0.92;
          if (d2 < minD * minD && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const overlap = (minD - d) / d;
            const fx = dx * overlap * REPULSE_STRENGTH * 0.5;
            const fy = dy * overlap * REPULSE_STRENGTH * 0.5;
            a.x -= fx; a.y -= fy;
            b.x += fx; b.y += fy;
            const nx = dx / d, ny = dy / d;
            const relV = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (relV < 0) {
              const imp = relV * 0.12;
              a.vx += imp * nx; a.vy += imp * ny;
              b.vx -= imp * nx; b.vy -= imp * ny;
            }
          }
        }
      }
    };

    const update = () => {
      const { left, right } = getWalls();
      const floorY = H;
      const ceilY = 0;

      for (const b of balls) {
        b.vy += GRAVITY;
        b.x += b.vx;
        b.y += b.vy;
        b.vx *= FRICTION;
        b.vy *= FRICTION;

        const wallL = left + b.r * 0.45;
        const wallR = right - b.r * 0.45;

        if (b.x < wallL) {
          b.x = wallL;
          b.vx = Math.abs(b.vx) * BOUNCE;
        } else if (b.x > wallR) {
          b.x = wallR;
          b.vx = -Math.abs(b.vx) * BOUNCE;
        }

        if (b.y > floorY - b.r * 0.42) {
          b.y = floorY - b.r * 0.42;
          b.vy = -Math.abs(b.vy) * BOUNCE;
          b.vx *= 0.92;
        } else if (b.y < ceilY + b.r * 0.42) {
          b.y = ceilY + b.r * 0.42;
          b.vy = Math.abs(b.vy) * BOUNCE;
        }
      }

      repulse();

      for (const b of balls) {
        b.el.style.left = (b.x - b.r) + "px";
        b.el.style.top = (b.y - b.r) + "px";
      }
    };

    const loop = () => {
      update();
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);

    const onResize = () => {
      W = container.offsetWidth;
      H = container.offsetHeight;
      updateFloor(modeRef.current);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      balls.forEach((b) => b.el.remove());
    };
  }, []);

  const switchMode = (newMode: "login" | "register") => {
    if (newMode === modeRef.current || transitionRef.current) return;
    modeRef.current = newMode;
    setMode(newMode);
    transitionRef.current = true;

    const balls = ballsRef.current;
    const pushDir = newMode === "register" ? 1 : -1;

    balls.forEach((b, i) => {
      const delay = i * 8;
      setTimeout(() => {
        b.vx += pushDir * (4 + Math.random() * 7);
        b.vy += -1 - Math.random() * 3;
      }, delay);
    });

    const floorEl = floorRef.current;
    if (floorEl) {
      const W = liquidRef.current?.offsetWidth ?? 0;
      setTimeout(() => {
        floorEl.style.transition = "left 1.4s cubic-bezier(0.4,0,0.2,1), background 1s";
        floorEl.style.left = (newMode === "login" ? 0 : W / 2) + "px";
        setTimeout(() => {
          floorEl.style.transition = "";
        }, 1500);
      }, 50);
    }

    setTimeout(() => {
      transitionRef.current = false;
    }, 1600);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#080812] flex select-none">
      <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <filter id="goo" colorInterpolationFilters="sRGB" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 28 -12"
              result="goo"
            />
          </filter>
        </defs>
      </svg>

      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0e0e22] via-[#080812] to-[#080812]" />
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/[0.04]" />
      </div>

      <div
        ref={liquidRef}
        className="absolute inset-0 z-10 overflow-hidden"
        style={{ filter: "url(#goo)" }}
      >
        <div
          ref={floorRef}
          className="absolute bottom-0"
          style={{
            background: "radial-gradient(ellipse at 50% 120%, rgba(120,120,255,1) 0%, rgba(99,102,241,1) 40%, rgba(67,56,202,1) 100%)",
            borderRadius: "40px 40px 0 0",
            width: "50%",
            height: "90px",
            left: 0,
          }}
        />
      </div>

      <div className="absolute inset-0 z-20 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 40% 60% at 25% 85%, rgba(99,102,241,0.18) 0%, transparent 70%), radial-gradient(ellipse 40% 60% at 75% 85%, rgba(59,130,246,0.10) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-30 flex w-full h-full">
        <div className="flex-1 flex flex-col items-center justify-center px-10 py-12">
          <div
            className={`w-full max-w-sm transition-all duration-500 ${
              mode === "login" ? "opacity-100 translate-y-0" : "opacity-20 translate-y-2 pointer-events-none"
            }`}
          >
            <div className="mb-8 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 shadow-2xl shadow-indigo-800/60 backdrop-blur border border-white/10"
                style={{ background: "rgba(30,27,75,0.7)" }}>
                <svg className="w-7 h-7 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Bem-vindo</h1>
              <p className="text-indigo-200/50 mt-1 text-sm">Entre na sua conta para continuar</p>
            </div>

            <form className="space-y-4 pointer-events-auto" onSubmit={(e) => e.preventDefault()}>
              <div>
                <label className="block text-[10px] font-bold text-indigo-200/50 mb-1.5 uppercase tracking-[0.15em]">E-mail</label>
                <input
                  type="email" name="email" value={formData.email} onChange={handleInput}
                  placeholder="seu@email.com" autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-indigo-200/25 text-sm outline-none transition-all"
                  style={{ background: "rgba(15,12,40,0.55)", border: "1px solid rgba(99,102,241,0.2)", backdropFilter: "blur(12px)" }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-indigo-200/50 mb-1.5 uppercase tracking-[0.15em]">Senha</label>
                <input
                  type="password" name="password" value={formData.password} onChange={handleInput}
                  placeholder="••••••••" autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-indigo-200/25 text-sm outline-none transition-all"
                  style={{ background: "rgba(15,12,40,0.55)", border: "1px solid rgba(99,102,241,0.2)", backdropFilter: "blur(12px)" }}
                />
              </div>
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-indigo-200/40 cursor-pointer">
                  <input type="checkbox" className="accent-indigo-500" />
                  Lembrar de mim
                </label>
                <button type="button" className="text-indigo-300/60 hover:text-indigo-200 transition-colors">Esqueci a senha</button>
              </div>
              <button type="submit"
                className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all hover:-translate-y-0.5"
                style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)", boxShadow: "0 8px 32px rgba(99,102,241,0.4)" }}>
                Entrar
              </button>
            </form>

            <p className="text-center text-xs text-indigo-200/30 mt-6 pointer-events-auto">
              Não tem conta?{" "}
              <button onClick={() => switchMode("register")} className="text-indigo-300/70 hover:text-indigo-200 font-semibold transition-colors">
                Cadastre-se
              </button>
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-10 py-12">
          <div
            className={`w-full max-w-sm transition-all duration-500 ${
              mode === "register" ? "opacity-100 translate-y-0" : "opacity-20 translate-y-2 pointer-events-none"
            }`}
          >
            <div className="mb-6 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 shadow-2xl shadow-blue-900/60 backdrop-blur border border-white/10"
                style={{ background: "rgba(15,23,42,0.7)" }}>
                <svg className="w-7 h-7 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Criar Conta</h1>
              <p className="text-blue-200/50 mt-1 text-sm">Preencha para começar agora</p>
            </div>

            <form className="space-y-3 pointer-events-auto" onSubmit={(e) => e.preventDefault()}>
              <div>
                <label className="block text-[10px] font-bold text-blue-200/50 mb-1.5 uppercase tracking-[0.15em]">Nome completo</label>
                <input
                  type="text" name="name" value={formData.name} onChange={handleInput}
                  placeholder="Seu nome" autoComplete="name"
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-blue-200/25 text-sm outline-none transition-all"
                  style={{ background: "rgba(10,15,30,0.55)", border: "1px solid rgba(59,130,246,0.2)", backdropFilter: "blur(12px)" }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-blue-200/50 mb-1.5 uppercase tracking-[0.15em]">E-mail</label>
                <input
                  type="email" name="email" value={formData.email} onChange={handleInput}
                  placeholder="seu@email.com" autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-blue-200/25 text-sm outline-none transition-all"
                  style={{ background: "rgba(10,15,30,0.55)", border: "1px solid rgba(59,130,246,0.2)", backdropFilter: "blur(12px)" }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-blue-200/50 mb-1.5 uppercase tracking-[0.15em]">Senha</label>
                <input
                  type="password" name="password" value={formData.password} onChange={handleInput}
                  placeholder="••••••••" autoComplete="new-password"
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-blue-200/25 text-sm outline-none transition-all"
                  style={{ background: "rgba(10,15,30,0.55)", border: "1px solid rgba(59,130,246,0.2)", backdropFilter: "blur(12px)" }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-blue-200/50 mb-1.5 uppercase tracking-[0.15em]">Confirmar senha</label>
                <input
                  type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInput}
                  placeholder="••••••••" autoComplete="new-password"
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-blue-200/25 text-sm outline-none transition-all"
                  style={{ background: "rgba(10,15,30,0.55)", border: "1px solid rgba(59,130,246,0.2)", backdropFilter: "blur(12px)" }}
                />
              </div>
              <button type="submit"
                className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all hover:-translate-y-0.5"
                style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", boxShadow: "0 8px 32px rgba(59,130,246,0.4)" }}>
                Criar conta
              </button>
            </form>

            <p className="text-center text-xs text-blue-200/30 mt-5 pointer-events-auto">
              Já tem conta?{" "}
              <button onClick={() => switchMode("login")} className="text-blue-300/70 hover:text-blue-200 font-semibold transition-colors">
                Entrar
              </button>
            </p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-40">
        <button
          onClick={() => switchMode("login")}
          className="px-5 py-2 rounded-full text-xs font-bold transition-all"
          style={mode === "login"
            ? { background: "rgba(99,102,241,0.85)", color: "#fff", boxShadow: "0 4px 20px rgba(99,102,241,0.5)", border: "1px solid rgba(165,163,255,0.3)" }
            : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>
          Login
        </button>
        <button
          onClick={() => switchMode("register")}
          className="px-5 py-2 rounded-full text-xs font-bold transition-all"
          style={mode === "register"
            ? { background: "rgba(59,130,246,0.85)", color: "#fff", boxShadow: "0 4px 20px rgba(59,130,246,0.5)", border: "1px solid rgba(147,197,253,0.3)" }
            : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>
          Cadastro
        </button>
      </div>
    </div>
  );
}
