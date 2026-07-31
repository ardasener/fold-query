import { useCallback, useEffect, useRef, useState } from "react";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import {
  CodeOutlined,
  EyeOutlined,
  MessageOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import TopBar from "./components/TopBar";
import Pane from "./components/Pane";
import CodeEditor from "./components/code-editor/CodeEditor";
import RunOutput from "./components/code-editor/RunOutput";
import ChatPanel from "./components/chat/ChatPanel";
import ViewerPanel from "./components/viewer/ViewerPanel";
import PrintPreview from "./components/print/PrintPreview";
import SettingsModal from "./components/settings/SettingsModal";
import PythonSetupModal, { type SetupStep } from "./components/python/PythonSetupModal";
import PythonErrorModal from "./components/python/PythonErrorModal";
import type {
  MissingComponent,
  ScriptResult,
  SetupProgressEvent,
  SetupStatus,
} from "./types/python";
import "./App.css";

const SAMPLE_SCRIPT = `import cadquery as cq

# A box with chamfered vertical edges
result = (
    cq.Workplane("XY")
    .box(40, 40, 20)
    .edges("|Z")
    .chamfer(4)
)

show_object(result)
`;

type PythonPhase = "checking" | "setup" | "error" | "ready";
type LeftView = "editor" | "chat";
type RightView = "viewer" | "print";

const SETUP_ORDER = ["detect", "venv", "install", "verify"] as const;

function App() {
  const [phase, setPhase] = useState<PythonPhase>("checking");
  const [missing, setMissing] = useState<MissingComponent | null>(null);
  const [systemPython, setSystemPython] = useState<string | null>(null);
  const [setupSteps, setSetupSteps] = useState<SetupStep[]>([]);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupAttempt, setSetupAttempt] = useState(0);

  const [source, setSource] = useState(SAMPLE_SCRIPT);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<ScriptResult | null>(null);

  const [leftView, setLeftView] = useState<LeftView>("editor");
  const [rightView, setRightView] = useState<RightView>("viewer");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isReady = phase === "ready";

  const runSetup = useCallback(async () => {
    setPhase("setup");
    setSetupError(null);
    setSetupSteps([]);
    try {
      await invoke("setup_python");
      setPhase("ready");
    } catch (err) {
      setSetupError(String(err));
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const start = async () => {
      unlisten = await listen<SetupProgressEvent>("python-setup-progress", (event) => {
        const { step, message } = event.payload;
        setSetupSteps((prev) => {
          const idx = SETUP_ORDER.indexOf(step);
          if (idx < 0) return prev;
          return SETUP_ORDER.slice(0, idx + 1).map((s, i) => ({
            step: s,
            message: i === idx ? message : prev.find((p) => p.step === s)?.message ?? s,
            done: i < idx,
          }));
        });
      });
      if (disposed) return;

      const status = await invoke<SetupStatus>("check_python_setup");
      if (disposed) return;

      if (status.ready) {
        setPhase("ready");
      } else if (status.missing) {
        setMissing(status.missing);
        setSystemPython(status.systemPython);
        setPhase("error");
      } else {
        await runSetup();
      }
    };

    start();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [setupAttempt, runSetup]);

  const run = useCallback(async () => {
    if (!isReady || running) return;
    setRunning(true);
    try {
      const result = await invoke<ScriptResult>("run_cad_script", { source });
      setLastRun(result);
    } catch (err) {
      setLastRun({ stdout: "", error: String(err), objects: [] });
    } finally {
      setRunning(false);
    }
  }, [isReady, running, source]);

  // Run the sample script once when the workbench first becomes ready.
  const autoRan = useRef(false);
  useEffect(() => {
    if (isReady && !autoRan.current) {
      autoRan.current = true;
      void run();
    }
  }, [isReady, run]);

  const exitApp = useCallback(() => {
    void invoke("exit_app");
  }, []);

  const leftIsEditor = leftView === "editor";
  const rightIsViewer = rightView === "viewer";

  const split = useDefaultLayout({
    id: "foldquery-main-split",
    panelIds: ["left", "right"],
    storage: localStorage,
  });

  return (
    <div className="app">
      {phase === "checking" && (
        <PythonSetupModal checking steps={[]} error={null} onRetry={() => {}} onExit={exitApp} />
      )}
      {phase === "setup" && (
        <PythonSetupModal
          checking={false}
          steps={setupSteps}
          error={setupError}
          onRetry={() => setSetupAttempt((a) => a + 1)}
          onExit={exitApp}
        />
      )}
      {phase === "error" && missing && (
        <PythonErrorModal missing={missing} systemPython={systemPython} onExit={exitApp} />
      )}

      {isReady && (
        <>
          <TopBar
            onOpenSettings={() => setSettingsOpen(true)}
            onRun={run}
            canRun={!running}
            running={running}
          />
          <Group
            className="app-split"
            orientation="horizontal"
            defaultLayout={split.defaultLayout}
            onLayoutChanged={split.onLayoutChanged}
          >
            <Panel id="left" defaultSize="40" minSize="25">
              <Pane
                label={leftIsEditor ? "Code Editor" : "AI Chat"}
                icon={leftIsEditor ? <CodeOutlined /> : <MessageOutlined />}
                switchIcon={leftIsEditor ? <MessageOutlined /> : <CodeOutlined />}
                switchTooltip={leftIsEditor ? "Switch to AI Chat" : "Switch to Code Editor"}
                onSwitch={() => setLeftView(leftIsEditor ? "chat" : "editor")}
              >
                {leftIsEditor ? (
                  <div className="editor-stack">
                    <CodeEditor value={source} onChange={setSource} />
                    {lastRun && <RunOutput result={lastRun} onDismiss={() => setLastRun(null)} />}
                  </div>
                ) : (
                  <ChatPanel />
                )}
              </Pane>
            </Panel>
            <Separator className="split-handle" />
            <Panel id="right" defaultSize="60" minSize="30">
              <Pane
                label={rightIsViewer ? "3D View" : "Print Preview"}
                icon={rightIsViewer ? <EyeOutlined /> : <PrinterOutlined />}
                switchIcon={rightIsViewer ? <PrinterOutlined /> : <EyeOutlined />}
                switchTooltip={rightIsViewer ? "Switch to Print Preview" : "Switch to 3D View"}
                onSwitch={() => setRightView(rightIsViewer ? "print" : "viewer")}
              >
                {rightIsViewer ? <ViewerPanel objects={lastRun?.objects ?? null} /> : <PrintPreview />}
              </Pane>
            </Panel>
          </Group>
          <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </>
      )}
    </div>
  );
}

export default App;
