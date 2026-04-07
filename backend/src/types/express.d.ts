import { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface UserPayload {
      userId: string;
      role: UserRole;
      version: number;
    }

    interface Request {
      user?: UserPayload;
    }
  }
}