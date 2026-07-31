import type { ReactNode } from "react";
import { Button, Tooltip } from "antd";
import "./Pane.css";

interface PaneProps {
  label: string;
  icon: ReactNode;
  switchIcon: ReactNode;
  switchTooltip: string;
  onSwitch: () => void;
  children: ReactNode;
}

function Pane({ label, icon, switchIcon, switchTooltip, onSwitch, children }: PaneProps) {
  return (
    <section className="pane">
      <header className="pane-header">
        <span className="pane-label">
          <span className="pane-label-icon">{icon}</span>
          {label}
        </span>
        <Tooltip title={switchTooltip}>
          <Button
            type="text"
            size="small"
            className="pane-switch"
            icon={switchIcon}
            onClick={onSwitch}
            aria-label={switchTooltip}
          />
        </Tooltip>
      </header>
      <div className="pane-content">{children}</div>
    </section>
  );
}

export default Pane;
