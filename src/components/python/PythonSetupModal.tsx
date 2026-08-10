import { Alert, Button, Modal, Spin } from "antd";
import { CheckOutlined } from "@ant-design/icons";
import type { EnvSource } from "../../types/python";
import "./PythonSetupModal.css";

export interface SetupStep {
  step: string;
  message: string;
  done: boolean;
}

interface PythonSetupModalProps {
  checking: boolean;
  steps: SetupStep[];
  error: string | null;
  envSource: EnvSource;
  onRetry: () => void;
  onExit: () => void;
}

/** Human-readable label for the active environment source. */
export function envSourceLabel(envSource: EnvSource): string {
  switch (envSource) {
    case "micromamba":
      return "Preparing the bundled environment (micromamba).";
    case "venv":
      return "Using your existing environment.";
    case "system":
      return "Using your system Python as a fallback (micromamba unavailable).";
    default:
      return "";
  }
}

function PythonSetupModal({ checking, steps, error, envSource, onRetry, onExit }: PythonSetupModalProps) {
  const active = steps.find((s) => !s.done);
  const sourceNote = envSourceLabel(envSource);

  return (
    <Modal
      open
      title="Environment"
      closable={false}
      mask={{ closable: false }}
      keyboard={false}
      footer={
        error
          ? [
              <Button key="retry" type="primary" onClick={onRetry}>
                Retry
              </Button>,
              <Button key="exit" danger onClick={onExit}>
                Exit
              </Button>,
            ]
          : null
      }
      centered
    >
      {checking ? (
        <div className="setup-center">
          <Spin size="large" />
          <p className="setup-message">Checking environment…</p>
        </div>
      ) : error ? (
        <div className="setup-error">
          <Alert type="error" showIcon message="Environment setup failed" description={error} />
          <p className="setup-message">
            Micromamba provisioning was tried first, then your system Python. You can retry, or
            exit and fix the environment manually.
          </p>
        </div>
      ) : (
        <div className="setup-steps">
          {steps.map((s) => (
            <div key={s.step} className={`setup-step${s.done ? " setup-step-done" : ""}${s === active ? " setup-step-active" : ""}`}>
              <span className="setup-step-icon">
                {s.done ? <CheckOutlined /> : <Spin size="small" />}
              </span>
              <span className="setup-step-message">{s.message}</span>
            </div>
          ))}
          {sourceNote && <p className="setup-source-note">{sourceNote}</p>}
          {active && <p className="setup-message">This only happens once — future launches are instant.</p>}
        </div>
      )}
    </Modal>
  );
}

export default PythonSetupModal;
