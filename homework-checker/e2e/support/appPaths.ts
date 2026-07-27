const configured = process.env.PAGES_BASE_PATH ?? "/";
export const APP_BASE_PATH = configured.endsWith("/") ? configured : `${configured}/`;

export const appPath = (relativePath = "") =>
  `${APP_BASE_PATH}${relativePath.replace(/^\/+/, "")}`;

export const stripAppBase = (pathname: string) =>
  pathname.startsWith(APP_BASE_PATH)
    ? `/${pathname.slice(APP_BASE_PATH.length)}`
    : pathname;
