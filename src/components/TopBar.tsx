import { Button, message, Tooltip } from "antd";
import {
  CaretRightOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { isMacOS } from "../lib/platform";
import type { ProjectInfo } from "../types/project";
import type { ScriptResult } from "../types/python";
import ProjectSelector from "./projects/ProjectSelector";
import "./TopBar.css";

interface TopBarProps {
  projects: ProjectInfo[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onImportProject: () => void;
  onEditProject: (project: ProjectInfo) => void;
  onOpenSettings: () => void;
  onRun: () => void;
  canRun: boolean;
  running: boolean;
  runStatus: ScriptResult | null;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
  }
}

function TopBar({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onImportProject,
  onEditProject,
  onOpenSettings,
  onRun,
  canRun,
  running,
  runStatus,
}: TopBarProps) {
  const copyError = async () => {
    if (!runStatus?.error) return;
    await copyText(runStatus.error);
    void message.success("Error message copied to clipboard");
  };

  return (
    <div
      className="top-bar"
      data-tauri-drag-region
      style={{ paddingLeft: isMacOS() ? 80 : 12 }}
    >
      <ProjectSelector
        projects={projects}
        activeId={activeProjectId}
        onSelect={onSelectProject}
        onCreate={onCreateProject}
        onImport={onImportProject}
        onEdit={onEditProject}
      />
      <div className="top-bar-spacer" data-tauri-drag-region />
      <Tooltip title={running ? "Running…" : "Run the CadQuery script"}>
        <Button
          type="text"
          icon={<CaretRightOutlined />}
          className="top-bar-button"
          onClick={() => onRun()}
          disabled={!canRun}
          loading={running}
          aria-label="Run script"
        />
      </Tooltip>
      {runStatus && (
        <Tooltip title={runStatus.error ? runStatus.error : "Run succeeded"}>
          <Button
            type="text"
            className="top-bar-button top-bar-status"
            icon={
              runStatus.error ? (
                <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
              ) : (
                <CheckCircleOutlined style={{ color: "#52c41a" }} />
              )
            }
            onClick={copyError}
            aria-label={runStatus.error ? "Copy error message" : "Run succeeded"}
          />
        </Tooltip>
      )}
      <Tooltip title="Settings">
        <Button
          type="text"
          icon={<SettingOutlined />}
          className="top-bar-button"
          onClick={onOpenSettings}
          aria-label="Settings"
        />
      </Tooltip>
    </div>
  );
}

export default TopBar;
