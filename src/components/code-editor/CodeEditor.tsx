import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { useSettings } from "../../settings/SettingsContext";
import { cmTheme } from "../../themes/codemirror";
import "./CodeEditor.css";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
}

function CodeEditor({ value, onChange }: CodeEditorProps) {
  const { settings, palette } = useSettings();
  return (
    <div className="code-editor">
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={[python()]}
        theme={cmTheme(palette, settings.editorFont, settings.editorSize)}
        height="100%"
        basicSetup={{ lineNumbers: true }}
      />
    </div>
  );
}

export default CodeEditor;
