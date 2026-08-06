import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Endpoint de troca de token — recebido pelo link de email de redefinição de
// senha (Reset Password, type=recovery). Verifica o token_hash contra o
// Supabase Auth e, se válido, estabelece a sessão (cookies) antes de mandar
// o usuário pra página de nova senha. Ver /src/lib/actions/auth.ts
// (requestPasswordReset) e o template "Reset Password" no painel do
// Supabase.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      redirect(next);
    }
  }

  // Link inválido, expirado ou já usado — volta pro pedido de redefinição
  // pra a pessoa solicitar um novo.
  redirect("/esqueci-senha");
}
