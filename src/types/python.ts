export interface MeshObject {
  vertices: number[];
  faces: number[];
}

export interface ScriptResult {
  stdout: string;
  error: string | null;
  objects: MeshObject[];
}

export type MissingComponent = "python" | "python-version" | "venv" | "pip";

/** Which environment source is active/being provisioned. */
export type EnvSource = "micromamba" | "venv" | "system" | "none";

export interface SetupStatus {
  ready: boolean;
  missing: MissingComponent | null;
  venvExists: boolean;
  systemPython: string | null;
  envSource: EnvSource;
}

export interface SetupProgressEvent {
  step: "detect" | "venv" | "install" | "verify";
  message: string;
}
