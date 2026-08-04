import { Alert, Button, Modal, Spin } from "antd";
import { CheckOutlined } from "@ant-design/icons";
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
  onRetry: () => void;
  onExit: () => void;
}

function PythonSetupModal({ checking, steps, error, onRetry, onExit }: PythonSetupModalProps) {
  const active = steps.find((s) => !s.done);

  return (
    <Modal
      open
      title="Python environment"
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
          <p className="setup-message">Checking Python environment…</p>
        </div>
      ) : error ? (
        <div className="setup-error">
          <Alert type="error" showIcon message="Python setup failed" description={error} />
          <p className="setup-message">You can retry, or exit and fix the environment manually.</p>
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
          {active && <p className="setup-message">This can take a few minutes on first run.</p>}
        </div>
      )}
    </Modal>
  );
}

export default PythonSetupModal;
