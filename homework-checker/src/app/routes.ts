export type AppRoute = "/" | "/answers" | "/scan";

export const isAppRoute = (path: string): path is AppRoute =>
  path === "/" || path === "/answers" || path === "/scan";
