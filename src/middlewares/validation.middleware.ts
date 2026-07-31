import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";
import type { TicketCategory, TicketStatus } from "../types";
import { sanitizeString } from "../utils/sanitize.util";

export function sanitizeBodyFields(body: unknown): void {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (typeof record[key] === "string") {
        record[key] = sanitizeString(record[key] as string);
      }
    }
  }
}

export function validateBody(validateFn: (body: unknown) => string | null) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    sanitizeBodyFields(request.body);
    const errorMsg = validateFn(request.body);
    if (errorMsg) {
      next(new AppError(errorMsg, 400));
      return;
    }
    next();
  };
}


export function validateCreateTicket(body: unknown): string | null {
  if (!body || typeof body !== "object") return "Corpo da requisição ausente";

  const { title, description, category, requesterId, assignedToId } = body as Record<string, unknown>;
  
  if (!title || typeof title !== "string" || title.trim() === "") {
    return "O campo 'title' é obrigatório e deve ser uma string não vazia";
  }
  if (!description || typeof description !== "string" || description.trim() === "") {
    return "O campo 'description' é obrigatório e deve ser uma string não vazia";
  }
  if (!category || typeof category !== "string") {
    return "O campo 'category' é obrigatório";
  }
  
  const validCategories: TicketCategory[] = ["infra", "sistemas", "academico"];
  if (!validCategories.includes(category as TicketCategory)) {
    return `Categoria inválida. Categorias permitidas: ${validCategories.join(", ")}`;
  }
  
  if (!requesterId || typeof requesterId !== "string" || requesterId.trim() === "") {
    return "O campo 'requesterId' é obrigatório";
  }
  
  if (assignedToId !== undefined && (typeof assignedToId !== "string" || assignedToId.trim() === "")) {
    return "O campo 'assignedToId' deve ser uma string não vazia";
  }
  
  return null;
}

export function validateUpdateStatus(body: unknown): string | null {
  if (!body || typeof body !== "object") return "Corpo da requisição ausente";

  const { status, comment, authorId } = body as Record<string, unknown>;
  
  if (!status || typeof status !== "string") {
    return "O campo 'status' é obrigatório";
  }
  
  const validStatuses: TicketStatus[] = ["open", "in_progress", "resolved", "closed"];
  if (!validStatuses.includes(status as TicketStatus)) {
    return `Status inválido. Status permitidos: ${validStatuses.join(", ")}`;
  }
  
  if (status === "closed" && (!comment || typeof comment !== "string" || comment.trim() === "")) {
    return "Informe um comentário para fechar o chamado";
  }
  
  if (comment !== undefined && (typeof comment !== "string" || comment.trim() === "")) {
    return "O campo 'comment' deve ser uma string não vazia";
  }
  
  if (authorId !== undefined && (typeof authorId !== "string" || authorId.trim() === "")) {
    return "O campo 'authorId' deve ser uma string não vazia";
  }
  
  return null;
}

export function validateCreateComment(body: unknown): string | null {
  if (!body || typeof body !== "object") return "Corpo da requisição ausente";

  const { message, authorId } = body as Record<string, unknown>;
  
  if (!message || typeof message !== "string" || message.trim() === "") {
    return "Comentário é obrigatório e deve ser uma string não vazia";
  }
  if (!authorId || typeof authorId !== "string" || authorId.trim() === "") {
    return "Autor é obrigatório e deve ser uma string não vazia";
  }
  
  return null;
}
