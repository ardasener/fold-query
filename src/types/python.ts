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

export interface SetupStatus {
  ready: boolean;
  missing: MissingComponent | null;
  venvExists: boolean;
  systemPython: string | null;
}

export interface SetupProgressEvent {
  step: "detect" | "venv" | "install" | "verify";
  message: string;
}
