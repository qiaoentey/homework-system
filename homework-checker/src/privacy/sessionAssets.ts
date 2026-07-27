export type SessionAsset = {
  file: File;
  url: string;
  release: () => void;
};

export function createSessionAsset(file: File): SessionAsset {
  const url = URL.createObjectURL(file);
  let released = false;

  return {
    file,
    url,
    release: () => {
      if (released) return;
      released = true;
      URL.revokeObjectURL(url);
    },
  };
}
