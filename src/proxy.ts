import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Next.js 16 renomeou middleware.ts -> proxy.ts (mesma funcionalidade).
// Responsável por: renovar a sessão do Supabase a cada request e fazer o
// redirecionamento "otimista" (baseado no cookie, sem consultar o banco)
// entre /login e as rotas autenticadas. O controle de acesso por papel/módulo
// (painel.permissoes) é feito depois, no servidor, nas próprias páginas — ver
// src/lib/dal.ts.
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /login e /esqueci-senha: acessíveis sem sessão, e quem já está logado é
  // mandado de volta pra home. /auth/confirm: sempre acessível (é o link que
  // vem por email pra confirmar a redefinição de senha), independente de já
  // existir cookie de sessão antigo no navegador.
  const isAuthFlowRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/esqueci-senha");
  const isAuthConfirmRoute =
    request.nextUrl.pathname.startsWith("/auth/confirm");

  if (!user && !isAuthFlowRoute && !isAuthConfirmRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthFlowRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
