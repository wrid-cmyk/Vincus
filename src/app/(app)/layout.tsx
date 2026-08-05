import { getUsuarioAtual } from "@/lib/dal";
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

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const usuario = await getUsuarioAtual();

  return (
    <>
      <header className="topbar">
        <div className="brand">
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
          <span className="app-name">Vincus</span>
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
