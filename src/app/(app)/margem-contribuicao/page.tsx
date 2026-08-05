import { requerPermissao } from "@/lib/dal";

export default async function MargemContribuicaoPage() {
  await requerPermissao("margem_contribuicao");

  return (
    <div>
      <h1>Margem de Contribuição</h1>
      <p style={{ color: "var(--text-muted)" }}>
        Módulo real em construção — próximo passo do roadmap (task #5 no
        board). O protótipo aprovado está em
        vincus_margem_prototipo.html e será portado para esta rota.
      </p>
    </div>
  );
}
