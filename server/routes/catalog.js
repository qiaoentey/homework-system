import { Router } from "express";
import { canViewDashboard, requireSession } from "../auth/session.js";
import { BRANCHES, GROUPS } from "../domain/catalog.js";

export function createCatalogRouter({ dashboardAllowedEmails = [] } = {}) {
  const router = Router();

  router.get("/", requireSession, (request, response) => {
    const branches = BRANCHES.map((branch) => ({
      ...branch,
      groups: GROUPS.filter((group) => group.branch === branch.code).map(({ code, label }) => ({ code, label })),
    }));

    response.json({
      permissions: {
        canViewDashboard: canViewDashboard(request.user.email, dashboardAllowedEmails),
      },
      branches,
    });
  });

  return router;
}
