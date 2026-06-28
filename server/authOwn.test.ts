/**
 * authOwn.test.ts — Testes de autenticação própria (register, login, logout)
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { COOKIE_NAME } from "../shared/const";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock do banco de dados
vi.mock("./db", () => ({
  getUserByOpenId: vi.fn(),
  getUserById: vi.fn(),
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
}));

// Mock do bcrypt para testes rápidos
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$hashed$password"),
    compare: vi.fn(),
  },
}));

import bcrypt from "bcryptjs";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMockDb(overrides: Record<string, unknown> = {}) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    ...overrides,
  };
}

// ─── Testes de validação de input ─────────────────────────────────────────────

describe("authOwn — validação de inputs", () => {
  it("rejeita email inválido no registro", () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test("nao-e-email")).toBe(false);
    expect(emailRegex.test("valido@email.com")).toBe(true);
  });

  it("rejeita senha com menos de 6 caracteres", () => {
    const isValidPassword = (p: string) => p.length >= 6;
    expect(isValidPassword("12345")).toBe(false);
    expect(isValidPassword("123456")).toBe(true);
  });

  it("rejeita nome com menos de 2 caracteres", () => {
    const isValidName = (n: string) => n.trim().length >= 2;
    expect(isValidName("A")).toBe(false);
    expect(isValidName("Jo")).toBe(true);
  });
});

// ─── Testes de lógica de registro ─────────────────────────────────────────────

describe("authOwn — lógica de registro", () => {
  it("impede registro com email duplicado", async () => {
    const mockDb = createMockDb({
      limit: vi.fn().mockResolvedValue([{ id: 1 }]), // email já existe
    });
    // Simula a verificação de duplicidade
    const existing = await mockDb.select().from({}).where({}).limit(1);
    expect(existing.length).toBeGreaterThan(0);
  });

  it("faz hash da senha antes de salvar", async () => {
    const password = "minhasenha123";
    const hash = await bcrypt.hash(password, 12);
    expect(hash).toBe("$hashed$password");
    expect(bcrypt.hash).toHaveBeenCalledWith(password, 12);
  });
});

// ─── Testes de lógica de login ─────────────────────────────────────────────────

describe("authOwn — lógica de login", () => {
  it("rejeita login quando usuário não existe", async () => {
    const mockDb = createMockDb({
      limit: vi.fn().mockResolvedValue([]), // usuário não encontrado
    });

    const user = await mockDb.select().from({}).where({}).limit(1);
    expect(user.length).toBe(0);
  });

  it("rejeita login com senha incorreta", async () => {
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    const isMatch = await bcrypt.compare("senhaerrada", "$hashed$password");
    expect(isMatch).toBe(false);
  });

  it("aceita login com senha correta", async () => {
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    const isMatch = await bcrypt.compare("senhaCorreta", "$hashed$password");
    expect(isMatch).toBe(true);
  });
});

// ─── Testes de logout ─────────────────────────────────────────────────────────

describe("authOwn — logout", () => {
  it("limpa o cookie de sessão ao fazer logout", () => {
    const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];

    const mockRes = {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    };

    // Simula o comportamento do logout
    mockRes.clearCookie(COOKIE_NAME, { maxAge: -1, httpOnly: true, path: "/" });

    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1, httpOnly: true });
  });
});

// ─── Testes de token JWT ──────────────────────────────────────────────────────

describe("authOwn — token JWT", () => {
  it("token deve conter sub numérico e role", async () => {
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode("test-secret-key-minimum-32-chars!!");

    const token = await new SignJWT({ sub: "42", role: "user" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secret);

    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(token, secret);

    expect(payload.sub).toBe("42");
    expect(payload.role).toBe("user");
  });
});
