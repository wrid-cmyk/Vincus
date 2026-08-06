"use client";

import { useActionState } from "react";
import { updatePassword } from "@/lib/actions/auth";
import "../login/login.css";

export default function AtualizarSenhaPage() {
  const [state, formAction, pending] = useActionState(
    updatePassword,
    undefined
  );

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
        <p className="login-subtitle">Escolha uma nova senha para sua conta.</p>

        <label className="login-field">
          <span>Nova senha</span>
          <input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </label>

        <label className="login-field">
          <span>Confirmar nova senha</span>
          <input
            type="password"
            name="confirmPassword"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </label>

        {state?.error && <p className="login-error">{state.error}</p>}

        <button type="submit" className="login-submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </main>
  );
}
