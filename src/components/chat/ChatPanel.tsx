import { useEffect, useRef, useState, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Bubble, Sender, Think } from "@ant-design/x";
import {
  BulbOutlined,
  CodeOutlined,
  PlayCircleOutlined,
  ReadOutlined,
  RobotOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar } from "antd";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useSettings } from "../../settings/SettingsContext";
import type { ProjectMessage } from "../../types/project";
import "./ChatPanel.css";

interface UserEntry {
  id: number;
  kind: "user";
  content: string;
}

interface AssistantEntry {
  id: number;
  kind: "assistant";
  content: string;
  streaming?: boolean;
}

interface ThinkEntry {
  id: number;
  kind: "think";
  title: string;
  icon: ReactNode;
  content: string;
  loading?: boolean;
  /** Controlled expand state (the Think component's internal state is unreliable under frequent entry updates). */
  expanded?: boolean;
  /** Thinking blocks are removed when the answer streams, unless they hold reasoning content. */
  transient?: boolean;
}

interface NoteEntry {
  id: number;
  kind: "note";
  content: string;
}

type ChatEntry = UserEntry | AssistantEntry | ThinkEntry | NoteEntry;

const TOOL_ICONS: Record<string, ReactNode> = {
  editing: <CodeOutlined />,
  running: <PlayCircleOutlined />,
  docs: <ReadOutlined />,
};

const TRIM_NOTE = "…older messages trimmed to keep the conversation focused";

interface ChatPanelProps {
  source: string;
  loadedChat: { projectId: string; messages: ProjectMessage[] } | null;
}

function ChatPanel({ source, loadedChat }: ChatPanelProps) {
  const { settings } = useSettings();
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [isPinned, setIsPinned] = useState(true);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const providerReady =
    settings.provider.url.trim().length > 0 && settings.provider.model.trim().length > 0;

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72,
    overscan: 8,
    getItemKey: (index) => entries[index].id,
  });

  // Scroll to the latest when pinned near the bottom.
  useEffect(() => {
    if (isPinned && entries.length > 0) {
      virtualizer.scrollToIndex(entries.length - 1, { align: "end" });
    }
  }, [entries, isPinned, virtualizer]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsPinned(distance < 80);
  };

  const updateLastLoadingThink = (patch: Partial<ThinkEntry>) => {
    setEntries((prev) => {
      const idx = [...prev].reverse().findIndex((e) => e.kind === "think" && e.loading);
      if (idx === -1) return prev;
      const i = prev.length - 1 - idx;
      const next = [...prev];
      next[i] = { ...(next[i] as ThinkEntry), ...patch };
      return next;
    });
  };

  const updateThink = (id: number, patch: Partial<ThinkEntry>) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id && e.kind === "think" ? { ...e, ...patch } : e)),
    );
  };

  // Place (or reposition) the context-boundary note after the Nth user entry.
  const applyTrimBoundary = (droppedUserMessages: number) => {
    setEntries((prev) => {
      const withoutNotes = prev.filter((e) => e.kind !== "note");
      let userCount = 0;
      let pos = withoutNotes.length;
      for (let i = 0; i < withoutNotes.length; i++) {
        if (withoutNotes[i].kind === "user") {
          userCount++;
          if (userCount === droppedUserMessages) {
            pos = i + 1;
            break;
          }
        }
      }
      if (pos === withoutNotes.length && userCount < droppedUserMessages) {
        return prev; // not enough user entries yet; nothing to mark
      }
      const note: NoteEntry = { id: nextId.current++, kind: "note", content: TRIM_NOTE };
      return [...withoutNotes.slice(0, pos), note, ...withoutNotes.slice(pos)];
    });
  };

  useEffect(() => {
    let disposed = false;
    const unlisteners: (() => void)[] = [];

    const register = async () => {
      const status = await listen<{ activity: string; label: string }>("agent-status", (e) => {
        const { activity, label } = e.payload;
        if (activity === "thinking") {
          setEntries((prev) => {
            const last = prev[prev.length - 1];
            if (last?.kind === "think" && last.loading) return prev;
            return [
              ...prev,
              {
                id: nextId.current++,
                kind: "think",
                title: "Thinking…",
                icon: <BulbOutlined />,
                content: "",
                loading: true,
                transient: true,
                expanded: false,
              },
            ];
          });
        } else {
          // Tool call: finalize the active block (dropping empty transient ones),
          // then append a tool Think.
          setEntries((prev) => {
            const finalized = prev
              .map((e) => (e.kind === "think" && e.loading ? { ...e, loading: false } : e))
              .filter((e) => !(e.kind === "think" && e.transient && e.content.trim() === ""));
            return [
              ...finalized,
              {
                id: nextId.current++,
                kind: "think",
                title: label,
                icon: TOOL_ICONS[activity] ?? <BulbOutlined />,
                content: "",
                loading: true,
                expanded: false,
              },
            ];
          });
        }
      });

      const reasoning = await listen<{ delta: string }>("agent-reasoning", (e) => {
        setEntries((prev) => {
          const idx = [...prev].reverse().findIndex((en) => en.kind === "think" && en.loading);
          if (idx === -1) {
            return [
              ...prev,
              {
                id: nextId.current++,
                kind: "think",
                title: "Thinking…",
                icon: <BulbOutlined />,
                content: e.payload.delta,
                loading: true,
                transient: true,
                expanded: false,
              },
            ];
          }
          const i = prev.length - 1 - idx;
          const think = prev[i] as ThinkEntry;
          if (!think.transient) {
            return [
              ...prev,
              {
                id: nextId.current++,
                kind: "think",
                title: "Thinking…",
                icon: <BulbOutlined />,
                content: e.payload.delta,
                loading: true,
                transient: true,
                expanded: false,
              },
            ];
          }
          const next = [...prev];
          next[i] = { ...think, content: think.content + e.payload.delta };
          return next;
        });
      });

      const toolResult = await listen<{ label: string; outcome: string }>(
        "agent-tool-result",
        (e) => {
          updateLastLoadingThink({ content: e.payload.outcome, loading: false });
        },
      );

      const token = await listen<{ delta: string }>("agent-token", (e) => {
        const delta = e.payload.delta;
        if (!delta) return;
        setEntries((prev) => {
          const settled = prev
            .map((en) =>
              en.kind === "think" && en.transient && en.loading && en.content.trim() !== ""
                ? { ...en, loading: false }
                : en,
            )
            .filter(
              (en) => !(en.kind === "think" && en.transient && en.loading && en.content.trim() === ""),
            );
          const last = settled[settled.length - 1];
          if (last?.kind === "assistant" && last.streaming) {
            const updated = [...settled];
            updated[updated.length - 1] = { ...last, content: last.content + delta };
            return updated;
          }
          return [
            ...settled,
            { id: nextId.current++, kind: "assistant", content: delta, streaming: true },
          ];
        });
      });

      const done = await listen<{ message: string }>("agent-done", (e) => {
        setEntries((prev) => {
          let next = prev.map((en) =>
            en.kind === "think" && en.loading ? { ...en, loading: false } : en,
          );
          next = next.filter(
            (en) =>
              !(en.kind === "think" && en.transient && en.content.trim() === "") &&
              !(en.kind === "think" && !en.transient && en.content.trim() === ""),
          );
          const last = next[next.length - 1];
          if (last?.kind === "assistant" && last.streaming) {
            if (last.content.trim() === "") {
              next.pop();
            } else {
              next[next.length - 1] = { ...last, streaming: false };
            }
          } else if (e.payload.message.trim()) {
            next = [
              ...next,
              { id: nextId.current++, kind: "assistant", content: e.payload.message },
            ];
          }
          return next;
        });
        setBusy(false);
      });

      const trimmed = await listen<{ droppedUserMessages: number }>(
        "agent-context-trimmed",
        (e) => {
          applyTrimBoundary(e.payload.droppedUserMessages);
        },
      );

      if (disposed) {
        status();
        reasoning();
        toolResult();
        token();
        done();
        trimmed();
        return;
      }
      unlisteners.push(status, reasoning, toolResult, token, done, trimmed);
    };

    void register();
    return () => {
      disposed = true;
      unlisteners.forEach((u) => u());
    };
  }, []);

  // Rebuild the display from a freshly loaded project's conversation.
  useEffect(() => {
    if (!loadedChat) return;
    const rebuilt: ChatEntry[] = [];
    for (const m of loadedChat.messages) {
      if (m.role === "user") {
        rebuilt.push({ id: nextId.current++, kind: "user", content: m.content ?? "" });
      } else if (m.role === "assistant") {
        const content = m.content ?? "";
        if (content.trim()) {
          rebuilt.push({ id: nextId.current++, kind: "assistant", content });
        }
      } else if (m.role === "tool") {
        rebuilt.push({
          id: nextId.current++,
          kind: "think",
          title: "Tool result",
          icon: <BulbOutlined />,
          content: m.content ?? "",
          expanded: false,
        });
      }
    }
    setEntries(rebuilt);
    setInput("");
    setBusy(false);
    setIsPinned(true);
  }, [loadedChat]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setEntries((prev) => [
      ...prev,
      { id: nextId.current++, kind: "user", content: trimmed },
    ]);
    setInput("");
    setBusy(true);
    try {
      await invoke("chat_message", {
        input: {
          message: trimmed,
          source,
          url: settings.provider.url,
          model: settings.provider.model,
          contextBudget: settings.historyCharBudget,
        },
      });
    } catch (err) {
      setEntries((prev) => [
        ...prev,
        { id: nextId.current++, kind: "assistant", content: `⚠ ${String(err)}` },
      ]);
      setBusy(false);
    }
  };

  const renderEntry = (e: ChatEntry) => {
    if (e.kind === "user") {
      return (
        <Bubble
          placement="end"
          avatar={<Avatar icon={<UserOutlined />} />}
          header="User"
          content={e.content}
        />
      );
    }
    if (e.kind === "assistant") {
      return (
        <Bubble
          placement="start"
          avatar={<Avatar icon={<RobotOutlined />} />}
          header="Agent"
          content={e.content}
        />
      );
    }
    if (e.kind === "note") {
      return <div className="chat-trim-note">{e.content}</div>;
    }
    return (
      <Think
        title={e.title}
        icon={e.icon}
        loading={e.loading}
        expanded={e.expanded}
        onExpand={(next) => updateThink(e.id, { expanded: next })}
        destroyOnHidden={false}
      >
        {e.content}
      </Think>
    );
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages" ref={scrollRef} onScroll={handleScroll}>
        {entries.length === 0 && (
          <div className="chat-empty">
            {providerReady
              ? "Ask the agent to create or modify the CadQuery model. It can edit the code, run it, and consult CadQuery docs."
              : "Configure an AI provider in Settings → AI Provider to start chatting."}
          </div>
        )}
        {entries.length > 0 && (
          <div className="chat-virtual" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((vi) => (
              <div
                key={vi.key}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                className="chat-item"
                style={{ transform: `translateY(${vi.start}px)` }}
              >
                {renderEntry(entries[vi.index])}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="chat-footer">
        <Sender
          value={input}
          onChange={setInput}
          onSubmit={send}
          loading={busy}
          disabled={!providerReady}
          placeholder={
            providerReady
              ? "Ask for a model, an edit, or an unfold…"
              : "Set up an AI provider in Settings first"
          }
        />
      </div>
    </div>
  );
}

export default ChatPanel;
