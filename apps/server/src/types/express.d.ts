export {};

declare global {
  namespace Express {
    interface Request {
      /** Set by PokerUserMiddleware: session user, else X-Dev-User-Id, else default. */
      pokerUserId: string;
    }
  }
}
