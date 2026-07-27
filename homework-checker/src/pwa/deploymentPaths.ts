export const normalizeBasePath = (basePath: string) => {
  const withLeadingSlash = basePath.startsWith("/") ? basePath : `/${basePath}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
};

export const pathInBase = (basePath: string, relativePath: string) =>
  `${normalizeBasePath(basePath)}${relativePath.replace(/^\/+/, "")}`;

export const isPathInBase = (
  pathname: string,
  basePath: string,
  relativePrefix: string,
) => pathname.startsWith(pathInBase(basePath, relativePrefix));
