/**
 * authOwn.ts — Autenticação própria com email + senha
 * Substitui o fluxo Manus OAuth para clientes externos.
 * Inclui sistema de aprovação: novos cadastros ficam "pending" até o admin aprovar.
 */
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import {
  getUserByEmail,
  getUserByResetToken,
  createUser,
  updateUser,
  listUsers,
  db,
} from "../db";
import { users } from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import { getSessionCookieOptions } from "../_core/cookies";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { SignJWT } from "jose";
import { ENV } from "../_core/env";
import { COOKIE_NAME } from "../../shared/const";

const JWT_SECRET = new TextEncoder().encode(ENV.cookieSecret);
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const loginFailures = new Map<string, number[]>();

function loginAttemptKey(
  ctx: {
    req: {
      ip?: string;
      socket?: { remoteAddress?: string };
      headers: Record<string, unknown>;
    };
  },
  email: string
) {
  const forwarded = ctx.req.headers["x-forwarded-for"];
  const ip =
    typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : (ctx.req.ip ?? ctx.req.socket?.remoteAddress ?? "unknown");
  return `${ip}:${email.toLowerCase()}`;
}

function currentLoginFailures(key: string) {
  const threshold = Date.now() - LOGIN_WINDOW_MS;
  const failures = (loginFailures.get(key) ?? []).filter(
    timestamp => timestamp > threshold
  );
  loginFailures.set(key, failures);
  return failures;
}

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
    .mutation(async ({ input }) => {
      const existing = await getUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este email já está cadastrado.",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);

      await createUser({
        name: input.name,
        email: input.email,
        passwordHash,
        loginMethod: "email",
        role: "user",
        approvalStatus: "pending",
        lastSignedIn: new Date(),
      });

      // Não cria sessão — usuário aguarda aprovação do admin
      return { success: true, pending: true, name: input.name };
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
      const attemptKey = loginAttemptKey(ctx as never, input.email);
      if (currentLoginFailures(attemptKey).length >= LOGIN_MAX_FAILURES) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message:
            "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
        });
      }
      const user = await getUserByEmail(input.email);

      if (!user || !user.passwordHash) {
        loginFailures.set(attemptKey, [
          ...currentLoginFailures(attemptKey),
          Date.now(),
        ]);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Email ou senha incorretos.",
        });
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        loginFailures.set(attemptKey, [
          ...currentLoginFailures(attemptKey),
          Date.now(),
        ]);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Email ou senha incorretos.",
        });
      }

      // Bloquear usuários não aprovados
      if ((user as any).approvalStatus === "pending") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "PENDING: Seu cadastro está aguardando aprovação. Você será notificado assim que liberado.",
        });
      }
      if ((user as any).approvalStatus === "rejected") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "REJECTED: Seu acesso foi negado. Entre em contato com o suporte.",
        });
      }

      await updateUser(user.id, { lastSignedIn: new Date() });
      loginFailures.delete(attemptKey);

      const token = await signToken(user.id, user.role);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return {
        success: true,
        name: user.name,
        role: user.role,
        accountType: user.accountType,
      };
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
      const user = await getUserByEmail(input.email);

      // Sempre retornar sucesso para não revelar se email existe
      if (!user) return { success: true };

      const resetToken = randomBytes(36).toString("base64url");
      const resetTokenHash = createHash("sha256")
        .update(resetToken)
        .digest("hex");
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h

      await updateUser(user.id, {
        resetToken: resetTokenHash,
        resetTokenExpiresAt: expiresAt,
      });

      // Em produção, o token deve ser enviado por provedor de e-mail e nunca devolvido ao cliente.
      return {
        success: true,
        resetToken:
          process.env.NODE_ENV === "production" ? undefined : resetToken,
      };
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
      const user = await getUserByResetToken(input.token);

      if (!user) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Token inválido ou expirado.",
        });
      }

      if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Token expirado. Solicite um novo.",
        });
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await updateUser(user.id, {
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
      });

      return { success: true };
    }),

  // ─── Listar usuários (admin) ───────────────────────────────────────────────
  listUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Acesso restrito a administradores.",
      });
    }

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        approvalStatus: users.approvalStatus,
        loginMethod: users.loginMethod,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
      })
      .from(users)
      .orderBy(asc(users.createdAt));

    return rows;
  }),

  // ─── Aprovar usuário ───────────────────────────────────────────────────────
  approveUser: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await db
        .update(users)
        .set({ approvalStatus: "approved", updatedAt: new Date() })
        .where(eq(users.id, input.userId));
      return { success: true };
    }),

  // ─── Rejeitar usuário ──────────────────────────────────────────────────────
  rejectUser: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await db
        .update(users)
        .set({ approvalStatus: "rejected", updatedAt: new Date() })
        .where(eq(users.id, input.userId));
      return { success: true };
    }),

  // ─── Obter perfil do usuário logado
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const row = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        whatsappOwn: users.whatsappOwn,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);
    return row[0] ?? null;
  }),

  // ─── Atualizar perfil do usuário logado
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).optional(),
        whatsappOwn: z
          .string()
          .regex(/^\d{10,15}$/, "Número inválido (somente dígitos, 10-15)")
          .optional()
          .or(z.literal("")),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (input.name !== undefined) updates.name = input.name;
      if (input.whatsappOwn !== undefined)
        updates.whatsappOwn = input.whatsappOwn || null;
      await db.update(users).set(updates).where(eq(users.id, ctx.user.id));
      return { success: true };
    }),

  // ─── Promover usuário a admin ──────────────────────────────────────────────
  promoteUser: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db
        .update(users)
        .set({ role: "admin" })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),
});
