"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      setError("Wrong password");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="login">
      <form className="panel" onSubmit={submit}>
        <h2>Admin</h2>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
        </label>
        <button type="submit">Enter</button>
        {error && <p>{error}</p>}
      </form>
    </main>
  );
}
