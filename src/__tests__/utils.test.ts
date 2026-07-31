import { describe, it, expect } from "vitest";
import { generateId } from "../utils/id.util";
import { sanitizeString } from "../utils/sanitize.util";

describe("Utility Functions", () => {
  describe("generateId", () => {
    it("deve gerar um ID formatado com o prefixo e um UUID válido", () => {
      const id = generateId("ticket");
      expect(id).toMatch(/^ticket_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it("deve gerar IDs únicos em chamadas consecutivas", () => {
      const id1 = generateId("comment");
      const id2 = generateId("comment");
      expect(id1).not.toBe(id2);
    });
  });

  describe("sanitizeString", () => {
    it("deve remover tags <script> e tags HTML de entradas", () => {
      const dirty = "  <script>alert('xss')</script><b>Texto Seguro</b>  ";
      const clean = sanitizeString(dirty);
      expect(clean).toBe("Texto Seguro");
    });

    it("deve manter textos limpos intactos, apenas aplicando trim", () => {
      expect(sanitizeString("  Chamada normal  ")).toBe("Chamada normal");
    });
  });
});
