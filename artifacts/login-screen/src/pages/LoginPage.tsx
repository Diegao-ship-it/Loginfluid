import { useEffect, useRef, useState } from "react";

// Surface balls only — the floor rect fills most of the container
const NUM_BALLS = 22;
const GRAVITY = 0.55;
const BOUNCE = 0.01;   // nearly no bounce — viscous
const FRICTION = 0.82; // aggressive damping — settles fast
const R_MIN = 52;
const R_MAX = 72;

// Floor fills 68% of the container height
const FLOOR_RATIO = 0.68;

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  el: HTMLDivElement;
}

const LIQUID_COLOR = "rgba(99,102,241,1)";
const LIQUID_DARK = "rgba(67,56,202,1)";
const LIQUID_LIGHT = "rgba(148,150,255,1)";

function spawnBalls(
  container: HTMLDivElement,
  cLeft: number,
  cRight: number,
  waterlineY: number
): Ball[] {
  const balls: Ball[] = [];
  const w = cRight - cLeft;
  const spacing = w / (NUM_BALLS + 1);

  for (let i = 0; i < NUM_BALLS; i++) {
    const r = R_MIN + Math.random() * (R_MAX - R_MIN);
    const x = cLeft + spacing * (i + 1) + (Math.random() - 0.5) * spacing * 0.6;
    const y = waterlineY - r * 0.3 + (Math.random() - 0.5) * 20;

    const el = document.createElement("div");
    el.style.cssText = `
      position:absolute;
      border-radius:50%;
      width:${r * 2}px;
      height:${r * 2}px;
      left:${x - r}px;
      top:${y - r}px;
      background: radial-gradient(circle at 35% 30%, ${LIQUID_LIGHT} 0%, ${LIQUID_COLOR} 50%, ${LIQUID_DARK} 100%);
      will-change: left,top;
    `;
    container.appendChild(el);
    balls.push({ x, y, vx: 0, vy: 0, r, el });
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
    const half = () => W / 2;

    const waterlineY = () => H * (1 - FLOOR_RATIO);

    const floorH = () => H * FLOOR_RATIO + 30; // +30 to bleed into bottom edge

    const applyFloor = (targetMode: "login" | "register", animated: boolean) => {
      const lx = targetMode === "login" ? 0 : half();
      if (animated) {
        floorEl.style.transition = "left 1.2s cubic-bezier(0.25,0.46,0.45,0.94)";
        setTimeout(() => { floorEl.style.transition = ""; }, 1300);
      }
      floorEl.style.left = lx + "px";
      floorEl.style.width = half() + "px";
      floorEl.style.height = floorH() + "px";
    };

    applyFloor("login", false);

    const balls = spawnBalls(container, 0, half(), waterlineY());
    ballsRef.current = balls;

    const getWalls = () => {
      if (transitionRef.current) return { left: -60, right: W + 60 };
      return modeRef.current === "login"
        ? { left: 0, right: half() }
        : { left: half(), right: W };
    };

    const repulse = (balls: Ball[]) => {
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i], b = balls[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          const minD = (a.r + b.r) * 0.88;
          if (d2 < minD * minD && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const overlap = (minD - d) * 0.4;
            const nx = dx / d, ny = dy / d;
            a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5;
            // transfer very little velocity — thick fluid
            const relV = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (relV < 0) {
              const imp = relV * 0.08;
              a.vx += imp * nx; a.vy += imp * ny;
              b.vx -= imp * nx; b.vy -= imp * ny;
            }
          }
        }
      }
    };

    const update = () => {
      const { left, right } = getWalls();
      const floor = H + 20;
      const wl = waterlineY();

      for (const b of balls) {
        b.vy += GRAVITY;
        b.x += b.vx;
        b.y += b.vy;
        b.vx *= FRICTION;
        b.vy *= FRICTION;

        // Hard stop for tiny velocities — no micro-trembling
        if (Math.abs(b.vx) < 0.04) b.vx = 0;
        if (Math.abs(b.vy) < 0.04) b.vy = 0;

        // Side walls
        if (b.x - b.r < left) {
          b.x = left + b.r;
          b.vx = Math.abs(b.vx) * BOUNCE;
        } else if (b.x + b.r > right) {
          b.x = right - b.r;
          b.vx = -Math.abs(b.vx) * BOUNCE;
        }

        // Floor — ball rests on the waterline (blends with floor rect)
        const restY = wl + b.r * 0.15;
        if (b.y > restY) {
          b.y = restY;
          b.vy = -Math.abs(b.vy) * BOUNCE;
          b.vx *= 0.7;
        }

        // Ceiling
        if (b.y - b.r < 0) {
          b.y = b.r;
          b.vy = Math.abs(b.vy) * BOUNCE;
        }
      }

      repulse(balls);

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
      applyFloor(modeRef.current, false);
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

    const floorEl = floorRef.current;
    const W = liquidRef.current?.offsetWidth ?? 0;
    if (floorEl) {
      floorEl.style.transition = "left 1.3s cubic-bezier(0.25,0.46,0.45,0.94)";
      floorEl.style.left = (newMode === "login" ? 0 : W / 2) + "px";
      setTimeout(() => { floorEl.style.transition = ""; }, 1400);
    }

    const balls = ballsRef.current;
    const pushDir = newMode === "register" ? 1 : -1;
    balls.forEach((b, i) => {
      setTimeout(() => {
        b.vx += pushDir * (5 + Math.random() * 8);
        b.vy -= Math.random() * 2.5;
      }, i * 15);
    });

    setTimeout(() => { transitionRef.current = false; }, 1600);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#080812] flex select-none">
      {/* SVG gooey filter */}
      <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <filter id="goo" colorInterpolationFilters="sRGB" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="20" result="blur" />
            <feColorMatrix
              in="blur" mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -13"
              result="goo"
            />
          </filter>
        </defs>
      </svg>

      {/* Static dark background */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#0e0e22] via-[#080812] to-[#080812]" />
      <div className="absolute left-1/2 top-0 bottom-0 w-px z-0 bg-white/[0.04]" />

      {/* Liquid layer — gooey filter container */}
      <div
        ref={liquidRef}
        className="absolute inset-0 z-10 overflow-hidden"
        style={{ filter: "url(#goo)" }}
      >
        {/* Large floor rectangle — fills bulk of the container */}
        <div
          ref={floorRef}
          className="absolute bottom-0"
          style={{
            background: `linear-gradient(180deg, ${LIQUID_COLOR} 0%, ${LIQUID_DARK} 100%)`,
            borderRadius: "36px 36px 0 0",
          }}
        />
        {/* Balls sit at waterline and create organic surface — rendered by spawnBalls */}
      </div>

      {/* Soft glow behind liquid */}
      <div
        className="absolute inset-0 z-[11] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 45% 55% at 25% 100%, rgba(99,102,241,0.22) 0%, transparent 65%)",
        }}
      />

      {/* Forms layer */}
      <div className="relative z-20 flex w-full h-full">
        {/* LOGIN */}
        <div className="flex-1 flex flex-col items-center justify-center px-10 py-12">
          <div className={`w-full max-w-sm transition-all duration-500 ${mode === "login" ? "opacity-100 translate-y-0" : "opacity-20 translate-y-2 pointer-events-none"}`}>
            <div className="mb-8 text-center">
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 border border-white/10"
                style={{ background: "rgba(30,27,75,0.65)", boxShadow: "0 8px 32px rgba(99,102,241,0.25)", backdropFilter: "blur(16px)" }}
              >
                <svg className="w-7 h-7 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Bem-vindo</h1>
              <p className="text-indigo-200/50 mt-1 text-sm">Entre na sua conta para continuar</p>
            </div>

            <form className="space-y-4 pointer-events-auto" onSubmit={(e) => e.preventDefault()}>
              {[
                { label: "E-mail", name: "email", type: "email", placeholder: "seu@email.com", auto: "email" },
                { label: "Senha", name: "password", type: "password", placeholder: "••••••••", auto: "current-password" },
              ].map((f) => (
                <div key={f.name}>
                  <label className="block text-[10px] font-bold text-indigo-200/50 mb-1.5 uppercase tracking-[0.15em]">{f.label}</label>
                  <input
                    type={f.type} name={f.name}
                    value={formData[f.name as keyof typeof formData]}
                    onChange={handleInput} placeholder={f.placeholder} autoComplete={f.auto}
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-indigo-200/25 text-sm outline-none transition-all"
                    style={{ background: "rgba(15,12,40,0.6)", border: "1px solid rgba(99,102,241,0.2)", backdropFilter: "blur(14px)" }}
                  />
                </div>
              ))}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-indigo-200/40 cursor-pointer">
                  <input type="checkbox" className="accent-indigo-500" /> Lembrar de mim
                </label>
                <button type="button" className="text-indigo-300/60 hover:text-indigo-200 transition-colors">Esqueci a senha</button>
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
                style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)", boxShadow: "0 8px 28px rgba(99,102,241,0.45)" }}
              >
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

        {/* REGISTER */}
        <div className="flex-1 flex flex-col items-center justify-center px-10 py-12">
          <div className={`w-full max-w-sm transition-all duration-500 ${mode === "register" ? "opacity-100 translate-y-0" : "opacity-20 translate-y-2 pointer-events-none"}`}>
            <div className="mb-6 text-center">
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 border border-white/10"
                style={{ background: "rgba(15,23,42,0.65)", boxShadow: "0 8px 32px rgba(59,130,246,0.2)", backdropFilter: "blur(16px)" }}
              >
                <svg className="w-7 h-7 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Criar Conta</h1>
              <p className="text-blue-200/50 mt-1 text-sm">Preencha para começar agora</p>
            </div>

            <form className="space-y-3 pointer-events-auto" onSubmit={(e) => e.preventDefault()}>
              {[
                { label: "Nome completo", name: "name", type: "text", placeholder: "Seu nome", auto: "name" },
                { label: "E-mail", name: "email", type: "email", placeholder: "seu@email.com", auto: "email" },
                { label: "Senha", name: "password", type: "password", placeholder: "••••••••", auto: "new-password" },
                { label: "Confirmar senha", name: "confirmPassword", type: "password", placeholder: "••••••••", auto: "new-password" },
              ].map((f) => (
                <div key={f.name}>
                  <label className="block text-[10px] font-bold text-blue-200/50 mb-1.5 uppercase tracking-[0.15em]">{f.label}</label>
                  <input
                    type={f.type} name={f.name}
                    value={formData[f.name as keyof typeof formData]}
                    onChange={handleInput} placeholder={f.placeholder} autoComplete={f.auto}
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-blue-200/25 text-sm outline-none transition-all"
                    style={{ background: "rgba(10,15,30,0.6)", border: "1px solid rgba(59,130,246,0.2)", backdropFilter: "blur(14px)" }}
                  />
                </div>
              ))}
              <button
                type="submit"
                className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
                style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", boxShadow: "0 8px 28px rgba(59,130,246,0.4)" }}
              >
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

      {/* Mode toggle pills */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-30">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className="px-5 py-2 rounded-full text-xs font-bold transition-all duration-300"
            style={
              mode === m
                ? {
                    background: m === "login" ? "rgba(99,102,241,0.88)" : "rgba(59,130,246,0.88)",
                    color: "#fff",
                    boxShadow: `0 4px 20px ${m === "login" ? "rgba(99,102,241,0.55)" : "rgba(59,130,246,0.5)"}`,
                    border: `1px solid ${m === "login" ? "rgba(165,163,255,0.3)" : "rgba(147,197,253,0.3)"}`,
                  }
                : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }
            }
          >
            {m === "login" ? "Login" : "Cadastro"}
          </button>
        ))}
      </div>
    </div>
  );
}
