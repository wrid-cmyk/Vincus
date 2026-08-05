"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions/auth";
import "./login.css";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <main className="login-screen">
      <form className="login-card" action={formAction}>
        <div className="login-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/ppcs_icon.png"
            alt=""
            className="login-brand-icon"
          />
          <span className="login-brand-name">Vincus</span>
        </div>
        <p className="login-subtitle">Entre com sua conta WRID</p>

        <label className="login-field">
          <span>Email</span>
          <input type="email" name="email" required autoComplete="email" />
        </label>

        <label className="login-field">
          <span>Senha</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
          />
        </label>

        {state?.error && <p className="login-error">{state.error}</p>}

        <button type="submit" className="login-submit" disabled={pending}>
          {pending ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
