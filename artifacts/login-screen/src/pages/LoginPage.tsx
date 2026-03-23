import { useEffect, useRef, useState } from "react";

const NUM_BALLS = 20;
const GRAVITY = 0.48;
const BOUNCE = 0.01;
const FRICTION = 0.80;
const R_MIN = 50;
const R_MAX = 70;

const FLOOR_RATIO = 0.70;
const STREAM_H = 62;
// Single speed drives EVERYTHING: floor, stream, walls, balls — perfectly in sync
const WALL_SPEED = 0.007;

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
  const liquidRef  = useRef<HTMLDivElement>(null);
  const floorLRef  = useRef<HTMLDivElement>(null);
  const floorRRef  = useRef<HTMLDivElement>(null);
  const streamRef  = useRef<HTMLDivElement>(null);
  const ballsRef   = useRef<Ball[]>([]);
  const frameRef   = useRef<number>(0);

  // wallProgress: 0 = fully login/left, 1 = fully register/right.
  // ALL visuals (floors, stream, walls, ball restY) are derived from this single value.
  const wallProgress = useRef(0);
  const wallTarget   = useRef(0);
  const isMoving     = useRef(false);

  const modeRef = useRef<"login" | "register">("login");
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

    const fullH   = () => H * FLOOR_RATIO;
    const half    = () => W / 2;

    // --- Init ---
    wallProgress.current = 0;
    wallTarget.current = 0;
    isMoving.current = false;

    // --- Spawn surface balls on left waterline ---
    const balls: Ball[] = [];
    {
      const spacing = half() / (NUM_BALLS + 1);
      for (let i = 0; i < NUM_BALLS; i++) {
        const r = R_MIN + Math.random() * (R_MAX - R_MIN);
        const x = spacing * (i + 1) + (Math.random() - 0.5) * spacing * 0.4;
        const y = H - fullH() + r * 0.14;
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
    }
    ballsRef.current = balls;

    // --- Ball–ball repulsion ---
    const repulse = () => {
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i], b = balls[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          const minD = (a.r + b.r) * 0.86;
          if (d2 < minD * minD && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const ov = (minD - d) * 0.36 / d;
            a.x -= dx * ov; a.y -= dy * ov;
            b.x += dx * ov; b.y += dy * ov;
            const nx = dx / d, ny = dy / d;
            const relV = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (relV < 0) {
              const imp = relV * 0.06;
              a.vx += imp * nx; a.vy += imp * ny;
              b.vx -= imp * nx; b.vy -= imp * ny;
            }
          }
        }
      }
    };

    // --- All visuals computed from wallProgress ---
    // t=0: login (left), t=1: register (right)

    const getFloors = (t: number) => ({
      leftH:  fullH() * (1 - t),   // drains from fullH → 0
      rightH: fullH() * t,          // fills  from 0 → fullH
    });

    // Stream: expands to full width at t=0.5, contracts to destination side
    const getStream = (t: number) => ({
      left:  Math.max(0, W * (t - 0.5)),
      width: W / 2 + W * Math.min(t, 1 - t),
    });

    // Per-ball surface Y derived entirely from t (same formula as floors)
    const getRestY = (bx: number, t: number): number => {
      const h = half();
      const { leftH, rightH } = getFloors(t);
      const floorH   = bx < h ? leftH : rightH;
      const waterline = H - floorH;          // Y of liquid surface for this side
      const streamTop = H - STREAM_H;        // Y of stream top
      return Math.min(waterline, streamTop); // ball can't go below stream
    };

    // --- Main update ---
    const update = () => {
      const h = half();

      // 1. Advance wallProgress at constant speed toward target
      if (isMoving.current) {
        const dir = wallTarget.current > wallProgress.current ? 1 : -1;
        wallProgress.current += dir * WALL_SPEED;
        if (dir > 0 && wallProgress.current >= wallTarget.current) {
          wallProgress.current = wallTarget.current;
          isMoving.current = false;
        } else if (dir < 0 && wallProgress.current <= wallTarget.current) {
          wallProgress.current = wallTarget.current;
          isMoving.current = false;
        }
      }

      const t = wallProgress.current;

      // 2. Floors — directly from t, perfectly in sync with walls & balls
      const { leftH, rightH } = getFloors(t);
      floorL.style.height = leftH  + "px";
      floorR.style.height = rightH + "px";

      // 3. Stream — expands to full width at midpoint, contracts to destination
      const { left: sLeft, width: sWidth } = getStream(t);
      stream.style.left  = sLeft  + "px";
      stream.style.width = sWidth + "px";

      // 4. Walls — sweep from left to right as t goes 0→1
      const wallL = h * t;       // left  boundary: 0 → W/2
      const wallR = h + h * t;   // right boundary: W/2 → W

      // 5. Physics — surface balls follow the same t-derived waterline
      for (const b of balls) {
        // Continuous pull toward target center so balls flow with the wall
        if (isMoving.current) {
          const cx = wallTarget.current === 1 ? W * 0.75 : W * 0.25;
          b.vx += (cx - b.x) * 0.006;
        }

        b.vy += GRAVITY;
        b.x  += b.vx;
        b.y  += b.vy;
        b.vx *= FRICTION;
        b.vy *= FRICTION;

        if (Math.abs(b.vx) < 0.03) b.vx = 0;
        if (Math.abs(b.vy) < 0.03) b.vy = 0;

        // Sliding walls push balls continuously — no snap
        if (b.x - b.r < wallL) { b.x = wallL + b.r; b.vx = Math.abs(b.vx) * BOUNCE; }
        else if (b.x + b.r > wallR) { b.x = wallR - b.r; b.vx = -Math.abs(b.vx) * BOUNCE; }

        // Surface: same formula as floor DOM elements → always in sync
        const restY = getRestY(b.x, t) + b.r * 0.14;
        if (b.y > restY) {
          b.y  = restY;
          b.vy = -Math.abs(b.vy) * BOUNCE;
          b.vx *= 0.75;
        }

        if (b.y - b.r < -20) { b.y = b.r - 20; b.vy = Math.abs(b.vy) * BOUNCE; }
      }

      repulse();

      for (const b of balls) {
        b.el.style.left = (b.x - b.r) + "px";
        b.el.style.top  = (b.y - b.r) + "px";
      }
    };

    const loop = () => { update(); frameRef.current = requestAnimationFrame(loop); };
    frameRef.current = requestAnimationFrame(loop);

    const onResize = () => {
      W = container.offsetWidth;
      H = container.offsetHeight;
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      balls.forEach((b) => b.el.remove());
    };
  }, []);

  const switchMode = (newMode: "login" | "register") => {
    if (newMode === modeRef.current || isMoving.current) return;
    modeRef.current = newMode;
    setMode(newMode);

    // Everything is derived from wallProgress — just set the target and let it run
    wallTarget.current = newMode === "register" ? 1 : 0;
    isMoving.current = true;

    // Small initial impulse to kick the physics alive
    const dir = newMode === "register" ? 1 : -1;
    ballsRef.current.forEach((b, i) => {
      setTimeout(() => {
        b.vx += dir * (2 + Math.random() * 3);
        b.vy += 1 + Math.random() * 1.5;
      }, i * 20);
    });
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
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -13" />
          </filter>
        </defs>
      </svg>

      {/* Background */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#0e0e22] via-[#080812] to-[#080812]" />
      <div className="absolute left-1/2 top-0 bottom-0 w-px z-0 bg-white/[0.04]" />

      {/* Liquid layer — all inside gooey filter */}
      <div ref={liquidRef} className="absolute inset-0 z-10 overflow-hidden"
        style={{ filter: "url(#goo)" }}>

        {/* Left floor — shrinks from top as it drains */}
        <div ref={floorLRef} className="absolute bottom-0 left-0"
          style={{ width: "50%", borderRadius: "32px 32px 0 0",
            background: `linear-gradient(180deg,${LIQUID} 0%,${LIQUID_DARK} 100%)` }} />

        {/* Right floor — grows from bottom as it fills */}
        <div ref={floorRRef} className="absolute bottom-0 right-0"
          style={{ width: "50%", height: "0px", borderRadius: "32px 32px 0 0",
            background: `linear-gradient(180deg,${LIQUID} 0%,${LIQUID_DARK} 100%)` }} />

        {/* Bottom stream — the "hole" connecting both sides */}
        <div ref={streamRef} className="absolute bottom-0"
          style={{ height: `${STREAM_H}px`, background: LIQUID_DARK }} />
      </div>

      {/* Soft ambient glow */}
      <div className="absolute inset-0 z-[11] pointer-events-none"
        style={{ background: "radial-gradient(ellipse 45% 55% at 25% 100%, rgba(99,102,241,0.16) 0%, transparent 65%)" }} />

      {/* Forms */}
      <div className="relative z-20 flex w-full h-full">

        {/* LOGIN SIDE */}
        <div className="flex-1 flex flex-col items-center justify-center px-10 py-12">

          {/* Active: full login form */}
          <div className={`w-full max-w-sm transition-all duration-500 absolute ${mode === "login" ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-3 pointer-events-none"}`}>
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
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              {[
                { label: "E-mail", name: "email", type: "email", placeholder: "seu@email.com", auto: "email" },
                { label: "Senha", name: "password", type: "password", placeholder: "••••••••", auto: "current-password" },
              ].map((f) => (
                <div key={f.name}>
                  <label className="block text-[10px] font-bold text-indigo-200/50 mb-1.5 uppercase tracking-[0.15em]">{f.label}</label>
                  <input type={f.type} name={f.name} value={formData[f.name as keyof typeof formData]}
                    onChange={handleInput} placeholder={f.placeholder} autoComplete={f.auto}
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-indigo-200/25 text-sm outline-none"
                    style={{ background: "rgba(15,12,40,0.6)", border: "1px solid rgba(99,102,241,0.2)", backdropFilter: "blur(14px)" }} />
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
            <p className="text-center text-xs text-indigo-200/30 mt-6">
              Não tem conta?{" "}
              <button onClick={() => switchMode("register")} className="text-indigo-300/70 hover:text-indigo-200 font-semibold transition-colors">Cadastre-se</button>
            </p>
          </div>

          {/* Inactive: invite message */}
          <div className={`text-center transition-all duration-500 ${mode === "register" ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-3 pointer-events-none"}`}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/25 mb-4">Já tem conta?</p>
            <h2 className="text-4xl font-bold text-white/80 mb-3 leading-tight">Bem-vindo<br/>de volta</h2>
            <p className="text-white/30 text-sm mb-8">Entre para acessar sua conta</p>
            <button onClick={() => switchMode("login")}
              className="px-8 py-3 rounded-full text-sm font-semibold border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-all"
              style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(12px)" }}>
              Entrar agora
            </button>
          </div>
        </div>

        {/* REGISTER SIDE */}
        <div className="flex-1 flex flex-col items-center justify-center px-10 py-12">

          {/* Inactive: invite message */}
          <div className={`text-center transition-all duration-500 ${mode === "login" ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-3 pointer-events-none"}`}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/25 mb-4">Novo por aqui?</p>
            <h2 className="text-4xl font-bold text-white/80 mb-3 leading-tight">Cadastre-se<br/>aqui</h2>
            <p className="text-white/30 text-sm mb-8">Crie sua conta em poucos passos</p>
            <button onClick={() => switchMode("register")}
              className="px-8 py-3 rounded-full text-sm font-semibold border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-all"
              style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(12px)" }}>
              Criar conta
            </button>
          </div>

          {/* Active: full register form */}
          <div className={`w-full max-w-sm transition-all duration-500 absolute ${mode === "register" ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-3 pointer-events-none"}`}>
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
                  <input type={f.type} name={f.name} value={formData[f.name as keyof typeof formData]}
                    onChange={handleInput} placeholder={f.placeholder} autoComplete={f.auto}
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-blue-200/25 text-sm outline-none"
                    style={{ background: "rgba(10,15,30,0.6)", border: "1px solid rgba(59,130,246,0.2)", backdropFilter: "blur(14px)" }} />
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

      {/* Toggle pills */}
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
