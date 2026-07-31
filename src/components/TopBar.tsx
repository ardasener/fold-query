import { useState } from "react";
import { Button, Dropdown, Tooltip } from "antd";
import {
  CaretRightOutlined,
  DownOutlined,
  FolderOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { isMacOS } from "../lib/platform";
import "./TopBar.css";

const PROJECTS = ["Fox head", "Gift box", "Low-poly vase", "Ornament"];

interface TopBarProps {
  onOpenSettings: () => void;
  onRun: () => void;
  canRun: boolean;
  running: boolean;
}

function TopBar({ onOpenSettings, onRun, canRun, running }: TopBarProps) {
  const [project, setProject] = useState(PROJECTS[0]);

  return (
    <div
      className="top-bar"
      data-tauri-drag-region
      style={{ paddingLeft: isMacOS() ? 80 : 12 }}
    >
      <Dropdown
        trigger={["click"]}
        menu={{
          items: PROJECTS.map((name) => ({ key: name, label: name })),
          selectable: true,
          selectedKeys: [project],
          onClick: ({ key }) => setProject(key),
        }}
      >
        <Button type="text" className="top-bar-button">
          <FolderOutlined />
          <span>{project}</span>
          <DownOutlined className="top-bar-caret" />
        </Button>
      </Dropdown>
      <div className="top-bar-spacer" data-tauri-drag-region />
      <Tooltip title={running ? "Running…" : "Run the CadQuery script"}>
        <Button
          type="text"
          icon={<CaretRightOutlined />}
          className="top-bar-button"
          onClick={onRun}
          disabled={!canRun}
          loading={running}
          aria-label="Run script"
        />
      </Tooltip>
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
