declare module "node:fs" {
  export function cpSync(
    source: string,
    destination: string,
    options: { recursive: boolean },
  ): void;
  export function mkdtempSync(prefix: string): string;
  export function readFileSync(path: string, encoding: string): string;
  export function rmSync(
    path: string,
    options?: { force?: boolean; recursive?: boolean },
  ): void;
  export function writeFileSync(path: string, data: string): void;
}

declare module "node:child_process" {
  type SpawnResult = {
    status: number | null;
    stderr: string;
    stdout: string;
  };

  export function spawnSync(
    command: string,
    args: string[],
    options: {
      cwd: string;
      encoding: "utf8";
    },
  ): SpawnResult;
}

declare module "node:os" {
  export function tmpdir(): string;
}

declare module "node:path" {
  export function join(...paths: string[]): string;
}

declare const process: {
  execPath: string;
  platform: string;
};
