"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/actions/auth";
import "../login/login.css";

export default function EsqueciSenhaPage() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
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

        {state?.success ? (
          <>
            <p className="login-subtitle">Verifique seu email</p>
            <p className="login-success">
              Se esse email tiver uma conta cadastrada, você vai receber um
              link de redefinição de senha em instantes. Confira também a
              caixa de spam.
            </p>
          </>
        ) : (
          <>
            <p className="login-subtitle">
              Informe seu email para receber um link de redefinição de senha.
            </p>

            <label className="login-field">
              <span>Email</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
              />
            </label>

            {state?.error && <p className="login-error">{state.error}</p>}

            <button type="submit" className="login-submit" disabled={pending}>
              {pending ? "Enviando..." : "Enviar link de redefinição"}
            </button>
          </>
        )}

        <Link href="/login" className="login-back-link">
          Voltar para o login
        </Link>
      </form>
    </main>
  );
}
