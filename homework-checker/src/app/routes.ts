export type AppRoute = "/" | "/answers" | "/scan";

export const isAppRoute = (path: string): path is AppRoute =>
  path === "/" || path === "/answers" || path === "/scan";

export const routeFromHash = (hash: string): AppRoute => {
  const candidate = hash.startsWith("#") ? hash.slice(1) : hash;
  return isAppRoute(candidate) ? candidate : "/";
};

export const hashForRoute = (route: AppRoute) => `#${route}`;
