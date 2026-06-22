/**
 * authOwn.ts — Autenticação própria com email + senha
 * Substitui o fluxo Manus OAuth para clientes externos.
 */
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { users } from "../../drizzle/schema";
import { getDb } from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "../_core/env";
import { COOKIE_NAME } from "../../shared/const";

const JWT_SECRET = new TextEncoder().encode(ENV.cookieSecret);

async function signToken(userId: number, role: string) {
  return new SignJWT({ sub: String(userId), role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export const authOwnRouter = router({
  // ─── Registro ─────────────────────────────────────────────────────────────
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(2, "Nome muito curto"),
        email: z.string().email("Email inválido"),
        password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });

      // Verificar se email já existe
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Este email já está cadastrado." });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);

      const result = await db.insert(users).values({
        name: input.name,
        email: input.email,
        passwordHash,
        loginMethod: "email",
        role: "user",
        lastSignedIn: new Date(),
      });

      const userId = Number((result as any).insertId);
      const token = await signToken(userId, "user");
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });

      return { success: true, name: input.name };
    }),

  // ─── Login ─────────────────────────────────────────────────────────────────
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });

      const rows = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      const user = rows[0];
      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha incorretos." });
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha incorretos." });
      }

      // Atualizar lastSignedIn
      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      const token = await signToken(user.id, user.role);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });

      return { success: true, name: user.name, role: user.role };
    }),

  // ─── Logout ────────────────────────────────────────────────────────────────
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true };
  }),

  // ─── Solicitar reset de senha ──────────────────────────────────────────────
  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      // Sempre retornar sucesso para não revelar se email existe
      if (rows.length === 0) return { success: true };

      const user = rows[0];
      const resetToken = nanoid(48);
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h

      await db
        .update(users)
        .set({ resetToken, resetTokenExpiresAt: expiresAt })
        .where(eq(users.id, user.id));

      // Em produção, enviar email. Por ora, retornamos o token para exibição.
      return { success: true, resetToken };
    }),

  // ─── Redefinir senha com token ─────────────────────────────────────────────
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        newPassword: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select({ id: users.id, resetTokenExpiresAt: users.resetTokenExpiresAt })
        .from(users)
        .where(eq(users.resetToken, input.token))
        .limit(1);

      const user = rows[0];
      if (!user) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Token inválido ou expirado." });
      }

      if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Token expirado. Solicite um novo." });
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await db
        .update(users)
        .set({ passwordHash, resetToken: null, resetTokenExpiresAt: null })
        .where(eq(users.id, user.id));

      return { success: true };
    }),

  // ─── Listar usuários (admin) ───────────────────────────────────────────────
  listUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        loginMethod: users.loginMethod,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
      })
      .from(users)
      .orderBy(users.createdAt);

    return rows;
  }),

  // ─── Promover usuário a admin ──────────────────────────────────────────────
  promoteUser: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(users).set({ role: "admin" }).where(eq(users.id, input.userId));
      return { success: true };
    }),
});
