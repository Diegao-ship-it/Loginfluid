import { useEffect, useRef, useState } from "react";

const NUM_BALLS = 20;
const GRAVITY = 0.5;
const BOUNCE = 0.01;
const FRICTION = 0.80;
const R_MIN = 50;
const R_MAX = 70;

const FLOOR_RATIO = 0.70;   // liquid fills 70% of container height
const STREAM_H = 62;        // height of the bottom channel
const LERP_DRAIN = 0.022;   // speed: drain side
const LERP_FILL  = 0.020;   // speed: fill side
const LERP_STREAM = 0.06;   // speed: stream width expansion

const LIQUID = "rgba(99,102,241,1)";
const LIQUID_DARK = "rgba(67,56,202,1)";
const LIQUID_LIGHT = "rgba(148,150,255,1)";

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  el: HTMLDivElement;
}

export default function LoginPage() {
  const liquidRef = useRef<HTMLDivElement>(null);
  const floorLRef = useRef<HTMLDivElement>(null);
  const floorRRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const ballsRef = useRef<Ball[]>([]);
  const frameRef = useRef<number>(0);

  // Animated state (refs so physics loop reads latest)
  const floorLH = useRef(0);          // actual rendered height
  const floorRH = useRef(0);
  const targetLH = useRef(0);         // target heights
  const targetRH = useRef(0);
  const streamLeft = useRef(0);
  const streamW = useRef(0);
  const targetStreamLeft = useRef(0);
  const targetStreamW = useRef(0);

  const modeRef = useRef<"login" | "register">("login");
  const transitionRef = useRef(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [formData, setFormData] = useState({ name: "", email: "", password: "", confirmPassword: "" });

  useEffect(() => {
    const container = liquidRef.current;
    const floorL = floorLRef.current;
    const floorR = floorRRef.current;
    const stream = streamRef.current;
    if (!container || !floorL || !floorR || !stream) return;

    let W = container.offsetWidth;
    let H = container.offsetHeight;

    const fullFloorH = () => H * FLOOR_RATIO;
    const half = () => W / 2;

    // Initial state: login side (left) is full
    floorLH.current = fullFloorH();
    floorRH.current = 0;
    targetLH.current = fullFloorH();
    targetRH.current = 0;

    streamLeft.current = 0;
    streamW.current = half();
    targetStreamLeft.current = 0;
    targetStreamW.current = half();

    // Spawn balls at waterline of left side
    const spawnBalls = (): Ball[] => {
      const balls: Ball[] = [];
      const spacing = half() / (NUM_BALLS + 1);
      for (let i = 0; i < NUM_BALLS; i++) {
        const r = R_MIN + Math.random() * (R_MAX - R_MIN);
        const x = spacing * (i + 1) + (Math.random() - 0.5) * spacing * 0.5;
        const waterlineY = H - floorLH.current;
        const y = waterlineY + r * 0.12;

        const el = document.createElement("div");
        el.style.cssText = `
          position:absolute;border-radius:50%;
          width:${r * 2}px;height:${r * 2}px;
          left:${x - r}px;top:${y - r}px;
          background:radial-gradient(circle at 35% 30%,${LIQUID_LIGHT} 0%,${LIQUID} 50%,${LIQUID_DARK} 100%);
          will-change:left,top;
        `;
        container.appendChild(el);
        balls.push({ x, y, vx: 0, vy: 0, r, el });
      }
      return balls;
    };

    const balls = spawnBalls();
    ballsRef.current = balls;

    // Ball repulsion
    const repulse = () => {
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i], b = balls[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          const minD = (a.r + b.r) * 0.86;
          if (d2 < minD * minD && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const ov = (minD - d) * 0.38 / d;
            a.x -= dx * ov; a.y -= dy * ov;
            b.x += dx * ov; b.y += dy * ov;
            const relV = (b.vx - a.vx) * (dx / d) + (b.vy - a.vy) * (dy / d);
            if (relV < 0) {
              const imp = relV * 0.07;
              const nx = dx / d, ny = dy / d;
              a.vx += imp * nx; a.vy += imp * ny;
              b.vx -= imp * nx; b.vy -= imp * ny;
            }
          }
        }
      }
    };

    // Compute rest Y for a ball at position x, given current floor state
    const getRestY = (x: number): number => {
      const h = half();
      const isLeft = x < h;

      // During transition: balls float in the stream channel
      if (transitionRef.current) {
        return H - STREAM_H + 10;
      }

      if (modeRef.current === "login") {
        const lh = floorLH.current;
        return H - lh;
      } else {
        const rh = floorRH.current;
        return H - rh;
      }
    };

    const update = () => {
      const h = half();

      // --- Lerp floor heights ---
      const prevLH = floorLH.current;
      const prevRH = floorRH.current;

      floorLH.current += (targetLH.current - floorLH.current) * LERP_DRAIN;
      floorRH.current += (targetRH.current - floorRH.current) * LERP_FILL;

      // Clamp
      if (Math.abs(floorLH.current - targetLH.current) < 0.5) floorLH.current = targetLH.current;
      if (Math.abs(floorRH.current - targetRH.current) < 0.5) floorRH.current = targetRH.current;

      // Apply to DOM
      floorL.style.height = floorLH.current + "px";
      floorR.style.height = floorRH.current + "px";

      // --- Lerp stream ---
      streamLeft.current += (targetStreamLeft.current - streamLeft.current) * LERP_STREAM;
      streamW.current += (targetStreamW.current - streamW.current) * LERP_STREAM;
      if (Math.abs(streamLeft.current - targetStreamLeft.current) < 0.5) streamLeft.current = targetStreamLeft.current;
      if (Math.abs(streamW.current - targetStreamW.current) < 0.5) streamW.current = targetStreamW.current;
      stream.style.left = streamLeft.current + "px";
      stream.style.width = streamW.current + "px";

      // --- Walls ---
      let wallL: number, wallR: number;
      if (transitionRef.current) {
        wallL = -80;
        wallR = W + 80;
      } else if (modeRef.current === "login") {
        wallL = 0;
        wallR = h;
      } else {
        wallL = h;
        wallR = W;
      }

      // --- Physics for balls ---
      const restY = getRestY(0); // use center-ish value for current mode

      for (const b of balls) {
        b.vy += GRAVITY;
        b.x += b.vx;
        b.y += b.vy;
        b.vx *= FRICTION;
        b.vy *= FRICTION;

        if (Math.abs(b.vx) < 0.03) b.vx = 0;
        if (Math.abs(b.vy) < 0.03) b.vy = 0;

        // Side walls
        if (b.x - b.r < wallL) { b.x = wallL + b.r; b.vx = Math.abs(b.vx) * BOUNCE; }
        else if (b.x + b.r > wallR) { b.x = wallR - b.r; b.vx = -Math.abs(b.vx) * BOUNCE; }

        // Floor: rest on the liquid surface
        const bRestY = getRestY(b.x) + b.r * 0.15;
        if (b.y > bRestY) {
          b.y = bRestY;
          b.vy = -Math.abs(b.vy) * BOUNCE;
          b.vx *= 0.75;
        }

        // Ceiling
        if (b.y - b.r < -20) { b.y = b.r - 20; b.vy = Math.abs(b.vy) * BOUNCE; }
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
      if (modeRef.current === "login") {
        targetLH.current = fullFloorH();
        targetStreamW.current = half();
      } else {
        targetRH.current = fullFloorH();
        targetStreamLeft.current = half();
        targetStreamW.current = half();
      }
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

    const W = liquidRef.current?.offsetWidth ?? 0;
    const H = liquidRef.current?.offsetHeight ?? 0;
    const fullH = H * FLOOR_RATIO;

    modeRef.current = newMode;
    setMode(newMode);
    transitionRef.current = true;

    const pushDir = newMode === "register" ? 1 : -1;
    const balls = ballsRef.current;

    if (newMode === "register") {
      // === LEFT → RIGHT ===
      // 1. Drain left floor
      targetLH.current = 0;
      // 2. Expand stream to full width immediately (slow lerp handles animation)
      targetStreamLeft.current = 0;
      targetStreamW.current = W;

      // Push balls right + down
      balls.forEach((b, i) => {
        setTimeout(() => {
          b.vx += 4 + Math.random() * 6;
          b.vy += 2 + Math.random() * 3;
        }, i * 30);
      });

      // 3. After drain is mostly done, start filling right
      setTimeout(() => {
        targetRH.current = fullH;
        // Contract stream to right half
        targetStreamLeft.current = W / 2;
        targetStreamW.current = W / 2;
      }, 900);

    } else {
      // === RIGHT → LEFT ===
      targetRH.current = 0;
      targetStreamLeft.current = 0;
      targetStreamW.current = W;

      balls.forEach((b, i) => {
        setTimeout(() => {
          b.vx -= 4 + Math.random() * 6;
          b.vy += 2 + Math.random() * 3;
        }, i * 30);
      });

      setTimeout(() => {
        targetLH.current = fullH;
        targetStreamLeft.current = 0;
        targetStreamW.current = W / 2;
      }, 900);
    }

    // End transition
    setTimeout(() => {
      transitionRef.current = false;
    }, 2000);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#080812] flex select-none">
      {/* SVG gooey filter */}
      <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <filter id="goo" colorInterpolationFilters="sRGB" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="blur" />
            <feColorMatrix in="blur" mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -13"
              result="goo" />
          </filter>
        </defs>
      </svg>

      {/* Background */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#0e0e22] via-[#080812] to-[#080812]" />
      <div className="absolute left-1/2 top-0 bottom-0 w-px z-0 bg-white/[0.04]" />

      {/* Liquid layer */}
      <div ref={liquidRef} className="absolute inset-0 z-10 overflow-hidden" style={{ filter: "url(#goo)" }}>
        {/* Left floor */}
        <div ref={floorLRef} className="absolute bottom-0 left-0"
          style={{
            width: "50%",
            background: `linear-gradient(180deg, ${LIQUID} 0%, ${LIQUID_DARK} 100%)`,
            borderRadius: "32px 32px 0 0",
          }}
        />
        {/* Right floor */}
        <div ref={floorRRef} className="absolute bottom-0 right-0"
          style={{
            width: "50%",
            height: "0px",
            background: `linear-gradient(180deg, ${LIQUID} 0%, ${LIQUID_DARK} 100%)`,
            borderRadius: "32px 32px 0 0",
          }}
        />
        {/* Bottom stream channel — connects both sides during transition */}
        <div ref={streamRef} className="absolute bottom-0"
          style={{
            height: `${STREAM_H}px`,
            background: LIQUID_DARK,
            left: 0,
          }}
        />
      </div>

      {/* Glow */}
      <div className="absolute inset-0 z-[11] pointer-events-none"
        style={{ background: "radial-gradient(ellipse 45% 55% at 25% 100%, rgba(99,102,241,0.18) 0%, transparent 65%)" }}
      />

      {/* Forms */}
      <div className="relative z-20 flex w-full h-full">
        {/* LOGIN */}
        <div className="flex-1 flex flex-col items-center justify-center px-10 py-12">
          <div className={`w-full max-w-sm transition-all duration-500 ${mode === "login" ? "opacity-100 translate-y-0" : "opacity-20 translate-y-2 pointer-events-none"}`}>
            <div className="mb-8 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 border border-white/10"
                style={{ background: "rgba(30,27,75,0.65)", boxShadow: "0 8px 32px rgba(99,102,241,0.25)", backdropFilter: "blur(16px)" }}>
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
                  <input type={f.type} name={f.name}
                    value={formData[f.name as keyof typeof formData]}
                    onChange={handleInput} placeholder={f.placeholder} autoComplete={f.auto}
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-indigo-200/25 text-sm outline-none"
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
              <button type="submit"
                className="w-full py-3 rounded-xl font-semibold text-sm text-white hover:-translate-y-0.5 transition-all"
                style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)", boxShadow: "0 8px 28px rgba(99,102,241,0.45)" }}>
                Entrar
              </button>
            </form>
            <p className="text-center text-xs text-indigo-200/30 mt-6 pointer-events-auto">
              Não tem conta?{" "}
              <button onClick={() => switchMode("register")} className="text-indigo-300/70 hover:text-indigo-200 font-semibold transition-colors">Cadastre-se</button>
            </p>
          </div>
        </div>

        {/* REGISTER */}
        <div className="flex-1 flex flex-col items-center justify-center px-10 py-12">
          <div className={`w-full max-w-sm transition-all duration-500 ${mode === "register" ? "opacity-100 translate-y-0" : "opacity-20 translate-y-2 pointer-events-none"}`}>
            <div className="mb-6 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 border border-white/10"
                style={{ background: "rgba(15,23,42,0.65)", boxShadow: "0 8px 32px rgba(59,130,246,0.2)", backdropFilter: "blur(16px)" }}>
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
                  <input type={f.type} name={f.name}
                    value={formData[f.name as keyof typeof formData]}
                    onChange={handleInput} placeholder={f.placeholder} autoComplete={f.auto}
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-blue-200/25 text-sm outline-none"
                    style={{ background: "rgba(10,15,30,0.6)", border: "1px solid rgba(59,130,246,0.2)", backdropFilter: "blur(14px)" }}
                  />
                </div>
              ))}
              <button type="submit"
                className="w-full py-3 rounded-xl font-semibold text-sm text-white hover:-translate-y-0.5 transition-all"
                style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", boxShadow: "0 8px 28px rgba(59,130,246,0.4)" }}>
                Criar conta
              </button>
            </form>
            <p className="text-center text-xs text-blue-200/30 mt-5 pointer-events-auto">
              Já tem conta?{" "}
              <button onClick={() => switchMode("login")} className="text-blue-300/70 hover:text-blue-200 font-semibold transition-colors">Entrar</button>
            </p>
          </div>
        </div>
      </div>

      {/* Pills */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-30">
        {(["login", "register"] as const).map((m) => (
          <button key={m} onClick={() => switchMode(m)}
            className="px-5 py-2 rounded-full text-xs font-bold transition-all duration-300"
            style={mode === m ? {
              background: m === "login" ? "rgba(99,102,241,0.88)" : "rgba(59,130,246,0.88)",
              color: "#fff",
              boxShadow: `0 4px 20px ${m === "login" ? "rgba(99,102,241,0.55)" : "rgba(59,130,246,0.5)"}`,
              border: `1px solid ${m === "login" ? "rgba(165,163,255,0.3)" : "rgba(147,197,253,0.3)"}`,
            } : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {m === "login" ? "Login" : "Cadastro"}
          </button>
        ))}
      </div>
    </div>
  );
}
