import { Button } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import type { ScriptResult } from "../../types/python";
import "./RunOutput.css";

interface RunOutputProps {
  result: ScriptResult;
  onDismiss: () => void;
}

function RunOutput({ result, onDismiss }: RunOutputProps) {
  const hasStdout = result.stdout.trim().length > 0;

  return (
    <div className="run-output">
      <div className="run-output-header">
        <span className={`run-output-status${result.error ? " run-output-status-error" : ""}`}>
          {result.error ? "Run failed" : "Run succeeded"}
        </span>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={onDismiss}
          aria-label="Dismiss output"
          className="run-output-dismiss"
        />
      </div>
      {result.error && <pre className="run-output-error">{result.error}</pre>}
      {hasStdout && <pre className="run-output-stdout">{result.stdout}</pre>}
      {!hasStdout && !result.error && (
        <p className="run-output-empty">No output. Edit the script and run again.</p>
      )}
    </div>
  );
}

export default RunOutput;
