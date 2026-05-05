"use client";

import { useEffect, useRef, useState } from "react";
import {
  useActiveAccount,
  useActiveWallet,
  useDisconnect,
  useProfiles,
} from "thirdweb/react";
import { client } from "@/lib/client";
import { Layout } from "@/components/layout/layout";
import { useRouter } from "next/navigation";
import Link from "next/link";

const PROFILE_META: Record<string, { label: string; icon: string }> = {
  google: { label: "Google", icon: "G" },
  email: { label: "Email", icon: "@" },
  github: { label: "GitHub", icon: "◉" },
  passkey: { label: "Passkey", icon: "🔑" },
  apple: { label: "Apple", icon: "🍎" },
  phone: { label: "Phone", icon: "📱" },
  discord: { label: "Discord", icon: "D" },
  farcaster: { label: "Farcaster", icon: "⌘" },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
        copied
          ? "bg-ok-wash text-ok-ink border-ok-rim"
          : "bg-tint text-tint-ink border-tint-rim hover:bg-brand hover:text-brand-on hover:border-brand"
      }`}
    >
      {copied ? "✓ Copied" : "Copy address"}
    </button>
  );
}

function SignOutModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = () => {
    setLoading(true);
    onConfirm();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-surface rounded-2xl border border-line p-8 w-full max-w-sm shadow-2xl mx-4">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-err-wash border border-err-rim flex items-center justify-center text-2xl mx-auto mb-4">
            👋
          </div>
          <h2 className="text-xl font-bold text-ink mb-2">Sign out?</h2>
          <p className="text-ink-dim text-sm leading-relaxed">
            You&apos;ll need to sign in again to access your wallet. Make sure
            you remember your login method.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-danger text-white font-bold text-sm hover:bg-danger-hi transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Signing out…
              </>
            ) : (
              "Sign out"
            )}
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 rounded-xl bg-layer border border-line text-ink-dim font-semibold text-sm hover:text-ink transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const IFRAME_ORIGIN = "https://embedded-wallet.thirdweb.com";

function PrivateKeyExport() {
  const wallet = useActiveWallet();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  const theme =
    typeof window !== "undefined" && localStorage.getItem("theme") === "dark"
      ? "dark"
      : "light";

  const iframeSrc = `${IFRAME_ORIGIN}/sdk/2022-08-12/embedded-wallet/export-private-key?clientId=${client.clientId}&theme=${theme}`;

  useEffect(() => {
    if (!revealed) return;

    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== IFRAME_ORIGIN) return;
      if (typeof e.data !== "object" || !("eventType" in e.data)) return;
      if (e.data.eventType !== "exportPrivateKeyIframeLoaded") return;

      // wallet.getAuthToken() is a public API on InAppWallet
      const authToken = (
        wallet as { getAuthToken?: () => string | null }
      )?.getAuthToken?.();
      if (!authToken || !iframeRef.current?.contentWindow) return;

      iframeRef.current.contentWindow.postMessage(
        { authToken, eventType: "initExportPrivateKey" },
        IFRAME_ORIGIN
      );
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [revealed, wallet]);

  if (!revealed) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3 p-4 rounded-xl bg-err-wash border border-err-rim">
          <span className="shrink-0">⚠️</span>
          <p className="text-sm text-err-ink leading-relaxed">
            Your private key grants full access to your wallet. Never share it
            with anyone, including Tango support.
          </p>
        </div>
        <button
          onClick={() => {
            setRevealed(true);
            setIframeLoading(true);
          }}
          className="w-full py-3 rounded-xl bg-layer border border-line text-ink text-sm font-semibold hover:border-brand hover:text-brand transition-colors"
        >
          🔑 Reveal private key
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 p-4 rounded-xl bg-err-wash border border-err-rim">
        <span className="shrink-0">⚠️</span>
        <p className="text-sm text-err-ink font-semibold leading-relaxed">
          Never share this key with anyone.
        </p>
      </div>
      <div
        className="relative rounded-xl border border-line overflow-hidden bg-layer"
        style={{ height: 260 }}
      >
        {iframeLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-layer z-10">
            <span className="w-6 h-6 rounded-full border-2 border-line border-t-brand animate-spin" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="Export Private Key"
          allow="clipboard-read; clipboard-write"
          onLoad={() => setIframeLoading(false)}
          className="w-full h-full border-none"
          style={{
            height: 300,
            visibility: iframeLoading ? "hidden" : "visible",
          }}
        />
      </div>
      <button
        onClick={() => setRevealed(false)}
        className="w-full py-3 rounded-xl bg-layer border border-line text-ink-dim text-sm font-semibold hover:text-ink transition-colors"
      >
        🔒 Hide
      </button>
    </div>
  );
}

export function ProfileClient() {
  const account = useActiveAccount();
  const { data: profiles } = useProfiles({ client });
  const { disconnect } = useDisconnect();
  const wallet = useActiveWallet();
  const router = useRouter();
  const [showSignOut, setShowSignOut] = useState(false);

  const handleSignOut = () => {
    if (wallet) disconnect(wallet);
    router.push("/");
  };

  const address = account?.address ?? "";
  const abbr = address.length > 2 ? address.slice(2, 4).toUpperCase() : "0X";
  const shortAddress = address
    ? `${address.slice(0, 10)}…${address.slice(-6)}`
    : "";

  const primaryProfile = profiles?.[0];
  const profileMeta = primaryProfile
    ? PROFILE_META[primaryProfile.type] ?? {
        label: primaryProfile.type,
        icon: "●",
      }
    : null;

  if (!account) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <h1 className="text-2xl font-bold text-ink">Not signed in</h1>
          <p className="text-ink-dim">Sign in to view your profile.</p>
          <Link
            href="/"
            className="text-sm font-semibold text-tint-ink underline underline-offset-2"
          >
            Back to home
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-5">
          <div
            className="shrink-0 rounded-2xl flex items-center justify-center text-2xl font-bold text-white"
            style={{
              width: 72,
              height: 72,
              background: "linear-gradient(135deg, #7c3aed, #4c1d95)",
              boxShadow: "0 8px 24px rgba(109,40,217,0.35)",
            }}
          >
            {abbr}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink">My Wallet</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="font-mono text-sm text-ink-dim">
                {shortAddress}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-ok-wash border border-ok-rim text-ok-ink text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-ok-ink" />
                Connected
              </span>
            </div>
          </div>
        </div>

        {/* Wallet Address */}
        <div className="bg-surface rounded-2xl border border-line overflow-hidden">
          <div className="px-6 py-5 border-b border-line bg-layer">
            <p className="font-bold text-ink">Wallet Address</p>
            <p className="text-xs text-ink-faint mt-0.5">
              Your public address — safe to share
            </p>
          </div>
          <div className="px-6 py-5">
            <p className="font-mono text-sm text-ink leading-relaxed bg-layer rounded-xl px-4 py-3 border border-line break-all mb-4">
              {address}
            </p>
            <div className="flex flex-wrap gap-3">
              <CopyButton text={address} />
              <Link
                href="/receive"
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-layer border border-line text-ink-dim hover:text-ink hover:border-line-hi transition-colors"
              >
                Show QR ↗
              </Link>
            </div>
          </div>
        </div>

        {/* Login Method */}
        {profileMeta && (
          <div className="bg-surface rounded-2xl border border-line overflow-hidden">
            <div className="px-6 py-5 border-b border-line bg-layer">
              <p className="font-bold text-ink">Login Method</p>
              <p className="text-xs text-ink-faint mt-0.5">
                How you sign in to Tango
              </p>
            </div>
            <div className="px-6 py-5 flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold text-white shrink-0"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #4c1d95)",
                }}
              >
                {profileMeta.icon}
              </div>
              <div>
                <p className="font-semibold text-ink text-sm">
                  Connected via {profileMeta.label}
                </p>
                {primaryProfile?.details?.email && (
                  <p className="text-xs text-ink-faint mt-0.5">
                    {primaryProfile.details.email}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Private Key */}
        <div className="bg-surface rounded-2xl border border-line overflow-hidden">
          <div className="px-6 py-5 border-b border-line bg-layer flex items-center justify-between">
            <div>
              <p className="font-bold text-ink">Private Key</p>
              <p className="text-xs text-ink-faint mt-0.5">
                Handle with care — never share
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-tint flex items-center justify-center text-base">
              🔒
            </div>
          </div>
          <div className="px-6 py-5">
            <PrivateKeyExport />
          </div>
        </div>

        {/* Account / Sign Out */}
        <div className="bg-surface rounded-2xl border border-line overflow-hidden">
          <div className="px-6 py-5 border-b border-line bg-layer">
            <p className="font-bold text-ink">Account</p>
            <p className="text-xs text-ink-faint mt-0.5">Manage your session</p>
          </div>
          <div className="px-6 py-5">
            <div className="flex items-center justify-between p-4 rounded-xl border border-danger/20 bg-danger/5">
              <div>
                <p className="font-semibold text-ink text-sm">Sign out</p>
                <p className="text-xs text-ink-faint mt-0.5">
                  Disconnect this wallet from the app
                </p>
              </div>
              <button
                onClick={() => setShowSignOut(true)}
                className="px-5 py-2 rounded-xl bg-danger text-white text-sm font-bold hover:bg-danger-hi transition-colors shrink-0"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      {showSignOut && (
        <SignOutModal
          onConfirm={handleSignOut}
          onCancel={() => setShowSignOut(false)}
        />
      )}
    </Layout>
  );
}
