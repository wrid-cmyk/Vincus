import Link from "next/link";
import { requerPermissao } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import "./margem.css";

export const dynamic = "force-dynamic";

type SearchParams = {
  de?: string;
  ate?: string;
  pagina?: string;
  calculado?: string;
};

const PAGE_SIZE = 50;
const DATA_MINIMA = "2020-01-01";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatarDataInput(data: Date) {
  return data.toISOString().slice(0, 10);
}

function calcularIntervaloPadrao() {
  const fim = new Date();
  const inicio = new Date(fim.getTime() - 3 * 24 * 60 * 60 * 1000);
  return { inicio: formatarDataInput(inicio), fim: formatarDataInput(fim) };
}

function dataValida(valor?: string) {
  return valor && DATE_RE.test(valor) ? valor : undefined;
}

function limiteInicioDia(data: string) {
  return `${data}T00:00:00-03:00`;
}

function limiteFimDia(data: string) {
  return `${data}T23:59:59.999-03:00`;
}

function formatarDataCurta(valor: string) {
  const [ano, mes, dia] = valor.split("-");
  return `${dia}/${mes}/${ano}`;
}

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatarMoeda(valor: unknown) {
  if (valor === null || valor === undefined) return "—";
  const n = Number(valor);
  return Number.isFinite(n) ? formatadorMoeda.format(n) : "—";
}

const formatadorDataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function formatarDataHora(valor: string | null) {
  if (!valor) return "—";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "—" : formatadorDataHora.format(d);
}

function formatarPercentual(valor: unknown) {
  if (valor === null || valor === undefined) return "—";
  const n = Number(valor);
  return Number.isFinite(n) ? `${n.toFixed(2).replace(".", ",")}%` : "—";
}

export default async function MargemContribuicaoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requerPermissao("margem_contribuicao");

  const params = await searchParams;
  const padrao = calcularIntervaloPadrao();
  const usandoFiltroPersonalizado = Boolean(
    dataValida(params.de) || dataValida(params.ate)
  );

  let dataInicio = dataValida(params.de) ?? padrao.inicio;
  let dataFim = dataValida(params.ate) ?? padrao.fim;
  if (dataInicio > dataFim) {
    [dataInicio, dataFim] = [dataFim, dataInicio];
  }

  const somenteCalculado = params.calculado === "1";
  const paginaAtual = Math.max(1, Math.floor(Number(params.pagina)) || 1);
  const from = (paginaAtual - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  function construirHref(pagina: number) {
    const sp = new URLSearchParams();
    if (usandoFiltroPersonalizado) {
      sp.set("de", dataInicio);
      sp.set("ate", dataFim);
    }
    if (somenteCalculado) sp.set("calculado", "1");
    if (pagina > 1) sp.set("pagina", String(pagina));
    const qs = sp.toString();
    return qs ? `/margem-contribuicao?${qs}` : "/margem-contribuicao";
  }

  const supabase = await createClient();

  let query = supabase
    .schema("vendas")
    .from("pedidos")
    .select(
      "id, id_pedido_marketplace, numero_bling, canal_venda, id_cliente, data_venda, valor_total_pedido, total_cmv, lucro_liquido, margem_lucro_percentual, rollup_calculado_em",
      { count: "exact" }
    )
    .gte("data_venda", DATA_MINIMA)
    .gte("data_venda", limiteInicioDia(dataInicio))
    .lte("data_venda", limiteFimDia(dataFim))
    .order("data_venda", { ascending: false })
    .order("id", { ascending: true })
    .range(from, to);

  if (somenteCalculado) {
    query = query.not("rollup_calculado_em", "is", null);
  }

  const [{ data: pedidos, count, error }, { count: totalPendentes }] =
    await Promise.all([
      query,
      supabase
        .schema("vendas")
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .gte("data_venda", DATA_MINIMA)
        .gte("data_venda", limiteInicioDia(dataInicio))
        .lte("data_venda", limiteFimDia(dataFim))
        .is("rollup_calculado_em", null),
    ]);

  if (error) {
    console.error("Erro ao buscar pedidos (margem de contribuição):", error);
    return (
      <div>
        <div className="mc-header">
          <h1>Margem de Contribuição</h1>
        </div>
        <p className="mc-erro">
          Não foi possível carregar os pedidos agora. Tente novamente em
          instantes.
        </p>
      </div>
    );
  }

  const idsClientes = Array.from(
    new Set((pedidos ?? []).map((p) => p.id_cliente).filter(Boolean))
  );

  let nomesClientes: Record<string, string> = {};
  if (idsClientes.length > 0) {
    const { data: clientes } = await supabase
      .from("clientes")
      .select("id, nome")
      .in("id", idsClientes as string[]);
    nomesClientes = Object.fromEntries(
      (clientes ?? []).map((c) => [c.id as string, c.nome as string])
    );
  }

  const totalRegistros = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / PAGE_SIZE));
  const hojeStr = formatarDataInput(new Date());

  return (
    <div>
      <div className="mc-header">
        <h1>Margem de Contribuição</h1>
        <p className="mc-resumo">
          {usandoFiltroPersonalizado
            ? `Período: ${formatarDataCurta(dataInicio)} a ${formatarDataCurta(dataFim)}`
            : "Últimos 3 dias (padrão)"}
          {" · "}
          {totalRegistros} pedido{totalRegistros === 1 ? "" : "s"} no período
          {" · "}
          {totalPendentes ?? 0} pendente{(totalPendentes ?? 0) === 1 ? "" : "s"} de
          cálculo
        </p>
      </div>

      <form method="GET" className="mc-filtros">
        <div className="mc-campo">
          <label htmlFor="de">De</label>
          <input
            type="date"
            id="de"
            name="de"
            defaultValue={dataInicio}
            max={hojeStr}
          />
        </div>
        <div className="mc-campo">
          <label htmlFor="ate">Até</label>
          <input
            type="date"
            id="ate"
            name="ate"
            defaultValue={dataFim}
            max={hojeStr}
          />
        </div>
        <label className="mc-checkbox">
          <input
            type="checkbox"
            name="calculado"
            value="1"
            defaultChecked={somenteCalculado}
          />
          Somente pedidos com margem calculada
        </label>
        <button type="submit" className="mc-botao">
          Filtrar
        </button>
        {usandoFiltroPersonalizado || somenteCalculado ? (
          <Link href="/margem-contribuicao" className="mc-limpar">
            Limpar filtro
          </Link>
        ) : null}
      </form>

      {!pedidos || pedidos.length === 0 ? (
        <div className="mc-vazio">Nenhum pedido encontrado no período.</div>
      ) : (
        <div className="mc-tabela-wrap">
          <table className="mc-tabela">
            <thead>
              <tr>
                <th>Data da venda</th>
                <th>Pedido</th>
                <th>Canal</th>
                <th>Cliente</th>
                <th className="mc-num">Total do pedido</th>
                <th className="mc-num">CMV</th>
                <th className="mc-num">Lucro líquido</th>
                <th className="mc-num">Margem</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((pedido) => {
                const calculado = pedido.rollup_calculado_em !== null;
                return (
                  <tr key={pedido.id}>
                    <td>{formatarDataHora(pedido.data_venda)}</td>
                    <td>
                      {pedido.id_pedido_marketplace ??
                        pedido.numero_bling ??
                        pedido.id.slice(0, 8)}
                    </td>
                    <td>{pedido.canal_venda ?? "—"}</td>
                    <td>
                      {pedido.id_cliente
                        ? (nomesClientes[pedido.id_cliente] ?? "—")
                        : "—"}
                    </td>
                    <td className="mc-num">
                      {formatarMoeda(pedido.valor_total_pedido)}
                    </td>
                    <td className="mc-num">
                      {calculado ? formatarMoeda(pedido.total_cmv) : "—"}
                    </td>
                    <td className="mc-num">
                      {calculado ? formatarMoeda(pedido.lucro_liquido) : "—"}
                    </td>
                    <td className="mc-num">
                      {calculado
                        ? formatarPercentual(pedido.margem_lucro_percentual)
                        : "—"}
                    </td>
                    <td>
                      {calculado ? (
                        <span className="mc-badge mc-badge--ok">
                          Calculado
                        </span>
                      ) : (
                        <span className="mc-badge mc-badge--pendente">
                          Pendente
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mc-paginacao">
        {paginaAtual <= 1 ? (
          <span className="mc-pagina-link mc-pagina-link--desabilitado">
            ← Anterior
          </span>
        ) : (
          <Link href={construirHref(paginaAtual - 1)} className="mc-pagina-link">
            ← Anterior
          </Link>
        )}
        <span>
          Página {paginaAtual} de {totalPaginas}
        </span>
        {paginaAtual >= totalPaginas ? (
          <span className="mc-pagina-link mc-pagina-link--desabilitado">
            Próxima →
          </span>
        ) : (
          <Link href={construirHref(paginaAtual + 1)} className="mc-pagina-link">
            Próxima →
          </Link>
        )}
      </div>
    </div>
  );
}
