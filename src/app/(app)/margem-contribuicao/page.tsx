import Link from "next/link";
import type { ReactNode } from "react";
import { requerPermissao } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import "./margem.css";

export const dynamic = "force-dynamic";

type SearchParams = {
  de?: string;
  ate?: string;
  pagina?: string;
  calculado?: string;
  canal?: string | string[];
  filial?: string | string[];
  sku?: string;
  skuPai?: string;
  pedidoBling?: string;
  pedidoMkt?: string;
  sort?: string;
  dir?: string;
};

const PAGE_SIZE = 50;
const DATA_MINIMA = "2020-01-01";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_INEXISTENTE = "00000000-0000-0000-0000-000000000000";

const SORT_COLUNAS: Record<string, string> = {
  valorTotal: "valor_total_pedido",
  "margemR$": "lucro_liquido",
  margemPct: "margem_lucro_percentual",
  data: "data_venda",
};

const CANAL_GRUPOS = [
  { chave: "ml", rotulo: "Mercado Livre", padrao: "Mercado Livre%" },
  { chave: "wrid", rotulo: "WRID (venda direta)", padrao: "WRID%" },
  { chave: "amazon", rotulo: "Amazon", padrao: "Amazon%" },
  { chave: "shopee", rotulo: "Shopee", padrao: "Shopee%" },
  { chave: "magalu", rotulo: "Magalu", padrao: "Magalu%" },
  { chave: "bw", rotulo: "BW Commerce", padrao: "%BW Commerce%" },
] as const;

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

function subtrairDias(data: string, dias: number) {
  const d = new Date(`${data}T00:00:00`);
  d.setDate(d.getDate() - dias);
  return formatarDataInput(d);
}

function primeiroDiaDoMes(data: string) {
  const d = new Date(`${data}T00:00:00`);
  return formatarDataInput(new Date(d.getFullYear(), d.getMonth(), 1));
}

function primeiroDiaDoAno(data: string) {
  const d = new Date(`${data}T00:00:00`);
  return formatarDataInput(new Date(d.getFullYear(), 0, 1));
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

type Status = "good" | "warning" | "critical" | "pending";

function statusDeMargem(pct: unknown): Status {
  if (pct === null || pct === undefined) return "pending";
  const n = Number(pct);
  if (!Number.isFinite(n)) return "pending";
  if (n < 0) return "critical";
  if (n <= 15) return "warning";
  return "good";
}

const STATUS_ICONE: Record<Status, string> = {
  good: "✓",
  warning: "⚠",
  critical: "✕",
  pending: "⏳",
};

function StatusPill({
  pct,
  compacto,
}: {
  pct: unknown;
  compacto?: boolean;
}) {
  const status = statusDeMargem(pct);
  const rotulo =
    status === "pending"
      ? compacto
        ? "Pendente"
        : "Não calculado"
      : formatarPercentual(pct);
  return (
    <span
      className={`status-pill status-${status}`}
      title={
        status === "pending"
          ? "Ainda não calculado — aguardando o motor de rollup"
          : undefined
      }
    >
      <span className="status-icon">{STATUS_ICONE[status]}</span>
      {rotulo}
    </span>
  );
}

function tipoClienteLabel(tipo: string | null | undefined) {
  if (tipo === "F") return "Pessoa física";
  if (tipo === "J") return "Pessoa jurídica";
  return "Não informado";
}

function tipoVendaLabel(ufFilial: string | null, ufCliente: string | null) {
  if (!ufFilial || !ufCliente) return "Não informado";
  const a = ufFilial.trim().toUpperCase();
  const b = ufCliente.trim().toUpperCase();
  return a === b ? `Intraestadual (${a} → ${b})` : `Interestadual (${a} → ${b})`;
}

type CanalTipo = "ml" | "wrid-b2b" | "wrid-b2c" | "wrid" | "generico";

function classificarCanal(
  canalVenda: string | null,
  tipoCliente: string | null | undefined
): { tipo: CanalTipo; isFull: boolean; sigla: string } {
  const canal = (canalVenda ?? "").trim();
  const isFull = /full/i.test(canal);
  if (/^mercado livre/i.test(canal)) {
    return { tipo: "ml", isFull, sigla: "" };
  }
  if (/^wrid/i.test(canal)) {
    if (tipoCliente === "J") return { tipo: "wrid-b2b", isFull, sigla: "" };
    if (tipoCliente === "F") return { tipo: "wrid-b2c", isFull, sigla: "" };
    return { tipo: "wrid", isFull, sigla: "" };
  }
  return {
    tipo: "generico",
    isFull,
    sigla: (canal || "??").slice(0, 2).toUpperCase(),
  };
}

function CanalBadge({
  canalVenda,
  tipoCliente,
}: {
  canalVenda: string | null;
  tipoCliente: string | null | undefined;
}) {
  const info = classificarCanal(canalVenda, tipoCliente);
  let cls = "canal-generico";
  let inner: ReactNode = null;
  if (info.tipo === "ml") {
    cls = "canal-ml-logo";
    inner = (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/brand/ml_logo.png" alt="Mercado Livre" className="canal-logo-img" />
    );
  } else if (info.tipo === "wrid-b2b") {
    cls = "canal-wrid-b2b";
    inner = (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="7" width="18" height="12" rx="2" stroke="#fff" strokeWidth="1.7" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="#fff" strokeWidth="1.7" />
        <path d="M3 12h18" stroke="#fff" strokeWidth="1.7" />
      </svg>
    );
  } else if (info.tipo === "wrid-b2c") {
    cls = "canal-wrid-b2c";
    inner = (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="3.4" stroke="#fff" strokeWidth="1.7" />
        <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  } else if (info.tipo === "wrid") {
    cls = "canal-wrid";
    inner = (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8.5" stroke="#fff" strokeWidth="1.7" />
        <path d="M12 16v.01M12 8.5a2 2 0 0 1 2 2c0 1.3-2 1.7-2 3.3" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  } else {
    inner = <span>{info.sigla}</span>;
  }
  return (
    <div className="canal-badge-wrap" title={canalVenda ?? "—"}>
      <div className={`canal-badge ${cls}`}>{inner}</div>
      {info.isFull && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src="/brand/full_badge_transparent.png" alt="Full" className="canal-full-flag" />
      )}
    </div>
  );
}

type ItemPedido = {
  id: number;
  id_pedido: string;
  sku: string;
  quantidade: number;
  preco_unitario: number | null;
  valor_total_item: number | null;
  cmv_unitario: number | null;
  valor_icms: number | null;
  valor_icms_difal: number | null;
  valor_ipi: number | null;
  valor_pis: number | null;
  valor_cofins: number | null;
  taxa_comissao_marketplace: number | null;
};

type Pedido = {
  id: string;
  id_pedido_marketplace: string | null;
  canal_venda: string | null;
  id_cliente: string | null;
  id_filial: number | null;
  data_venda: string;
  valor_total_pedido: number;
  total_cmv: number | null;
  total_impostos: number | null;
  total_comissoes_taxas: number | null;
  lucro_liquido: number | null;
  margem_lucro_percentual: number | null;
  rollup_calculado_em: string | null;
  numero_bling: string | null;
  tarifa_comissao: number | null;
  frete_pago_vendedor: number | null;
  custo_embalagem: number | null;
  custo_logistico_fulfillment: number | null;
  custo_financeiro: number | null;
  comissao_vendedor: number | null;
};

function impostosDoItem(item: ItemPedido) {
  return (
    Number(item.valor_icms ?? 0) +
    Number(item.valor_icms_difal ?? 0) +
    Number(item.valor_ipi ?? 0) +
    Number(item.valor_pis ?? 0) +
    Number(item.valor_cofins ?? 0)
  );
}

function somarImpostosItens(itens: ItemPedido[]) {
  return itens.reduce((soma, item) => soma + impostosDoItem(item), 0);
}

function calcularMargemItem(item: ItemPedido, pedido: Pedido) {
  if (!pedido.rollup_calculado_em || item.cmv_unitario === null) return null;
  const valorItem = Number(item.valor_total_item ?? 0);
  const valorPedido = Number(pedido.valor_total_pedido) || 1;
  const impostosItem = impostosDoItem(item);
  const comissaoRateada =
    Number(pedido.total_comissoes_taxas ?? 0) * (valorItem / valorPedido);
  const cmvItem = Number(item.cmv_unitario) * Number(item.quantidade);
  const margemR$ = valorItem - cmvItem - impostosItem - comissaoRateada;
  const margemPct = valorItem > 0 ? (margemR$ / valorItem) * 100 : null;
  return { margemR$, margemPct };
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

  const canaisSelecionados = new Set(
    Array.isArray(params.canal) ? params.canal : params.canal ? [params.canal] : []
  );
  const filiaisSelecionadas = new Set(
    (Array.isArray(params.filial) ? params.filial : params.filial ? [params.filial] : [])
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n))
  );
  const skuFiltro = (params.sku ?? "").trim();
  const skuPaiFiltro = (params.skuPai ?? "").trim();
  const pedidoBlingFiltro = (params.pedidoBling ?? "").trim();
  const pedidoMktFiltro = (params.pedidoMkt ?? "").trim();

  const sortKey = SORT_COLUNAS[params.sort ?? ""] ? (params.sort as string) : "data";
  const sortDir: "asc" | "desc" = params.dir === "asc" ? "asc" : "desc";
  const sortColuna = SORT_COLUNAS[sortKey];

  const paginaAtual = Math.max(1, Math.floor(Number(params.pagina)) || 1);
  const from = (paginaAtual - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  function construirHref(overrides: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    if (usandoFiltroPersonalizado) {
      sp.set("de", dataInicio);
      sp.set("ate", dataFim);
    }
    if (somenteCalculado) sp.set("calculado", "1");
    canaisSelecionados.forEach((c) => sp.append("canal", c));
    filiaisSelecionadas.forEach((f) => sp.append("filial", String(f)));
    if (skuFiltro) sp.set("sku", skuFiltro);
    if (skuPaiFiltro) sp.set("skuPai", skuPaiFiltro);
    if (pedidoBlingFiltro) sp.set("pedidoBling", pedidoBlingFiltro);
    if (pedidoMktFiltro) sp.set("pedidoMkt", pedidoMktFiltro);
    if (sortKey !== "data") sp.set("sort", sortKey);
    if (sortDir !== "desc") sp.set("dir", sortDir);
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === undefined || v === "") sp.delete(k);
      else sp.set(k, v);
    });
    const qs = sp.toString();
    return qs ? `/margem-contribuicao?${qs}` : "/margem-contribuicao";
  }

  const presets = [
    { chave: "hoje", rotulo: "Hoje", de: padrao.fim, ate: padrao.fim },
    { chave: "7d", rotulo: "Últimos 7 dias", de: subtrairDias(padrao.fim, 6), ate: padrao.fim },
    { chave: "30d", rotulo: "Últimos 30 dias", de: subtrairDias(padrao.fim, 29), ate: padrao.fim },
    { chave: "mes", rotulo: "Este mês", de: primeiroDiaDoMes(padrao.fim), ate: padrao.fim },
    { chave: "ano", rotulo: "Este ano", de: primeiroDiaDoAno(padrao.fim), ate: padrao.fim },
  ];

  const supabase = await createClient();

  // Filtros de SKU exigem resolver primeiro quais pedidos têm item compatível.
  let idsPorSku: string[] | null = null;
  let idsPorSkuPai: string[] | null = null;
  if (skuFiltro) {
    const { data } = await supabase
      .schema("vendas")
      .from("itens_pedido")
      .select("id_pedido")
      .ilike("sku", `%${skuFiltro}%`)
      .limit(3000);
    idsPorSku = Array.from(new Set((data ?? []).map((r) => r.id_pedido as string)));
  }
  if (skuPaiFiltro) {
    const { data } = await supabase
      .schema("vendas")
      .from("itens_pedido")
      .select("id_pedido")
      .ilike("sku", `${skuPaiFiltro}%`)
      .limit(3000);
    idsPorSkuPai = Array.from(new Set((data ?? []).map((r) => r.id_pedido as string)));
  }

  let query = supabase
    .schema("vendas")
    .from("pedidos")
    .select(
      "id, id_pedido_marketplace, canal_venda, id_cliente, id_filial, data_venda, valor_total_pedido, total_cmv, total_impostos, total_comissoes_taxas, lucro_liquido, margem_lucro_percentual, rollup_calculado_em, numero_bling, tarifa_comissao, frete_pago_vendedor, custo_embalagem, custo_logistico_fulfillment, custo_financeiro, comissao_vendedor",
      { count: "exact" }
    )
    .gte("data_venda", DATA_MINIMA)
    .gte("data_venda", limiteInicioDia(dataInicio))
    .lte("data_venda", limiteFimDia(dataFim));

  if (somenteCalculado) query = query.not("rollup_calculado_em", "is", null);
  if (filiaisSelecionadas.size)
    query = query.in("id_filial", Array.from(filiaisSelecionadas));
  if (pedidoBlingFiltro) query = query.ilike("numero_bling", `%${pedidoBlingFiltro}%`);
  if (pedidoMktFiltro) query = query.ilike("id_pedido_marketplace", `%${pedidoMktFiltro}%`);
  if (canaisSelecionados.size) {
    const partes = CANAL_GRUPOS.filter((g) => canaisSelecionados.has(g.chave)).map(
      (g) => `canal_venda.ilike.${g.padrao}`
    );
    if (partes.length) query = query.or(partes.join(","));
  }
  if (idsPorSku) query = query.in("id", idsPorSku.length ? idsPorSku : [ID_INEXISTENTE]);
  if (idsPorSkuPai)
    query = query.in("id", idsPorSkuPai.length ? idsPorSkuPai : [ID_INEXISTENTE]);

  query = query
    .order(sortColuna, { ascending: sortDir === "asc" })
    .order("id", { ascending: true })
    .range(from, to);

  const [{ data: pedidosData, count, error }, resumoResp, filiaisResp] = await Promise.all([
    query,
    supabase
      .schema("vendas")
      .rpc("resumo_margem_contribuicao", {
        p_data_inicio: limiteInicioDia(dataInicio),
        p_data_fim: limiteFimDia(dataFim),
        p_somente_calculado: somenteCalculado,
      }),
    supabase.from("filiais").select("id, nome, uf").eq("ativo", true).order("nome"),
  ]);

  if (error) {
    console.error("Erro ao buscar pedidos (margem de contribuição):", error);
    return (
      <div>
        <div className="mc-header">
          <h1>Margem de Contribuição</h1>
        </div>
        <p className="mc-erro">
          Não foi possível carregar os pedidos agora. Tente novamente em instantes.
        </p>
      </div>
    );
  }

  const pedidos = (pedidosData ?? []) as Pedido[];
  const pedidoIds = pedidos.map((p) => p.id);
  const clienteIds = Array.from(new Set(pedidos.map((p) => p.id_cliente).filter(Boolean))) as string[];

  const [itensResp, clientesResp] = await Promise.all([
    pedidoIds.length
      ? supabase
          .schema("vendas")
          .from("itens_pedido")
          .select(
            "id, id_pedido, sku, quantidade, preco_unitario, valor_total_item, cmv_unitario, valor_icms, valor_icms_difal, valor_ipi, valor_pis, valor_cofins, taxa_comissao_marketplace"
          )
          .in("id_pedido", pedidoIds)
      : Promise.resolve({ data: [] as ItemPedido[] }),
    clienteIds.length
      ? supabase.from("clientes").select("id, nome, tipo, uf").in("id", clienteIds)
      : Promise.resolve({ data: [] as { id: string; nome: string; tipo: string | null; uf: string | null }[] }),
  ]);

  const itens = (itensResp.data ?? []) as ItemPedido[];
  const skusUnicos = Array.from(new Set(itens.map((i) => i.sku)));
  type ProdutoResumo = { sku: string; nome: string | null; origem_produto: string | null };
  const produtosRpc = skusUnicos.length
    ? await supabase.schema("vendas").rpc("produtos_resumo_venda_lote", { p_skus: skusUnicos })
    : { data: [] as ProdutoResumo[], error: null };
  if (produtosRpc.error) {
    console.error("Erro ao buscar nomes/origem dos produtos (margem de contribuição):", produtosRpc.error);
  }
  const produtosData = (produtosRpc.data ?? []) as ProdutoResumo[];

  const itensPorPedido = new Map<string, ItemPedido[]>();
  itens.forEach((it) => {
    const arr = itensPorPedido.get(it.id_pedido) ?? [];
    arr.push(it);
    itensPorPedido.set(it.id_pedido, arr);
  });

  const produtoPorSku = new Map<string, { nome: string | null; origem: string | null }>(
    produtosData.map(
      (p): [string, { nome: string | null; origem: string | null }] => [
        p.sku,
        { nome: p.nome, origem: p.origem_produto },
      ]
    )
  );

  type ComposicaoItem = {
    sku_anuncio: string;
    sku_componente: string;
    nome_componente: string | null;
    quantidade: number;
  };
  const composicaoRpc = skusUnicos.length
    ? await supabase.schema("vendas").rpc("composicao_kit_lote", { p_skus: skusUnicos })
    : { data: [] as ComposicaoItem[], error: null };
  if (composicaoRpc.error) {
    console.error("Erro ao buscar composição de kits (margem de contribuição):", composicaoRpc.error);
  }
  const composicaoData = (composicaoRpc.data ?? []) as ComposicaoItem[];
  const composicaoPorSku = new Map<string, ComposicaoItem[]>();
  composicaoData.forEach((c) => {
    const arr = composicaoPorSku.get(c.sku_anuncio) ?? [];
    arr.push(c);
    composicaoPorSku.set(c.sku_anuncio, arr);
  });
  const clientePorId = new Map<
    string,
    { id: string; nome: string; tipo: string | null; uf: string | null }
  >((clientesResp.data ?? []).map((c) => [c.id, c] as const));
  const filiais = filiaisResp.data ?? [];
  const filialPorId = new Map<string | number, { id: number; nome: string; uf: string | null }>(
    filiais.map((f) => [f.id, f] as const)
  );

  const resumo = Array.isArray(resumoResp.data) ? resumoResp.data[0] : resumoResp.data;
  if (resumoResp.error) {
    console.error("Erro ao buscar resumo de margem:", resumoResp.error);
  }

  const totalRegistros = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / PAGE_SIZE));
  const hojeStr = formatarDataInput(new Date());

  const totalPedidosResumo = resumo?.total_pedidos ?? totalRegistros;
  const totalPendentesResumo = resumo?.total_pendentes ?? 0;
  const somaValorResumo = resumo?.soma_valor_total ?? null;
  const somaLucroResumo = resumo?.soma_lucro_liquido ?? null;
  const somaValorCalculadosResumo = resumo?.soma_valor_calculados ?? null;
  const margemMediaPct =
    somaLucroResumo !== null && somaValorCalculadosResumo && Number(somaValorCalculadosResumo) > 0
      ? (Number(somaLucroResumo) / Number(somaValorCalculadosResumo)) * 100
      : null;

  function thSort(chave: string, rotulo: string) {
    const ativo = sortKey === chave;
    const proximaDir = ativo && sortDir === "desc" ? "asc" : "desc";
    return (
      <Link
        href={construirHref({ sort: chave, dir: proximaDir, pagina: undefined })}
        className={`th-sort th-num${ativo ? " active" : ""}`}
      >
        {rotulo} <span className="arrow">{ativo && sortDir === "asc" ? "▲" : "▼"}</span>
      </Link>
    );
  }

  return (
    <div className="mc-wide">
      <h1>Margem de Contribuição</h1>
      <p className="page-desc">
        {usandoFiltroPersonalizado
          ? `Período: ${formatarDataCurta(dataInicio)} a ${formatarDataCurta(dataFim)}`
          : "Últimos 3 dias (padrão)"}
      </p>

      {/* FILTROS */}
      <form method="GET" className="card filters">
        {sortKey !== "data" && <input type="hidden" name="sort" value={sortKey} />}
        {sortDir !== "desc" && <input type="hidden" name="dir" value={sortDir} />}

        <div className="filters-row">
          <div className="field">
            <label htmlFor="sku">SKU anúncio</label>
            <input type="text" id="sku" name="sku" placeholder="ex: 10633X2.6" defaultValue={skuFiltro} />
          </div>
          <div className="field">
            <label htmlFor="skuPai">SKU composição (pai)</label>
            <input type="text" id="skuPai" name="skuPai" placeholder="ex: 12599" defaultValue={skuPaiFiltro} />
          </div>
          <div className="field">
            <label htmlFor="pedidoBling">Pedido Bling</label>
            <input type="text" id="pedidoBling" name="pedidoBling" placeholder="ex: 404801" defaultValue={pedidoBlingFiltro} />
          </div>
          <div className="field">
            <label htmlFor="pedidoMkt">Pedido marketplace</label>
            <input type="text" id="pedidoMkt" name="pedidoMkt" placeholder="ex: 2000017766150446" defaultValue={pedidoMktFiltro} />
          </div>
        </div>

        <div className="filters-row">
          <div className="field" style={{ flex: "1 1 100%" }}>
            <label>Canal</label>
            <div className="chip-group">
              {CANAL_GRUPOS.map((g) => (
                <label key={g.chave} className="chip-label">
                  <input
                    type="checkbox"
                    name="canal"
                    value={g.chave}
                    defaultChecked={canaisSelecionados.has(g.chave)}
                  />
                  {g.rotulo}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="filters-row">
          <div className="field" style={{ flex: "1 1 100%" }}>
            <label>Loja</label>
            <div className="chip-group">
              {filiais.map((f) => (
                <label key={f.id} className="chip-label">
                  <input
                    type="checkbox"
                    name="filial"
                    value={f.id}
                    defaultChecked={filiaisSelecionadas.has(f.id)}
                  />
                  {f.nome}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="filters-row">
          <div className="field" style={{ flex: "3 1 420px" }}>
            <label>Data da venda — atalhos</label>
            <div className="chip-group">
              {presets.map((p) => {
                const ativo = usandoFiltroPersonalizado && dataInicio === p.de && dataFim === p.ate;
                return (
                  <Link
                    key={p.chave}
                    href={construirHref({ de: p.de, ate: p.ate, pagina: undefined })}
                    className={`chip${ativo ? " active" : ""}`}
                  >
                    {p.rotulo}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="custom-range">
            <div className="field">
              <label htmlFor="de">De</label>
              <input type="date" id="de" name="de" defaultValue={dataInicio} max={hojeStr} />
            </div>
            <div className="field">
              <label htmlFor="ate">Até</label>
              <input type="date" id="ate" name="ate" defaultValue={dataFim} max={hojeStr} />
            </div>
          </div>
          <label className="chip-label chip-label--calculado">
            <input type="checkbox" name="calculado" value="1" defaultChecked={somenteCalculado} />
            Somente com margem calculada
          </label>
        </div>

        <div className="filters-footer">
          <span className="result-count">
            {totalRegistros} pedido{totalRegistros === 1 ? "" : "s"} encontrado
            {totalRegistros === 1 ? "" : "s"}
          </span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {(usandoFiltroPersonalizado ||
              somenteCalculado ||
              canaisSelecionados.size > 0 ||
              filiaisSelecionadas.size > 0 ||
              skuFiltro ||
              skuPaiFiltro ||
              pedidoBlingFiltro ||
              pedidoMktFiltro) && (
              <Link href="/margem-contribuicao" className="link-btn">
                Limpar filtros
              </Link>
            )}
            <button type="submit" className="mc-botao">
              Filtrar
            </button>
          </div>
        </div>
      </form>

      {/* SOMA / cards de resumo */}
      <div className="summary-cards">
        <div className="stat-tile">
          <div className="st-label">Pedidos</div>
          <div className="st-value">{totalPedidosResumo.toLocaleString("pt-BR")}</div>
          <div className="st-sub">
            {totalPendentesResumo > 0
              ? `${totalPendentesResumo} ainda não calculado${totalPendentesResumo === 1 ? "" : "s"}`
              : "todos calculados"}
          </div>
        </div>
        <div className="stat-tile">
          <div className="st-label">Valor total vendido</div>
          <div className="st-value">{formatarMoeda(somaValorResumo)}</div>
          <div className="st-sub">
            {totalPedidosResumo} pedido{totalPedidosResumo === 1 ? "" : "s"} no filtro atual
          </div>
        </div>
        <div className="stat-tile">
          <div className="st-label">Margem total (R$)</div>
          <div className={`st-value ${somaLucroResumo !== null ? statusDeMargem(margemMediaPct) : ""}`}>
            {somaLucroResumo !== null ? formatarMoeda(somaLucroResumo) : "—"}
          </div>
          <div className="st-sub">
            {somaLucroResumo !== null
              ? "somando pedidos já calculados"
              : "nenhum pedido calculado no filtro"}
          </div>
        </div>
        <div className="stat-tile">
          <div className="st-label">Margem média (%)</div>
          <div className={`st-value ${margemMediaPct !== null ? statusDeMargem(margemMediaPct) : ""}`}>
            {margemMediaPct !== null ? formatarPercentual(margemMediaPct) : "—"}
          </div>
          <div className="st-sub">ponderada pelo valor de venda</div>
        </div>
      </div>

      {/* TABELA */}
      {pedidos.length === 0 ? (
        <div className="card empty-note">Nenhum pedido encontrado com esses filtros.</div>
      ) : (
        <div className="card table-card">
          <div className="thead-row">
            <span>Pedido</span>
            <span>Canal</span>
            <span>SKU</span>
            <span>Título</span>
            <span className="th-num">Qtd.</span>
            <span className="th-num">Val. unit.</span>
            {thSort("valorTotal", "Val. total")}
            {thSort("margemR$", "Margem R$")}
            {thSort("margemPct", "Margem %")}
            {thSort("data", "Data")}
            <span></span>
          </div>

          {pedidos.map((pedido) => {
            const itensDoPedido = itensPorPedido.get(pedido.id) ?? [];
            const cliente = pedido.id_cliente ? clientePorId.get(pedido.id_cliente) : undefined;
            const filial = pedido.id_filial ? filialPorId.get(pedido.id_filial) : undefined;
            const multiplos = itensDoPedido.length > 1;
            const item1 = itensDoPedido[0];
            const skuCol = multiplos ? `+${itensDoPedido.length} SKUs` : item1?.sku ?? "—";
            const tituloCol = multiplos
              ? "Múltiplos produtos — ver detalhes"
              : (item1 && produtoPorSku.get(item1.sku)?.nome) || item1?.sku || "—";
            const qtdCol = itensDoPedido.reduce((s, i) => s + Number(i.quantidade || 0), 0);
            const unitCol = !multiplos ? item1?.preco_unitario ?? null : null;
            const origemPedido =
              !multiplos && item1
                ? produtoPorSku.get(item1.sku)?.origem ?? "Não calculado"
                : multiplos
                  ? "Múltiplos produtos"
                  : "Não calculado";

            return (
              <details className="row-wrap" key={pedido.id}>
                <summary className="row-grid">
                  <span className="cell-strong tabnum">
                    #{pedido.numero_bling ?? pedido.id.slice(0, 8)}
                  </span>
                  <CanalBadge canalVenda={pedido.canal_venda} tipoCliente={cliente?.tipo} />
                  <span className={`cell-strong${multiplos ? " sku-multi" : ""}`}>{skuCol}</span>
                  <div className="sku-title">
                    <span className="t1" title={tituloCol}>
                      {tituloCol}
                    </span>
                  </div>
                  <span className="num-cell tabnum">{qtdCol}</span>
                  <span className="num-cell tabnum cell-muted">
                    {unitCol !== null ? formatarMoeda(unitCol) : "—"}
                  </span>
                  <span className="num-cell tabnum cell-strong">
                    {formatarMoeda(pedido.valor_total_pedido)}
                  </span>
                  <span className={`num-cell tabnum margem-rs status-${statusDeMargem(pedido.margem_lucro_percentual)}`}>
                    {pedido.lucro_liquido !== null ? formatarMoeda(pedido.lucro_liquido) : "—"}
                  </span>
                  <span className="num-cell">
                    <StatusPill pct={pedido.margem_lucro_percentual} compacto />
                  </span>
                  <span className="cell-muted">{formatarDataHora(pedido.data_venda)}</span>
                  <span className="chevron-btn" aria-hidden="true">
                    ⌄
                  </span>
                </summary>

                <div className="detail-panel">
                  <div className="detail-inner">
                    <div className="detail-group">
                      <div className="detail-group-label">Pedido</div>
                      <div className="detail-grid">
                        <div className="kv">
                          <label>Pedido Bling</label>
                          <div className="v mono">#{pedido.numero_bling ?? "—"}</div>
                        </div>
                        <div className="kv">
                          <label>Pedido marketplace</label>
                          <div className="v mono">
                            {pedido.id_pedido_marketplace ? `#${pedido.id_pedido_marketplace}` : "— (pedido interno)"}
                          </div>
                        </div>
                        <div className="kv">
                          <label>Canal</label>
                          <div className="v">{pedido.canal_venda ?? "—"}</div>
                        </div>
                        <div className="kv">
                          <label>Loja (origem)</label>
                          <div className="v">{filial ? `${filial.nome} · UF ${filial.uf}` : "—"}</div>
                        </div>
                        <div className="kv">
                          <label>Origem do produto</label>
                          <div className="v">{origemPedido}</div>
                        </div>
                        <div className="kv">
                          <label>Tipo de venda</label>
                          <div className="v">{tipoVendaLabel(filial?.uf ?? null, cliente?.uf ?? null)}</div>
                        </div>
                        <div className="kv">
                          <label>Data da venda</label>
                          <div className="v">{formatarDataHora(pedido.data_venda)}</div>
                        </div>
                        <div className="kv">
                          <label>Valor total do pedido</label>
                          <div className="v mono">{formatarMoeda(pedido.valor_total_pedido)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="detail-group">
                      <div className="detail-group-label">Cliente</div>
                      <div className="detail-grid">
                        <div className="kv">
                          <label>Nome do cliente</label>
                          <div className="v">{cliente?.nome ?? "—"}</div>
                        </div>
                        <div className="kv">
                          <label>Tipo de cliente</label>
                          <div className="v">{tipoClienteLabel(cliente?.tipo)}</div>
                        </div>
                        <div className="kv">
                          <label>Destino (UF do cliente)</label>
                          <div className="v">{cliente?.uf ? `UF ${cliente.uf}` : "—"}</div>
                        </div>
                      </div>
                    </div>

                    <div className="detail-section-title">Itens do pedido ({itensDoPedido.length})</div>
                    <table className="items-table">
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Título</th>
                          <th>Origem</th>
                          <th className="num">Qtd.</th>
                          <th className="num">Val. unit.</th>
                          <th className="num">Val. total</th>
                          <th className="num">CMV unit.</th>
                          <th className="num">Margem do item</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itensDoPedido.map((item) => {
                          const margemItem = calcularMargemItem(item, pedido);
                          const produto = produtoPorSku.get(item.sku);
                          return (
                            <tr key={item.id}>
                              <td className="tabnum">{item.sku}</td>
                              <td className="item-title" title={produto?.nome ?? item.sku}>
                                {produto?.nome ?? "—"}
                              </td>
                              <td>{produto?.origem ?? "—"}</td>
                              <td className="num tabnum">{item.quantidade}</td>
                              <td className="num tabnum">{formatarMoeda(item.preco_unitario)}</td>
                              <td className="num tabnum">{formatarMoeda(item.valor_total_item)}</td>
                              <td className="num tabnum">{formatarMoeda(item.cmv_unitario)}</td>
                              <td className="num">
                                {margemItem ? (
                                  <StatusPill pct={margemItem.margemPct} />
                                ) : (
                                  <StatusPill pct={null} />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {(() => {
                      const itensComComposicao = itensDoPedido
                        .map((item) => ({ item, componentes: composicaoPorSku.get(item.sku) }))
                        .filter(
                          (x): x is { item: ItemPedido; componentes: ComposicaoItem[] } =>
                            !!x.componentes && x.componentes.length > 0
                        );
                      if (itensComComposicao.length === 0) return null;
                      return (
                        <>
                          <div className="detail-section-title">Composição — produto(s) pai</div>
                          <table className="items-table">
                            <thead>
                              <tr>
                                <th>SKU anúncio</th>
                                <th>SKU componente (pai)</th>
                                <th>Título</th>
                                <th className="num">Qtd. por kit</th>
                                <th className="num">Qtd. total no pedido</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itensComComposicao.flatMap(({ item, componentes }) =>
                                componentes.map((c) => (
                                  <tr key={`${item.id}-${c.sku_componente}`}>
                                    <td className="tabnum">{item.sku}</td>
                                    <td className="tabnum cell-strong">{c.sku_componente}</td>
                                    <td className="item-title" title={c.nome_componente ?? c.sku_componente}>
                                      {c.nome_componente ?? "—"}
                                    </td>
                                    <td className="num tabnum">{c.quantidade}</td>
                                    <td className="num tabnum">
                                      {Number(c.quantidade) * Number(item.quantidade)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </>
                      );
                    })()}

                    {pedido.rollup_calculado_em ? (
                      <>
                        <div className="detail-section-title">Totais do pedido (clique para detalhar por item)</div>
                        <div className="totals-row">
                          <details className="total-chip">
                            <summary>
                              <div className="tc-top">
                                <span>CMV total</span>
                                <span className="tc-arrow">ver por item ▸</span>
                              </div>
                              <div className="tc-val">
                                {formatarMoeda(pedido.total_cmv)}{" "}
                                <span className="tc-pct">
                                  {pedido.total_cmv !== null
                                    ? `${((Number(pedido.total_cmv) / Number(pedido.valor_total_pedido)) * 100).toFixed(2)}% da venda`
                                    : ""}
                                </span>
                              </div>
                            </summary>
                            <div className="subdetail">
                              <div className="subdetail-title">CMV por item</div>
                              <table className="items-table">
                                <thead>
                                  <tr>
                                    <th>SKU</th>
                                    <th className="num">CMV total</th>
                                    <th className="num">% do CMV do pedido</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {itensDoPedido.map((item) => {
                                    const cmvItem =
                                      item.cmv_unitario !== null
                                        ? Number(item.cmv_unitario) * Number(item.quantidade)
                                        : null;
                                    const pctCmv =
                                      cmvItem !== null && pedido.total_cmv
                                        ? ((cmvItem / Number(pedido.total_cmv)) * 100).toFixed(1)
                                        : "—";
                                    return (
                                      <tr key={item.id}>
                                        <td>{item.sku}</td>
                                        <td className="num tabnum">{formatarMoeda(cmvItem)}</td>
                                        <td className="num tabnum">{pctCmv === "—" ? "—" : `${pctCmv}%`}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </details>

                          <details className="total-chip">
                            <summary>
                              <div className="tc-top">
                                <span>Impostos</span>
                                <span className="tc-arrow">ver por item ▸</span>
                              </div>
                              <div className="tc-val">
                                {formatarMoeda(somarImpostosItens(itensDoPedido))}
                              </div>
                            </summary>
                            <div className="subdetail">
                              <div className="subdetail-title">Impostos por item</div>
                              <table className="items-table">
                                <thead>
                                  <tr>
                                    <th>SKU</th>
                                    <th className="num">ICMS</th>
                                    <th className="num">DIFAL</th>
                                    <th className="num">IPI</th>
                                    <th className="num">PIS</th>
                                    <th className="num">COFINS</th>
                                    <th className="num">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {itensDoPedido.map((item) => {
                                    const tot = impostosDoItem(item);
                                    return (
                                      <tr key={item.id}>
                                        <td>{item.sku}</td>
                                        <td className="num tabnum">{formatarMoeda(item.valor_icms ?? 0)}</td>
                                        <td className="num tabnum">{formatarMoeda(item.valor_icms_difal ?? 0)}</td>
                                        <td className="num tabnum">{formatarMoeda(item.valor_ipi ?? 0)}</td>
                                        <td className="num tabnum">{formatarMoeda(item.valor_pis ?? 0)}</td>
                                        <td className="num tabnum">{formatarMoeda(item.valor_cofins ?? 0)}</td>
                                        <td className="num tabnum cell-strong">{formatarMoeda(tot)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </details>

                          <details className="total-chip">
                            <summary>
                              <div className="tc-top">
                                <span>Comissões / taxas</span>
                                <span className="tc-arrow">ver por item ▸</span>
                              </div>
                              <div className="tc-val">{formatarMoeda(pedido.total_comissoes_taxas)}</div>
                            </summary>
                            <div className="subdetail">
                              <div className="subdetail-title">
                                Comissões / taxas — composição (nível pedido, não rateada por item)
                              </div>
                              <table className="items-table">
                                <thead>
                                  <tr>
                                    <th>Componente</th>
                                    <th className="num">Valor</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[
                                    ["Tarifa de comissão (marketplace)", pedido.tarifa_comissao],
                                    ["Frete pago pelo vendedor", pedido.frete_pago_vendedor],
                                    ["Custo de embalagem", pedido.custo_embalagem],
                                    ["Custo logístico (fulfillment)", pedido.custo_logistico_fulfillment],
                                    ["Comissão de vendedor WRID", pedido.comissao_vendedor],
                                    ["Custo financeiro WRID", pedido.custo_financeiro],
                                  ]
                                    .filter(([, v]) => v !== null && Number(v) !== 0)
                                    .map(([label, v]) => (
                                      <tr key={label as string}>
                                        <td>{label}</td>
                                        <td className="num tabnum">{formatarMoeda(v)}</td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          </details>

                          <details className="total-chip">
                            <summary>
                              <div className="tc-top">
                                <span>Lucro líquido</span>
                                <span className="tc-arrow">ver por item ▸</span>
                              </div>
                              <div className={`tc-val ${Number(pedido.lucro_liquido) >= 0 ? "positive" : "negative"}`}>
                                {formatarMoeda(pedido.lucro_liquido)}{" "}
                                <span className="tc-pct">{formatarPercentual(pedido.margem_lucro_percentual)}</span>
                              </div>
                            </summary>
                            <div className="subdetail">
                              <div className="subdetail-title">
                                Margem por item (impostos reais do item + comissões/taxas rateadas proporcionalmente pelo valor)
                              </div>
                              <table className="items-table">
                                <thead>
                                  <tr>
                                    <th>SKU</th>
                                    <th className="num">Valor de venda</th>
                                    <th className="num">Margem</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {itensDoPedido.map((item) => {
                                    const margemItem = calcularMargemItem(item, pedido);
                                    return (
                                      <tr key={item.id}>
                                        <td>{item.sku}</td>
                                        <td className="num tabnum">{formatarMoeda(item.valor_total_item)}</td>
                                        <td className="num">
                                          <StatusPill pct={margemItem?.margemPct ?? null} />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </details>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="detail-section-title">Cálculo do pedido</div>
                        <p className="mc-pendente-nota">
                          ⏳ <strong>Ainda não calculado.</strong> Aguardando o motor de rollup processar este pedido.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}

      <div className="mc-paginacao">
        {paginaAtual <= 1 ? (
          <span className="mc-pagina-link mc-pagina-link--desabilitado">← Anterior</span>
        ) : (
          <Link href={construirHref({ pagina: String(paginaAtual - 1) })} className="mc-pagina-link">
            ← Anterior
          </Link>
        )}
        <span>
          Página {paginaAtual} de {totalPaginas}
        </span>
        {paginaAtual >= totalPaginas ? (
          <span className="mc-pagina-link mc-pagina-link--desabilitado">Próxima →</span>
        ) : (
          <Link href={construirHref({ pagina: String(paginaAtual + 1) })} className="mc-pagina-link">
            Próxima →
          </Link>
        )}
      </div>

      <div className="legend">
        <span className="li">
          <span className="status-pill status-good">
            <span className="status-icon">✓</span>&gt; 15%
          </span>{" "}
          margem saudável
        </span>
        <span className="li">
          <span className="status-pill status-warning">
            <span className="status-icon">⚠</span>0–15%
          </span>{" "}
          margem apertada
        </span>
        <span className="li">
          <span className="status-pill status-critical">
            <span className="status-icon">✕</span>&lt; 0%
          </span>{" "}
          margem negativa
        </span>
        <span className="li">
          <span className="status-pill status-pending">
            <span className="status-icon">⏳</span>—
          </span>{" "}
          ainda não calculado (aguardando motor)
        </span>
      </div>
    </div>
  );
}
