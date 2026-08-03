import { useState } from "react";
import { Alert, Button, Form, Input, Modal, Tag } from "antd";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_PROVIDER_URL, useSettings } from "../../settings/SettingsContext";
import "./ProviderModal.css";

interface ProviderModalProps {
  open: boolean;
  onClose: () => void;
}

function ProviderModal({ open, onClose }: ProviderModalProps) {
  const { settings, update } = useSettings();
  const [url, setUrl] = useState(settings.provider.url || DEFAULT_PROVIDER_URL);
  const [model, setModel] = useState(settings.provider.model);
  const [key, setKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [configured, setConfigured] = useState(false);

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await invoke("test_provider", { input: { url, model, key } });
      setTestResult({ ok: true, message: "Connection successful. You can save." });
    } catch (err) {
      setTestResult({ ok: false, message: String(err) });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await invoke("save_provider", { input: { url, model, key } });
      update({ provider: { url, model } });
      setConfigured(true);
      setKey("");
      onClose();
    } catch (err) {
      setTestResult({ ok: false, message: String(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="AI Provider"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="test" onClick={test} loading={testing}>
          Test Connection
        </Button>,
        <Button key="save" type="primary" onClick={save} loading={saving} disabled={!key.trim()}>
          Save
        </Button>,
      ]}
      centered
    >
      <Form layout="vertical">
        <Form.Item label="Base URL" required>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </Form.Item>
        <Form.Item label="Model" required>
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g. opencode-go/deepseek-v4-flash"
          />
        </Form.Item>
        <Form.Item label="API key" required>
          <Input.Password
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Enter your API key"
            autoComplete="off"
          />
        </Form.Item>
      </Form>

      {configured && (
        <Tag color="success" className="provider-tag">
          Provider configured
        </Tag>
      )}
      {testResult && (
        <Alert
          type={testResult.ok ? "success" : "error"}
          showIcon
          message={testResult.message}
          className="provider-test-result"
        />
      )}
      <p className="provider-note">
        The API key is stored in your system keychain and never displayed again. URL and model are
        saved with your settings.
      </p>
    </Modal>
  );
}

export default ProviderModal;
