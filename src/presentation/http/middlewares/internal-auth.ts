import type { NextFunction, Request, Response } from "express";
import { env } from "../../../config/env";

/// Autenticação serviço-a-serviço (Agent-Api) — chave compartilhada via header,
/// sem sessão de usuário nem organização ativa.
export function requireInternalApiKey(req: Request, res: Response, next: NextFunction): void {
  const key = req.header("x-internal-api-key");

  if (!key || key !== env.INTERNAL_API_KEY) {
    res.status(401).json({ success: false, result: null, message: "Chave interna inválida." });
    return;
  }

  next();
}
