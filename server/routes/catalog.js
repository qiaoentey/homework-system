import { Router } from "express";
import { requireSession } from "../auth/session.js";
import { BRANCHES, GROUPS } from "../domain/catalog.js";

export function createCatalogRouter() {
  const router = Router();

  router.get("/", requireSession, (_request, response) => {
    const branches = BRANCHES.map((branch) => ({
      ...branch,
      groups: GROUPS.filter((group) => group.branch === branch.code).map(({ code, label }) => ({ code, label })),
    }));

    response.json({ branches });
  });

  return router;
}
