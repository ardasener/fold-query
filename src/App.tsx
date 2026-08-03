import { useCallback, useEffect, useRef, useState } from "react";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import {
  CodeOutlined,
  EyeOutlined,
  MessageOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import { uniqueNamesGenerator, adjectives, animals } from "unique-names-generator";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import TopBar from "./components/TopBar";
import Pane from "./components/Pane";
import CodeEditor from "./components/code-editor/CodeEditor";
import ChatPanel from "./components/chat/ChatPanel";
import ViewerPanel from "./components/viewer/ViewerPanel";
import PrintPreview from "./components/print/PrintPreview";
import SettingsModal from "./components/settings/SettingsModal";
import ProjectEditModal from "./components/projects/ProjectEditModal";
import PythonSetupModal, { type SetupStep } from "./components/python/PythonSetupModal";
import PythonErrorModal from "./components/python/PythonErrorModal";
import type { ProjectData, ProjectInfo } from "./types/project";
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

const generateProjectName = () =>
  uniqueNamesGenerator({ dictionaries: [adjectives, animals], separator: "-" });

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

  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<ProjectInfo | null>(null);
  const [loadedChat, setLoadedChat] = useState<{
    projectId: string;
    messages: ProjectData["messages"];
  } | null>(null);
  const saveTimer = useRef<number | null>(null);

  const [leftView, setLeftView] = useState<LeftView>("editor");
  const [rightView, setRightView] = useState<RightView>("viewer");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isReady = phase === "ready";

  const refreshProjects = useCallback(async () => {
    const list = await invoke<ProjectInfo[]>("list_projects");
    setProjects(list);
    return list;
  }, []);

  const flushSourceSave = useCallback(async () => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (activeProjectId) {
      await invoke("save_project_source", { id: activeProjectId, source });
    }
  }, [activeProjectId, source]);

  // Debounced save of the editor source. Uses a ref for the active project so
  // the callback stays stable for the agent-event listeners.
  const activeProjectIdRef = useRef(activeProjectId);
  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);

  const handleSourceChange = useCallback((value: string) => {
    setSource(value);
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      const pid = activeProjectIdRef.current;
      if (pid) {
        void invoke("save_project_source", { id: pid, source: value });
      }
    }, 1000);
  }, []);

  const run = useCallback(async (sourceOverride?: string) => {
    if (!isReady || running) return;
    const sourceToRun = sourceOverride ?? source;
    setRunning(true);
    try {
      const result = await invoke<ScriptResult>("run_cad_script", { source: sourceToRun });
      setLastRun(result);
    } catch (err) {
      setLastRun({ stdout: "", error: String(err), objects: [] });
    } finally {
      setRunning(false);
    }
  }, [isReady, running, source]);

  const loadProject = useCallback(
    async (id: string) => {
      await flushSourceSave();
      const data = await invoke<ProjectData>("load_project", { id });
      setSource(data.source);
      setActiveProjectId(data.id);
      setLoadedChat({ projectId: data.id, messages: data.messages });
      await refreshProjects();
      // Run the loaded project's script so the viewer reflects it.
      void run(data.source);
    },
    [flushSourceSave, refreshProjects, run],
  );

  const createProject = useCallback(async () => {
    const name = generateProjectName();
    const created = await invoke<ProjectInfo>("create_project", { name });
    await loadProject(created.id);
    await refreshProjects();
  }, [loadProject, refreshProjects]);

  const renameProject = useCallback(
    async (id: string, name: string) => {
      await invoke("rename_project", { id, name });
      await refreshProjects();
    },
    [refreshProjects],
  );

  const deleteProject = useCallback(async () => {
    if (!editTarget) return;
    await invoke("delete_project", { id: editTarget.id });
    if (editTarget.id === activeProjectId) {
      const list = await refreshProjects();
      if (list.length > 0) {
        await loadProject(list[0].id);
      } else {
        const name = generateProjectName();
        const created = await invoke<ProjectInfo>("create_project", { name });
        await loadProject(created.id);
      }
    } else {
      await refreshProjects();
    }
    setEditTarget(null);
  }, [activeProjectId, editTarget, loadProject, refreshProjects]);

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

  // Ensure a default project exists once the workbench is ready, then load it.
  // Runs exactly once: re-running on callback-identity changes (which shift as
  // the active project/source change) caused an endless load loop, because
  // each load's flush reorders the project list by updatedAt.
  const loadProjectRef = useRef(loadProject);
  const refreshProjectsRef = useRef(refreshProjects);
  useEffect(() => {
    loadProjectRef.current = loadProject;
    refreshProjectsRef.current = refreshProjects;
  });
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (!isReady || bootstrapped.current) return;
    bootstrapped.current = true;
    let cancelled = false;
    (async () => {
      let list = await refreshProjectsRef.current();
      if (list.length === 0) {
        const name = generateProjectName();
        const created = await invoke<ProjectInfo>("create_project", { name });
        list = [created];
      }
      if (!cancelled && list.length > 0) {
        await loadProjectRef.current(list[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isReady]);

  // Sync the editor and viewer from agent activity.
  useEffect(() => {
    let disposed = false;
    const unlisteners: (() => void)[] = [];

    const register = async () => {
      const codeUpdated = await listen<{ source: string }>("agent-code-updated", (e) => {
        handleSourceChange(e.payload.source);
      });
      const done = await listen<{ message: string; source: string; scriptResult: ScriptResult | null }>(
        "agent-done",
        (e) => {
          if (e.payload.source) handleSourceChange(e.payload.source);
          if (e.payload.scriptResult) setLastRun(e.payload.scriptResult);
        },
      );
      if (disposed) {
        codeUpdated();
        done();
        return;
      }
      unlisteners.push(codeUpdated, done);
    };

    void register();
    return () => {
      disposed = true;
      unlisteners.forEach((u) => u());
    };
  }, []);

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
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={(id) => void loadProject(id)}
            onCreateProject={() => void createProject()}
            onEditProject={setEditTarget}
            onOpenSettings={() => setSettingsOpen(true)}
            onRun={run}
            canRun={!running}
            running={running}
            runStatus={lastRun}
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
                {/*
                  Both views stay mounted so their state (chat messages,
                  editor cursor, scroll) survives pane switches; visibility
                  is toggled with CSS instead of unmounting.
                */}
                <div className={leftIsEditor ? "pane-view" : "pane-view pane-view-hidden"}>
                  <CodeEditor value={source} onChange={handleSourceChange} />
                </div>
                <div className={leftIsEditor ? "pane-view pane-view-hidden" : "pane-view"}>
                  <ChatPanel source={source} loadedChat={loadedChat} />
                </div>
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
                <div className={rightIsViewer ? "pane-view" : "pane-view pane-view-hidden"}>
                  <ViewerPanel objects={lastRun?.objects ?? null} />
                </div>
                <div className={rightIsViewer ? "pane-view pane-view-hidden" : "pane-view"}>
                  <PrintPreview />
                </div>
              </Pane>
            </Panel>
          </Group>
          <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
          <ProjectEditModal
            project={editTarget}
            onClose={() => setEditTarget(null)}
            onRename={(id, name) => void renameProject(id, name)}
            onDelete={() => void deleteProject()}
          />
        </>
      )}
    </div>
  );
}

export default App;
