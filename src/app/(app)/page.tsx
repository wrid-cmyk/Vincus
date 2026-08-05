import Link from "next/link";
import { getUsuarioAtual, podeVisualizarModulo } from "@/lib/dal";

export default async function HomePage() {
  const usuario = await getUsuarioAtual();

  if (!usuario) {
    return (
      <div className="empty-state">
        <h1>Acesso ainda não configurado</h1>
        <p>
          Seu login foi validado, mas seu usuário ainda não foi cadastrado no
          painel do Vincus. Peça para alguém da Direção liberar seu acesso.
        </p>
      </div>
    );
  }

  const temMargem = await podeVisualizarModulo("margem_contribuicao");

  return (
    <div>
      <h1>Olá, {usuario.nome}</h1>
      <p style={{ color: "var(--text-muted)" }}>
        Papel: {usuario.papelNome ?? "Sem papel definido"}
      </p>

      <div className="module-grid">
        {temMargem ? (
          <Link href="/margem-contribuicao" className="module-card">
            <span>Margem de Contribuição</span>
          </Link>
        ) : (
          <div className="module-card module-card--locked">
            <span>Margem de Contribuição</span>
            <small>Sem acesso — fale com a Direção</small>
          </div>
        )}
      </div>
    </div>
  );
}
