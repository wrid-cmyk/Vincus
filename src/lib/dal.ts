import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  papelId: string | null;
  papelNome: string | null;
  ativo: boolean;
};

/**
 * Verifica se há uma sessão Supabase válida. Redireciona para /login se não houver.
 * Memoizado por request via React cache — pode ser chamado várias vezes sem custo extra.
 */
export const verifySession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { userId: user.id, email: user.email as string };
});

/**
 * Usuário do painel (painel.usuarios) já com o nome do papel resolvido.
 * Retorna null se o usuário autenticado no Supabase Auth ainda não foi
 * cadastrado em painel.usuarios (ex: conta criada mas acesso não liberado).
 */
export const getUsuarioAtual = cache(async (): Promise<Usuario | null> => {
  const session = await verifySession();
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("painel")
    .from("usuarios")
    .select("id, nome, email, papel_id, ativo, papeis(nome)")
    .eq("auth_user_id", session.userId)
    .maybeSingle();

  if (error || !data) return null;

  const papel = Array.isArray(data.papeis) ? data.papeis[0] : data.papeis;

  return {
    id: data.id,
    nome: data.nome,
    email: data.email,
    papelId: data.papel_id,
    papelNome: papel?.nome ?? null,
    ativo: data.ativo,
  };
});

/**
 * Checa painel.permissoes para o papel do usuário atual + o módulo informado.
 * Default-deny: sem usuário cadastrado, sem papel, inativo, ou sem linha em
 * permissoes => sem acesso.
 */
export async function podeVisualizarModulo(
  moduloChave: string
): Promise<boolean> {
  const usuario = await getUsuarioAtual();
  if (!usuario || !usuario.ativo || !usuario.papelId) return false;

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("painel")
    .from("permissoes")
    .select("pode_visualizar, modulos!inner(chave)")
    .eq("papel_id", usuario.papelId)
    .eq("modulos.chave", moduloChave)
    .maybeSingle();

  if (error || !data) return false;
  return data.pode_visualizar === true;
}

/** Para usar no topo de uma page.tsx: barra o acesso se o papel não tiver permissão. */
export async function requerPermissao(moduloChave: string) {
  const permitido = await podeVisualizarModulo(moduloChave);
  if (!permitido) {
    redirect("/sem-acesso");
  }
}
