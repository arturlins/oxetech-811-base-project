import type { ITicketRepository } from "../repositories/TicketRepository";
import type { IUserRepository } from "../repositories/UserRepository";
import { AppError } from "../errors/AppError";
import type { Ticket, TicketCategory, TicketComment, TicketPriority, TicketStatus } from "../types";
import { generateId } from "../utils/id.util";

// ==========================================
// Strategy Pattern: Regras de Prioridade
// ==========================================
export interface IPriorityRule {
  evaluate(category: TicketCategory, description: string): TicketPriority | null;
}

export class UrgentPriorityRule implements IPriorityRule {
  evaluate(category: TicketCategory, description: string): TicketPriority | null {
    if (category === "infra" || description.toLowerCase().includes("urgente")) {
      return "urgent";
    }
    return null;
  }
}

export class HighPriorityRule implements IPriorityRule {
  private readonly LONG_DESCRIPTION_THRESHOLD = 220;

  evaluate(category: TicketCategory, description: string): TicketPriority | null {
    if (category === "sistemas" || description.length > this.LONG_DESCRIPTION_THRESHOLD) {
      return "high";
    }
    return null;
  }
}

export class MediumPriorityRule implements IPriorityRule {
  evaluate(category: TicketCategory, _description: string): TicketPriority | null {
    if (category === "academico") {
      return "medium";
    }
    return null;
  }
}

export class DefaultPriorityRule implements IPriorityRule {
  evaluate(): TicketPriority {
    return "low";
  }
}

export class PriorityCalculator {
  private rules: IPriorityRule[] = [
    new UrgentPriorityRule(),
    new HighPriorityRule(),
    new MediumPriorityRule(),
    new DefaultPriorityRule(),
  ];

  calculate(category: TicketCategory, description: string): TicketPriority {
    for (const rule of this.rules) {
      const priority = rule.evaluate(category, description);
      if (priority !== null) {
        return priority;
      }
    }
    return "low";
  }
}

// ==========================================
// Ticket Service (Casos de Uso)
// ==========================================
export class TicketService {
  private priorityCalculator = new PriorityCalculator();

  constructor(
    private ticketRepository: ITicketRepository,
    private userRepository: IUserRepository
  ) {}


  listTickets(filters?: { status?: string; category?: string; search?: string }) {
    const tickets = this.ticketRepository.findAll(filters);
    const users = this.userRepository.findAll();
    const comments = this.ticketRepository.findAllComments();

    const usersMap = new Map(users.map((u) => [u.id, u]));
    const commentCountsMap = new Map<string, number>();

    for (const comment of comments) {
      commentCountsMap.set(comment.ticketId, (commentCountsMap.get(comment.ticketId) || 0) + 1);
    }

    return tickets.map((ticket) => {
      const requesterRaw = usersMap.get(ticket.requesterId);
      const assignedRaw = ticket.assignedToId ? usersMap.get(ticket.assignedToId) : undefined;

      const requester = requesterRaw
        ? { id: requesterRaw.id, name: requesterRaw.name, email: requesterRaw.email, role: requesterRaw.role }
        : undefined;

      const assigned = assignedRaw
        ? { id: assignedRaw.id, name: assignedRaw.name, email: assignedRaw.email, role: assignedRaw.role }
        : undefined;

      return {
        ...ticket,
        requester,
        assigned,
        commentsCount: commentCountsMap.get(ticket.id) || 0,
      };
    });
  }

  getTicketSummary() {
    const tickets = this.ticketRepository.findAll();
    const summary = {
      open: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
      urgent: 0,
    };

    for (const ticket of tickets) {
      if (ticket.status === "open") summary.open++;
      if (ticket.status === "in_progress") summary.in_progress++;
      if (ticket.status === "resolved") summary.resolved++;
      if (ticket.status === "closed") summary.closed++;
      if (ticket.priority === "urgent") summary.urgent++;
    }

    return summary;
  }

  getTicketDetail(id: string) {
    const ticket = this.ticketRepository.findById(id);
    if (!ticket) {
      throw new AppError("Ticket não encontrado", 404);
    }

    const users = this.userRepository.findAll();
    const usersMap = new Map(users.map((u) => [u.id, u]));

    const requesterRaw = usersMap.get(ticket.requesterId);
    const assignedRaw = ticket.assignedToId ? usersMap.get(ticket.assignedToId) : undefined;

    const requester = requesterRaw
      ? { id: requesterRaw.id, name: requesterRaw.name, email: requesterRaw.email, role: requesterRaw.role }
      : undefined;

    const assigned = assignedRaw
      ? { id: assignedRaw.id, name: assignedRaw.name, email: assignedRaw.email, role: assignedRaw.role }
      : undefined;

    const commentsRaw = this.ticketRepository.findCommentsByTicketId(ticket.id);
    const comments = commentsRaw.map((comment) => {
      const authorRaw = usersMap.get(comment.authorId);
      const author = authorRaw
        ? { id: authorRaw.id, name: authorRaw.name, email: authorRaw.email, role: authorRaw.role }
        : undefined;

      return {
        ...comment,
        author,
      };
    });

    return {
      ...ticket,
      requester,
      assigned,
      comments,
    };
  }

  createTicket(data: {
    title: string;
    description: string;
    category: TicketCategory;
    requesterId: string;
    assignedToId?: string;
  }): Ticket {
    const requester = this.userRepository.findById(data.requesterId);
    if (!requester) {
      throw new AppError("Solicitante inválido", 400);
    }

    if (data.assignedToId) {
      const assigned = this.userRepository.findById(data.assignedToId);
      if (!assigned) {
        throw new AppError("Responsável inválido", 400);
      }
    }

    const now = new Date().toISOString();
    const priority = this.priorityCalculator.calculate(data.category, data.description);

    const ticket: Ticket = {
      id: this.generateId("ticket"),
      title: data.title,
      description: data.description,
      category: data.category,
      requesterId: data.requesterId,
      assignedToId: data.assignedToId,
      status: "open",
      priority,
      createdAt: now,
      updatedAt: now,
    };

    return this.ticketRepository.create(ticket);
  }

  updateTicketStatus(
    id: string,
    data: { status: TicketStatus; comment?: string; authorId?: string }
  ): Ticket {
    const ticket = this.ticketRepository.findById(id);
    if (!ticket) {
      throw new AppError("Ticket não encontrado", 404);
    }

    ticket.status = data.status;
    ticket.updatedAt = new Date().toISOString();

    if (data.comment) {
      const authorId = data.authorId || ticket.requesterId;
      const author = this.userRepository.findById(authorId);
      if (!author) {
        throw new AppError("Autor do comentário inválido", 400);
      }

      this.ticketRepository.createComment({
        id: this.generateId("comment"),
        ticketId: ticket.id,
        authorId,
        message: data.comment,
        createdAt: new Date().toISOString(),
      });
    }

    return this.ticketRepository.update(ticket);
  }

  addComment(
    id: string,
    data: { message: string; authorId: string }
  ): TicketComment {
    const ticket = this.ticketRepository.findById(id);
    if (!ticket) {
      throw new AppError("Ticket não encontrado", 404);
    }

    const author = this.userRepository.findById(data.authorId);
    if (!author) {
      throw new AppError("Autor do comentário inválido", 400);
    }

    const comment: TicketComment = {
      id: this.generateId("comment"),
      ticketId: ticket.id,
      authorId: data.authorId,
      message: data.message,
      createdAt: new Date().toISOString(),
    };

    const createdComment = this.ticketRepository.createComment(comment);

    ticket.updatedAt = new Date().toISOString();
    this.ticketRepository.update(ticket);

    return createdComment;
  }
}

export function calculatePriority(category: TicketCategory, description: string): TicketPriority {
  return new PriorityCalculator().calculate(category, description);
}
