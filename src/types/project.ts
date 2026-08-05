export interface ProjectInfo {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectMessage {
  role: string;
  content?: string | null;
}

export type ProjectMode = "code" | "mesh";

export interface ProjectData {
  id: string;
  name: string;
  /** CadQuery script source. Empty for mesh projects. */
  source: string;
  messages: ProjectMessage[];
  mode: ProjectMode;
  /** Normalized mesh (present only in mesh mode). */
  mesh?: {
    vertices: number[];
    faces: number[];
  } | null;
  /** Scale (unit conversion) applied to the mesh (mesh mode only). */
  scale?: number | null;
}
