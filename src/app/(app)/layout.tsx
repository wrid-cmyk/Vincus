import Link from "next/link";
import { getUsuarioAtual, podeVisualizarModulo } from "@/lib/dal";
import { logout } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import "./shell.css";

function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

// Menu principal por setor. Cada item usa a mesma checagem de RBAC
// (painel.permissoes) já usada no card de módulo da home — um setor só
// aparece se tiver ao menos 1 item liberado pro usuário logado. Extensível:
// novos setores/itens entram só adicionando uma linha aqui.
type ItemMenu = { label: string; href: string; moduloChave: string };
type SetorMenu = { nome: string; itens: ItemMenu[] };

const SETORES: SetorMenu[] = [
  {
    nome: "Financeiro",
    itens: [
      {
        label: "Margem de Contribuição",
        href: "/margem-contribuicao",
        moduloChave: "margem_contribuicao",
      },
    ],
  },
];

async function setoresVisiveis(): Promise<SetorMenu[]> {
  const resolvidos = await Promise.all(
    SETORES.map(async (setor) => {
      const itensPermitidos = await Promise.all(
        setor.itens.map(async (item) => ({
          item,
          permitido: await podeVisualizarModulo(item.moduloChave),
        }))
      );
      return {
        nome: setor.nome,
        itens: itensPermitidos.filter((i) => i.permitido).map((i) => i.item),
      };
    })
  );
  return resolvidos.filter((setor) => setor.itens.length > 0);
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const usuario = await getUsuarioAtual();
  const setores = usuario ? await setoresVisiveis() : [];

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand">
            <Link href="/" className="vincus-logo" title="Ir para o início">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/vincus_icon.png"
                alt="Vincus"
                className="vincus-logo-icon"
              />
              <span className="app-name">Vincus</span>
            </Link>
            <div className="company-logos">
              <div className="logo-chip">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/ppcs_icon.png"
                  alt="Parceiro das Peças"
                  className="logo-icon"
                />
                <span className="logo-text">Parceiro das Peças</span>
              </div>
              <div className="logo-chip">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/dobb_icon.png" alt="Dobb" className="logo-icon" />
                <span className="logo-text">Dobb</span>
              </div>
            </div>
          </div>

          {setores.length > 0 && (
            <nav className="main-nav">
              {setores.map((setor) => (
                <div className="nav-item" key={setor.nome}>
                  <button type="button" className="nav-trigger">
                    {setor.nome}
                  </button>
                  <div className="nav-dropdown">
                    {setor.itens.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="nav-dropdown-item"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          )}
        </div>

        <div className="topbar-right">
          <ThemeToggle />
          {usuario && (
            <div className="user-chip">
              <div className="avatar">{iniciais(usuario.nome)}</div>
              <div className="user-info">
                <span className="user-name">{usuario.nome}</span>
                <span className="user-role">
                  {usuario.papelNome ?? "Sem papel"}
                </span>
              </div>
              <form action={logout}>
                <button type="submit" className="logout-button">
                  Sair
                </button>
              </form>
            </div>
          )}
        </div>
      </header>
      <main className="app-content">{children}</main>
    </>
  );
}
