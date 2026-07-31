import { describe, it, expect, vi } from "vitest";
import { requestLogger } from "../middlewares/logger.middleware";
import type { Request, Response, NextFunction } from "express";

describe("Logger Middleware", () => {
  it("deve chamar next() e registrar log na finalização da resposta", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    const listeners: Record<string, () => void> = {};
    const req = { method: "GET", originalUrl: "/api/tickets" } as Request;
    const res = {
      statusCode: 200,
      on: (event: string, callback: () => void) => {
        listeners[event] = callback;
      },
    } as unknown as Response;
    const next: NextFunction = vi.fn();

    requestLogger(req, res, next);
    expect(next).toHaveBeenCalled();

    if (listeners["finish"]) {
      listeners["finish"]();
    }
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
