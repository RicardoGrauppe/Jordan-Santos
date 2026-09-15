/*
  Sessão do painel, sem estado: token assinado guardado num cookie HttpOnly.

  Portado do `api/_lib/sessao.js` do estúdio do Jordan, com uma troca: o HMAC
  na mão virou `jose`. Mesmo formato conceitual (payload + assinatura), mas com
  biblioteca revisada em vez de código de cripto escrito por nós.

  O cookie é HttpOnly (JS da página não lê), Secure e SameSite=Lax.
*/
import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const NOME_COOKIE = "sessao";

export type Papel = "admin" | "casal";

export type Sessao = {
  sub: string;
  role: Papel;
  email?: string | null;
  /** dono dos dados. Hoje sempre o Jordan; existe desde já porque enfiar
   *  multi-tenant depois obriga a revisitar toda consulta do produto. */
  workspace?: string | null;
};

function chave(): Uint8Array {
  /* SESSION_SECRET se existir, senão deriva da service key do Supabase (também
     secreta e só de servidor). Rotacionar qualquer uma invalida as sessões
     abertas, e todo mundo loga de novo: é o efeito esperado. */
  const material = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!material) throw new Error("sem SESSION_SECRET nem SUPABASE_SERVICE_ROLE_KEY no ambiente");
  return new TextEncoder().encode("sessao-estudio|" + material);
}

export async function assinar(payload: Sessao, segundos: number): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + segundos)
    .sign(chave());
}

export async function verificar(token: string | undefined): Promise<Sessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave());
    return payload as unknown as Sessao;
  } catch {
    /* expirado, adulterado ou de outra chave: os três são "não tem sessão" */
    return null;
  }
}

/** Sessão da request atual. `papel` restringe a quem pode passar. */
export async function sessaoAtual(papel?: Papel): Promise<Sessao | null> {
  const token = (await cookies()).get(NOME_COOKIE)?.value;
  const sessao = await verificar(token);
  if (!sessao) return null;
  if (papel && sessao.role !== papel) return null;
  return sessao;
}

export async function gravarCookie(token: string, segundos: number): Promise<void> {
  (await cookies()).set(NOME_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: segundos,
  });
}

export async function limparCookie(): Promise<void> {
  (await cookies()).set(NOME_COOKIE, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 0,
  });
}
