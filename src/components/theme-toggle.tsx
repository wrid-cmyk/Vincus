"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "vincus-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Hidrata a preferência salva no localStorage após o mount (não dá para
    // ler no servidor). Único ponto onde sincronizamos estado a partir de uma
    // fonte externa — necessário para não gerar mismatch de SSR.
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const initial = saved === "dark" ? "dark" : "light";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button type="button" className="theme-toggle" onClick={toggle}>
      {theme === "dark" ? "☀️ Modo claro" : "🌙 Modo escuro"}
    </button>
  );
}
