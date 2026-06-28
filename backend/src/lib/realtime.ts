/**
 * Socket.io real-time layer.
 *
 * Used for the admin dashboard "live" feed: new transactions, card status
 * changes and fraud alerts push to connected admin clients instead of the
 * frontend having to poll. Auth is a JWT handshake (same token the REST API
 * uses) so an unauthenticated socket can't subscribe to anything.
 *
 * Rooms:
 *  - "admins"            -> all connected administrators (dashboard-wide events)
 *  - "card:<cardId>"      -> joined by cardholders viewing their own card, and
 *                            by admins viewing a specific card detail page
 */
import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { logger } from "./logger";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-do-not-use-in-prod";

interface SocketUser {
  id: string;
  email: string;
  role: "Administrator" | "Cardholder";
}

let io: Server | undefined;

export function initRealtime(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Authentication required"));
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as SocketUser;
      (socket.data as { user: SocketUser }).user = decoded;
      next();
    } catch {
      next(new Error("Invalid or expired session"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket.data as { user: SocketUser }).user;
    logger.info("socket_connected", { userId: user.id, role: user.role });

    if (user.role === "Administrator") {
      socket.join("admins");
    }

    socket.on("subscribe:card", (cardId: string) => {
      socket.join(`card:${cardId}`);
    });

    socket.on("disconnect", () => {
      logger.debug("socket_disconnected", { userId: user.id });
    });
  });

  logger.info("realtime_initialised");
  return io;
}

/** Push an event to every connected administrator dashboard. */
export function emitToAdmins(event: string, payload: unknown) {
  io?.to("admins").emit(event, payload);
}

/** Push an event to anyone (admin or cardholder) subscribed to a specific card. */
export function emitToCard(cardId: string, event: string, payload: unknown) {
  io?.to(`card:${cardId}`).emit(event, payload);
}

export function isRealtimeActive() {
  return Boolean(io);
}
