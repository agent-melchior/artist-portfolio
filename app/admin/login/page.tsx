"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const retryAfterMs = typeof result.retryAfterMs === "number" ? result.retryAfterMs : 0;
        if (retryAfterMs > 0) {
          setError(`Login blocked for ${Math.ceil(retryAfterMs / 1000)}s`);
          return;
        }
        setError(typeof result.error === "string" ? result.error : "Login failed");
        return;
      }
      router.push("/admin");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login">
      <form className="panel" onSubmit={submit}>
        <h2>Admin</h2>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
        </label>
        <button type="submit" disabled={loading || !password.trim()}>{loading ? "Signing in..." : "Enter"}</button>
        {error && <p className="adminAlert isError">{error}</p>}
      </form>
    </main>
  );
}
