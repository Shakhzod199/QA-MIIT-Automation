"use client";

import { useState, useTransition } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await loginAction(username, password);
      if ("success" in result) {
        window.location.href = "/";
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-sm rounded-[14px] border border-surface-border bg-surface-panel p-8">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-[10px] text-[20px] font-bold text-[#06140d]"
            style={{ background: "linear-gradient(135deg,#3ddc97,#1f9d6b)" }}
          >
            Q
          </div>
          <h1 className="text-[18px] font-semibold tracking-[-0.3px] text-q-text">QA Dashboard</h1>
          <p className="mt-1 text-[12.5px] text-q-muted">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-q-muted">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-[9px] border border-surface-border bg-surface-hover px-3 py-2 text-[13px] text-q-text placeholder:text-q-dim focus:outline-none"
              style={{ caretColor: "#3ddc97" }}
              placeholder="Enter username"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-q-muted">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-[9px] border border-surface-border bg-surface-hover px-3 py-2 text-[13px] text-q-text placeholder:text-q-dim focus:outline-none"
              style={{ caretColor: "#3ddc97" }}
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p
              className="rounded-[8px] border px-3 py-2 text-[12.5px]"
              style={{ borderColor: "rgba(255,93,93,0.3)", background: "rgba(255,93,93,0.08)", color: "#ff5d5d" }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-[9px] px-4 py-2.5 text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "#3ddc97", color: "#06140d" }}
          >
            {isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
