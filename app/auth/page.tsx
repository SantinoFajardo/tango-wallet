"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { supabase } from "@/db/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "signin" | "signup";

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
  agree?: string;
  general?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function passwordStrength(pw: string) {
  if (!pw) return { score: 0, label: "", color: "var(--border)" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["Weak", "Weak", "Fair", "Good", "Strong", "Excellent"];
  const colors = [
    "var(--red-accent)",
    "var(--red-accent)",
    "oklch(75% 0.15 60)",
    "oklch(70% 0.15 100)",
    "var(--green-accent)",
    "var(--green-accent)",
  ];
  return { score, label: labels[score], color: colors[score] };
}

async function setupWallet(email: string, displayName?: string) {
  let pk = localStorage.getItem("tango_wallet_pk") as `0x${string}` | null;
  if (!pk) {
    pk = generatePrivateKey();
    localStorage.setItem("tango_wallet_pk", pk);
  }

  const walletAddress = privateKeyToAccount(pk).address.toLowerCase();

  const { error } = await supabase.from("users").upsert(
    {
      email,
      wallet_address: walletAddress,
      display_name: displayName ?? null,
    },
    { onConflict: "email" }
  );

  if (error) throw new Error(`DB error: ${error.message}`);

  fetch("/api/auth/add-to-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  }).catch(() => {});

  return walletAddress;
}

// ─── Decorative floating coins ────────────────────────────────────────────────
// Positions, sizes, and gradients are per-item data — inline styles stay here.

const coins = [
  {
    symbol: "Ξ",
    bg: "linear-gradient(135deg,#627EEA,#4658a8)",
    shadow: "rgba(98,126,234,0.45)",
    size: 76,
    radius: 22,
    rotate: -8,
    top: "14%",
    right: "18%",
    anim: "float 6s ease-in-out infinite",
  },
  {
    symbol: "⬡",
    bg: "linear-gradient(135deg,#8247E5,#5b2da8)",
    shadow: "rgba(130,71,229,0.45)",
    size: 62,
    radius: 18,
    rotate: 12,
    top: "38%",
    left: "14%",
    anim: "float2 8s ease-in-out infinite",
  },
  {
    symbol: "◈",
    bg: "linear-gradient(135deg,#2775CA,#1c5697)",
    shadow: "rgba(39,117,202,0.45)",
    size: 54,
    radius: "50%",
    rotate: 0,
    bottom: "22%",
    left: "24%",
    anim: "float 7s ease-in-out infinite 1s",
  },
  {
    symbol: "₮",
    bg: "linear-gradient(135deg,#26A17B,#19785a)",
    shadow: "rgba(38,161,123,0.45)",
    size: 58,
    radius: 16,
    rotate: -6,
    bottom: "32%",
    right: "14%",
    anim: "float2 9s ease-in-out infinite 2s",
  },
];

const dots = [
  { top: "20%", left: "40%", size: 10, delay: 0 },
  { top: "70%", left: "70%", size: 6, delay: 1 },
  { top: "60%", left: "8%", size: 8, delay: 2 },
  { top: "8%", left: "60%", size: 5, delay: 0.5 },
  { bottom: "8%", left: "52%", size: 7, delay: 1.5 },
];

function FloatingCoins() {
  return (
    <>
      {/* Blobs — complex dynamic oklch backgrounds, keep inline */}
      <div
        style={{
          position: "absolute",
          top: "15%",
          left: "10%",
          width: 260,
          height: 260,
          borderRadius: "50%",
          background: "oklch(85% 0.15 290 / 0.35)",
          filter: "blur(60px)",
          animation: "blob 12s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "15%",
          right: "5%",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "oklch(75% 0.18 320 / 0.28)",
          filter: "blur(70px)",
          animation: "blob 14s ease-in-out infinite reverse",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "45%",
          right: "25%",
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: "oklch(80% 0.18 260 / 0.30)",
          filter: "blur(50px)",
          animation: "blob 10s ease-in-out infinite",
        }}
      />

      {/* Coins — per-item sizes, positions, gradients */}
      {coins.map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: c.top,
            left: c.left,
            right: c.right,
            bottom: c.bottom,
            animation: c.anim,
          }}
        >
          <div
            style={{
              width: c.size,
              height: c.size,
              borderRadius: c.radius,
              background: c.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: c.size * 0.47,
              fontWeight: 700,
              boxShadow: `0 12px 40px ${c.shadow}`,
              transform: `rotate(${c.rotate}deg)`,
            }}
          >
            {c.symbol}
          </div>
        </div>
      ))}

      {/* Dots — per-item sizes and positions */}
      {dots.map((d, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: d.top,
            left: d.left,
            bottom: (d as { bottom?: string }).bottom,
            width: d.size,
            height: d.size,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.4)",
            animation: `float ${5 + i}s ease-in-out infinite ${d.delay}s`,
          }}
        />
      ))}
    </>
  );
}

function GoogleLogo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M17.64 9.2a10.34 10.34 0 0 0-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.8 8.8 0 0 0 2.68-6.62z"
        fill="#4285F4"
      />
      <path
        d="M9 18a8.6 8.6 0 0 0 5.96-2.18l-2.92-2.26a5.4 5.4 0 0 1-8.04-2.84H.92v2.34A9 9 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.96 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.92a9 9 0 0 0 0 8.12l3.04-2.34z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58a4.86 4.86 0 0 1 3.44 1.34l2.58-2.58A8.66 8.66 0 0 0 9 0 9 9 0 0 0 .92 4.94l3.04 2.34A5.4 5.4 0 0 1 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ─── Spinner — dynamic size, keep inline ──────────────────────────────────────

function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `${size > 16 ? 2.5 : 2}px solid var(--border)`,
        borderTopColor: "var(--accent)",
        display: "inline-block",
        animation: "spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

// ─── Reusable class strings ───────────────────────────────────────────────────

const labelCls = "block text-xs font-semibold text-(--text-secondary) mb-1.5";
const fieldErrorCls = "text-xs text-(--red-accent) mt-1";
const accentLinkCls = "text-(--accent) no-underline font-semibold";

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [shake, setShake] = useState(false);

  useEffect(() => {
    document.body.className = dark ? "dark" : "light";
  }, [dark]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setErrors({});
    setPassword("");
    setConfirm("");
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setErrors({ general: error.message });
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    const err: FormErrors = {};
    if (!validEmail(email)) err.email = "Please enter a valid email.";
    if (!password) err.password = "Password is required.";
    if (mode === "signup") {
      if (!name.trim()) err.name = "Please enter your name.";
      if (password.length < 8)
        err.password = "Password must be at least 8 characters.";
      if (password !== confirm) err.confirm = "Passwords don't match.";
      if (!agree) err.agree = "You must accept the terms.";
    }

    if (Object.keys(err).length) {
      setErrors(err);
      triggerShake();
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name } },
        });
        if (error) throw error;
        if (!data.session && !data.user?.confirmed_at) {
          setErrors({
            general:
              "✉️ Check your email to confirm your account, then sign in.",
          });
          setLoading(false);
          return;
        }
        await setupWallet(email, name);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        await setupWallet(email);
      }
      router.replace("/");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      setErrors({ general: msg });
      triggerShake();
      setLoading(false);
    }
  };

  const strength = passwordStrength(password);
  const isBusy = googleLoading || loading;

  return (
    <div className="grid grid-cols-2 min-h-screen bg-(--bg) font-sans max-h-screen">
      {/* ── LEFT: Brand panel ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden flex flex-col p-10 text-white bg-[linear-gradient(160deg,var(--violet-700)_0%,var(--violet-900)_100%)]">
        <FloatingCoins />

        {/* Logo */}
        <div className="relative z-2 flex items-center gap-3">
          <div className="w-10 h-10 rounded-[11px] bg-white/16 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl font-bold">
            T
          </div>
          <div>
            <div className="text-base font-bold leading-none">Tango</div>
            <div className="text-[11px] text-white/70 tracking-[0.06em] uppercase">
              Wallet
            </div>
          </div>
        </div>

        {/* Headline */}
        <div className="relative z-2 mt-auto mb-8">
          <h1 className="text-[46px] font-bold leading-[1.05] tracking-[-0.02em] mb-4.5 max-w-115">
            Crypto, without the gas anxiety.
          </h1>
          <p className="text-[17px] text-white/78 leading-relaxed max-w-110">
            Send, receive, and swap across chains. Every transaction's gas is
            covered by Tango — you'll never need ETH for fees again.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mt-7">
            {[
              { label: "Gas-free transactions", icon: "⛽" },
              { label: "Multi-chain", icon: "⇄" },
              { label: "Non-custodial", icon: "🔐" },
            ].map((f) => (
              <div
                key={f.label}
                className="inline-flex items-center gap-1.75 px-3.5 py-1.75 rounded-full bg-white/14 backdrop-blur-[10px] border border-white/18 text-[13px] font-medium"
              >
                <span>{f.icon}</span> {f.label}
              </div>
            ))}
          </div>
        </div>

        {/* Stats footer */}
        <div className="relative z-2 grid grid-cols-3 gap-6 pt-6 border-t border-white/15">
          {[
            { num: "$2.4M", label: "Gas sponsored" },
            { num: "184K", label: "Users onboarded" },
            { num: "12", label: "Chains supported" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-[22px] font-bold leading-none font-mono">
                {s.num}
              </div>
              <div className="text-xs text-white/65 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT: Form panel ─────────────────────────────────────────────── */}
      <div className="flex flex-col px-12 py-10 bg-(--bg-surface)">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-auto">
          <div className="text-[13px] text-(--text-muted)">
            {mode === "signin"
              ? "Don't have an account?"
              : "Already have an account?"}{" "}
            <button
              onClick={() =>
                switchMode(mode === "signin" ? "signup" : "signin")
              }
              className="bg-transparent border-0 cursor-pointer text-(--accent) text-[13px] font-bold p-0"
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </div>
          <button
            onClick={() => setDark(!dark)}
            className="w-8.5 h-8.5 rounded-[10px] bg-(--bg-surface2) border border-(--border) text-(--text-secondary) text-[15px] cursor-pointer flex items-center justify-center"
          >
            {dark ? "☀️" : "🌙"}
          </button>
        </div>

        {/* Form container */}
        <div key={mode} className="fade-up w-full max-w-95 mx-auto py-8">
          <h2 className="text-[28px] font-bold text-(--text-primary) tracking-[-0.01em] mb-1.5">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-sm text-(--text-muted) mb-7 leading-relaxed">
            {mode === "signin"
              ? "Sign in to access your gas-free wallet."
              : "Start sending crypto in under a minute — no gas, no hassle."}
          </p>

          {/* Global error */}
          {errors.general && (
            <div className="mb-4 px-3.5 py-2.5 rounded-[10px] bg-[oklch(62%_0.22_20/0.10)] border border-(--red-accent) text-[13px] text-(--red-accent)">
              {errors.general}
            </div>
          )}

          {/* Google button */}
          <button
            onClick={handleGoogle}
            disabled={isBusy}
            className={`w-full p-3.25 rounded-xl border-[1.5px] border-(--border) bg-(--bg-surface) text-(--text-primary) text-sm font-semibold flex items-center justify-center gap-2.5 transition-all duration-150 hover:border-(--accent) ${
              isBusy ? "opacity-70 cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            {googleLoading ? (
              <>
                <Spinner size={16} />
                Connecting…
              </>
            ) : (
              <>
                <GoogleLogo />
                Continue with Google
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-(--border)" />
            <span className="text-xs text-(--text-muted) font-medium">
              or with email
            </span>
            <div className="flex-1 h-px bg-(--border)" />
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className={`flex flex-col gap-3.5 ${shake ? "shake" : ""}`}
          >
            {/* Name — signup only */}
            {mode === "signup" && (
              <div className="fade-up">
                <label className={labelCls}>Full name</label>
                <input
                  type="text"
                  className={`input-field${errors.name ? " error" : ""}`}
                  placeholder="Jane Cooper"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrors((p) => ({ ...p, name: "" }));
                  }}
                  autoComplete="name"
                />
                {errors.name && (
                  <div className={fieldErrorCls}>{errors.name}</div>
                )}
              </div>
            )}

            {/* Email */}
            <div className="w-full">
              <label className={labelCls}>Email</label>
              <input
                type="email"
                className={`input-field${errors.email ? " error" : ""}`}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((p) => ({ ...p, email: "" }));
                }}
                autoComplete="email"
              />
              {errors.email && (
                <div className={fieldErrorCls}>{errors.email}</div>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-(--text-secondary)">
                  Password
                </label>
                {mode === "signin" && (
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className={`${accentLinkCls} text-xs`}
                  >
                    Forgot?
                  </a>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  className={`input-field pr-11${
                    errors.password ? " error" : ""
                  }`}
                  placeholder={
                    mode === "signup"
                      ? "At least 8 characters"
                      : "Enter your password"
                  }
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((p) => ({ ...p, password: "" }));
                  }}
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  tabIndex={-1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-transparent border-0 text-(--text-muted) text-sm cursor-pointer flex items-center justify-center"
                >
                  {showPw ? "🙈" : "👁"}
                </button>
              </div>
              {errors.password && (
                <div className={fieldErrorCls}>{errors.password}</div>
              )}

              {/* Strength meter — dynamic JS colors stay inline */}
              {mode === "signup" && password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="flex-1 h-0.75 rounded-full transition-colors duration-200"
                        style={{
                          background:
                            i <= strength.score
                              ? strength.color
                              : "var(--border)",
                        }}
                      />
                    ))}
                  </div>
                  <div
                    className="text-[11px] font-semibold"
                    style={{ color: strength.color }}
                  >
                    {strength.label}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm password — signup only */}
            {mode === "signup" && (
              <div className="fade-up">
                <label className={labelCls}>Confirm password</label>
                <input
                  type={showPw ? "text" : "password"}
                  className={`input-field${errors.confirm ? " error" : ""}`}
                  placeholder="Re-enter password"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    setErrors((p) => ({ ...p, confirm: "" }));
                  }}
                  autoComplete="new-password"
                />
                {errors.confirm && (
                  <div className={fieldErrorCls}>{errors.confirm}</div>
                )}
              </div>
            )}

            {/* Remember / Terms */}
            {mode === "signin" ? (
              <label className="flex items-center gap-2 text-[13px] text-(--text-secondary) cursor-pointer select-none mt-1">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-(--accent)"
                />
                Keep me signed in
              </label>
            ) : (
              <div className="fade-up">
                <label className="flex items-start gap-2.25 text-[13px] text-(--text-secondary) cursor-pointer select-none leading-relaxed mt-1">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => {
                      setAgree(e.target.checked);
                      setErrors((p) => ({ ...p, agree: "" }));
                    }}
                    className="w-4 h-4 cursor-pointer mt-0.5 shrink-0 accent-(--accent)"
                  />
                  <span>
                    I agree to Tango's{" "}
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className={accentLinkCls}
                    >
                      Terms
                    </a>{" "}
                    and{" "}
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className={accentLinkCls}
                    >
                      Privacy Policy
                    </a>
                    .
                  </span>
                </label>
                {errors.agree && (
                  <div className={`${fieldErrorCls} pl-[25px]`}>
                    {errors.agree}
                  </div>
                )}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 rounded-xl border-0 text-[15px] font-bold transition-all duration-200 flex items-center justify-center gap-2.5 mt-1.5 ${
                loading
                  ? "bg-(--bg-surface3) text-(--text-muted) cursor-not-allowed shadow-none"
                  : "bg-[linear-gradient(135deg,var(--violet-500),var(--violet-700))] text-white cursor-pointer shadow-[0_4px_16px_oklch(50%_0.28_290/0.28)]"
              }`}
            >
              {loading ? (
                <>
                  <Spinner />
                  {mode === "signin" ? "Signing in…" : "Creating account…"}
                </>
              ) : mode === "signin" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </button>
          </form>

          {/* Info note */}
          <div className="mt-4 px-3 py-2 rounded-lg bg-(--accent-soft) text-[11px] text-(--text-muted) text-center">
            🔐 A non-custodial wallet is created automatically on sign-up
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-6 flex items-center justify-between text-xs text-(--text-muted)">
          <span>© 2026 Tango Wallet</span>
          <div className="flex gap-4">
            {["Help", "Privacy", "Terms"].map((l) => (
              <a
                key={l}
                href="#"
                onClick={(e) => e.preventDefault()}
                className="text-(--text-muted) no-underline"
              >
                {l}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
