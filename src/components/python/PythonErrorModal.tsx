import { Alert, Button, Modal, Typography } from "antd";
import { isMacOS } from "../../lib/platform";
import type { MissingComponent } from "../../types/python";
import "./PythonErrorModal.css";

const { Paragraph, Text } = Typography;

interface PythonErrorModalProps {
  missing: MissingComponent;
  systemPython: string | null;
  onExit: () => void;
}

const COPY: Record<MissingComponent, { title: string; body: string }> = {
  python: {
    title: "Python is required",
    body: "FoldQuery needs Python 3.11 or newer to generate and unfold models, but it wasn't found on this system.",
  },
  "python-version": {
    title: "Python version is too old",
    body: "FoldQuery needs Python 3.11 or newer, but an older version was found. Please install a supported version.",
  },
  venv: {
    title: "The Python venv module is missing",
    body: "FoldQuery creates an isolated environment with the `venv` module. On some Linux distributions you may need to install the `python3-venv` package.",
  },
  pip: {
    title: "The Python pip module is missing",
    body: "FoldQuery installs CadQuery with `pip`, but it isn't available in the detected Python. Please install it (e.g. `python3 -m ensurepip`).",
  },
};

const INSTALL_STEPS = [
  {
    os: "macOS",
    commands: [
      'brew install python@3.12',
      'brew link --overwrite python@3.12',
    ],
  },
  {
    os: "Ubuntu / Debian",
    commands: ['sudo apt update', 'sudo apt install -y python3 python3-venv python3-pip'],
  },
  {
    os: "Windows",
    commands: ['winget install Python.Python.3.12'],
  },
];

function PythonErrorModal({ missing, systemPython, onExit }: PythonErrorModalProps) {
  const copy = COPY[missing];

  return (
    <Modal
      open
      title={copy.title}
      closable={false}
      mask={{ closable: false }}
      keyboard={false}
      footer={[
        <Button key="exit" danger type="primary" onClick={onExit}>
          Exit
        </Button>,
      ]}
      centered
    >
      <Paragraph className="python-error-body">{copy.body}</Paragraph>
      {systemPython && (
        <Paragraph className="python-error-detail">
          Detected Python: <Text code>{systemPython}</Text>
        </Paragraph>
      )}
      <Alert
        className="python-error-alert"
        type="info"
        showIcon
        message={
          <span>
            Download Python from{" "}
            <a href="https://www.python.org/downloads/" target="_blank" rel="noreferrer">
              python.org
            </a>
          </span>
        }
      />
      <div className="python-error-steps">
        {INSTALL_STEPS.map((step) => (
          <div key={step.os} className="python-error-step">
            <Typography.Text strong>{step.os}</Typography.Text>
            <pre className="python-error-commands">{step.commands.join("\n")}</pre>
          </div>
        ))}
        {isMacOS() && (
          <Paragraph className="python-error-note">
            If you already installed Python, restart the app so it can find it on your PATH.
          </Paragraph>
        )}
      </div>
    </Modal>
  );
}

export default PythonErrorModal;
