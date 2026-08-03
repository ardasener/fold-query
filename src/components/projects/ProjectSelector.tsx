import { useMemo, useState } from "react";
import { Button, Input, Popover } from "antd";
import {
  CaretDownOutlined,
  EditOutlined,
  FolderOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { ProjectInfo } from "../../types/project";
import "./ProjectSelector.css";

interface ProjectSelectorProps {
  projects: ProjectInfo[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onEdit: (project: ProjectInfo) => void;
}

function ProjectSelector({ projects, activeId, onSelect, onCreate, onEdit }: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const active = projects.find((p) => p.id === activeId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, query]);

  const content = (
    <div className="project-popover">
      <div className="project-search-row">
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search projects…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          allowClear
        />
        <Button
          icon={<PlusOutlined />}
          onClick={onCreate}
          aria-label="New project"
          title="New project"
        />
      </div>
      <div className="project-list">
        {filtered.length === 0 && <div className="project-empty">No projects</div>}
        {filtered.map((p) => (
          <div key={p.id} className={`project-row${p.id === activeId ? " project-row-active" : ""}`}>
            <button
              type="button"
              className="project-row-main"
              onClick={() => {
                onSelect(p.id);
                setOpen(false);
              }}
            >
              <FolderOutlined className="project-row-icon" />
              <span className="project-row-name">{p.name}</span>
            </button>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(p)}
              aria-label={`Edit ${p.name}`}
              title={`Edit ${p.name}`}
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomLeft"
      overlayClassName="project-popover-overlay"
    >
      <Button type="text" className="top-bar-button">
        <FolderOutlined />
        <span>{active?.name ?? "No project"}</span>
        <CaretDownOutlined className="top-bar-caret" />
      </Button>
    </Popover>
  );
}

export default ProjectSelector;
