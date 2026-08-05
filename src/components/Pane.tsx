import type { ReactNode } from "react";
import { Button, Tooltip } from "antd";
import "./Pane.css";

interface PaneProps {
  label: string;
  icon: ReactNode;
  /** Hidden when no view switch is available (e.g. mesh projects). */
  switchIcon?: ReactNode;
  switchTooltip?: string;
  onSwitch?: () => void;
  /** Optional actions rendered in the header before the switch icon. */
  extra?: ReactNode;
  children: ReactNode;
}

function Pane({ label, icon, switchIcon, switchTooltip, onSwitch, extra, children }: PaneProps) {
  return (
    <section className="pane">
      <header className="pane-header">
        <span className="pane-label">
          <span className="pane-label-icon">{icon}</span>
          {label}
        </span>
        <span className="pane-actions">
          {extra}
          {switchIcon && onSwitch && (
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
          )}
        </span>
      </header>
      <div className="pane-content">{children}</div>
    </section>
  );
}

export default Pane;
