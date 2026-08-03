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

export interface ProjectData {
  id: string;
  name: string;
  source: string;
  messages: ProjectMessage[];
}
