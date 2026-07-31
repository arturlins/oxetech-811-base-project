import { describe, it, expect, vi } from "vitest";
import { UserController } from "../controllers/UserController";
import type { UserService } from "../services/UserService";
import type { Request, Response, NextFunction } from "express";

describe("UserController", () => {
  it("deve retornar lista de usuários sem o campo password", () => {
    const mockUserService = {
      listUsers: vi.fn().mockReturnValue([
        { id: "usr_1", name: "Alice", email: "alice@test.com", role: "student" },
      ]),
    } as unknown as UserService;

    const controller = new UserController(mockUserService);
    const req = {} as Request;
    const jsonFn = vi.fn();
    const res = { json: jsonFn } as unknown as Response;
    const next = vi.fn() as NextFunction;

    controller.listUsers(req, res, next);

    expect(mockUserService.listUsers).toHaveBeenCalled();
    expect(jsonFn).toHaveBeenCalledWith([
      { id: "usr_1", name: "Alice", email: "alice@test.com", role: "student" },
    ]);
  });
});
