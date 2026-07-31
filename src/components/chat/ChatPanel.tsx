import { useRef, useState } from "react";
import { Bubble, Prompts, Sender } from "@ant-design/x";
import { BulbOutlined, CodeOutlined, ExpandOutlined } from "@ant-design/icons";
import "./ChatPanel.css";

interface ChatMessage {
  key: number;
  role: "user" | "ai";
  content: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    key: 0,
    role: "ai",
    content:
      "Hi! I can write CadQuery code for your models and prepare them for papercraft. What would you like to build?",
  },
];

const PROMPTS = [
  { key: "unfold", icon: <ExpandOutlined />, label: "Unfold this model" },
  { key: "tabs", icon: <CodeOutlined />, label: "Add glue tabs" },
  { key: "pack", icon: <BulbOutlined />, label: "Optimize sheet packing" },
];

const CANNED_REPLY =
  "This is a mock response — in a future release the agent will write and run CadQuery code to do that.";

function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const nextKey = useRef(INITIAL_MESSAGES.length);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((prev) => [
      ...prev,
      { key: nextKey.current, role: "user", content: trimmed },
      { key: nextKey.current + 1, role: "ai", content: CANNED_REPLY },
    ]);
    nextKey.current += 2;
    setInput("");
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        <Bubble.List
          items={messages.map((m) => ({ key: m.key, role: m.role, content: m.content }))}
        />
      </div>
      <div className="chat-footer">
        <Prompts
          wrap
          items={PROMPTS}
          onItemClick={({ data }) => send(String(data.label))}
        />
        <Sender
          value={input}
          onChange={setInput}
          onSubmit={send}
          placeholder="Ask for a model, an unfold, or an export…"
        />
      </div>
    </div>
  );
}

export default ChatPanel;
