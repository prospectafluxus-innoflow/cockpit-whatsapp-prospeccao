import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { complementaryRequestLimits } from "./fluxusComplementaryLimits";

function response() {
  const r = new EventEmitter() as EventEmitter & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
  r.status = vi.fn(() => r);
  r.json = vi.fn(() => r);
  return r;
}
describe("limites da rotina complementar", () => {
  it("não interfere nos corpos HTTP das rotinas existentes", () => {
    const middleware = complementaryRequestLimits(1);
    const next = vi.fn();
    const res = response();
    middleware(
      { path: "/api/trpc/storage.audio", headers: {} } as any,
      res as any,
      next
    );
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
  it("limita concorrência e libera somente uma vez ao terminar ou fechar", () => {
    const middleware = complementaryRequestLimits(1);
    const req = { path: "/api/trpc/fluxusComplementary.upload", headers: {} };
    const first = response();
    const next = vi.fn();
    middleware({ ...req } as any, first as any, next);
    expect(next).toHaveBeenCalledOnce();
    const second = response();
    middleware({ ...req } as any, second as any, vi.fn());
    expect(second.status).toHaveBeenCalledWith(429);
    first.emit("finish");
    const third = response();
    const thirdNext = vi.fn();
    middleware({ ...req } as any, third as any, thirdNext);
    expect(thirdNext).toHaveBeenCalledOnce();
    first.emit("close");
    const fourth = response();
    middleware({ ...req } as any, fourth as any, vi.fn());
    expect(fourth.status).toHaveBeenCalledWith(429);
  });
});
