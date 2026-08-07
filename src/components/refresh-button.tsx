"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Força um novo request ao servidor (e portanto uma nova busca no Supabase)
 * pra a rota atual, sem exigir que o usuário mude nenhum filtro. A página é
 * force-dynamic, então o próprio Filtrar já busca dados novos — este botão
 * existe pra dar controle e confiança visual explícitos de que a tela é ao
 * vivo, mesmo sem alterar nenhum filtro.
 */
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="mc-refresh-btn"
      disabled={pending}
      title="Buscar dados mais recentes agora"
      onClick={() => startTransition(() => router.refresh())}
    >
      <span className={`mc-refresh-icon${pending ? " spinning" : ""}`} aria-hidden="true">
        ⟳
      </span>
      {pending ? "Atualizando…" : "Atualizar"}
    </button>
  );
}
