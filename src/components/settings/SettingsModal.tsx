import { useEffect, useState } from "react";
import { CheckOutlined } from "@ant-design/icons";
import { Button, InputNumber, Modal, Select, Tag, Tooltip } from "antd";
import { invoke } from "@tauri-apps/api/core";
import { PALETTES } from "../../themes/palettes";
import {
  EDITOR_FONT_OPTIONS,
  EDITOR_SIZE_MAX,
  EDITOR_SIZE_MIN,
  HISTORY_BUDGET_DEFAULT,
  HISTORY_BUDGET_MAX,
  HISTORY_BUDGET_MIN,
  UI_FONT_OPTIONS,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  UI_SCALE_STEP,
  clampHistoryBudget,
  snapUiScale,
  useSettings,
} from "../../settings/SettingsContext";
import { EDITOR_FONT_STACKS } from "../../themes/codemirror";
import ProviderModal from "./ProviderModal";
import "./SettingsModal.css";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { settings, update } = useSettings();
  const [providerOpen, setProviderOpen] = useState(false);
  const [providerConfigured, setProviderConfigured] = useState(false);

  const providerReady =
    settings.provider.url.trim().length > 0 && settings.provider.model.trim().length > 0;

  useEffect(() => {
    if (open) {
      invoke<boolean>("get_provider_status")
        .then(setProviderConfigured)
        .catch(() => setProviderConfigured(false));
    }
  }, [open, providerOpen]);

  return (
    <Modal
      title="Settings"
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      centered
    >
      {/* Palette CSS variables live on the document root, so the portal
          content inherits theme colors automatically. */}
      <section className="settings-section">
          <h3 className="settings-section-title">Appearance</h3>

          <div className="settings-field">
            <span className="settings-label">Theme</span>
            <div className="theme-grid">
              {PALETTES.map((p) => {
                const selected = settings.themeId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`theme-card${selected ? " theme-card-active" : ""}`}
                    onClick={() => update({ themeId: p.id })}
                    style={selected ? { borderColor: p.primary } : undefined}
                    aria-pressed={selected}
                  >
                    <span className="theme-card-dots">
                      <i style={{ background: p.bg }} />
                      <i style={{ background: p.surface }} />
                      <i style={{ background: p.text }} />
                      <i style={{ background: p.primary }} />
                    </span>
                    <span className="theme-card-name">{p.name}</span>
                    {selected && (
                      <span
                        className="theme-card-check"
                        style={{ background: p.primary, color: p.primaryText }}
                      >
                        <CheckOutlined />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="settings-field">
            <span className="settings-label">UI font</span>
            <Select
              value={settings.uiFont}
              onChange={(uiFont) => update({ uiFont })}
              style={{ width: 220 }}
              options={UI_FONT_OPTIONS.map((o) => ({
                value: o.id,
                label: o.name,
              }))}
            />
          </div>

          <div className="settings-field">
            <span className="settings-label">UI scale</span>
            <Tooltip title="Relational text size multiplier">
              <InputNumber
                value={settings.uiScale}
                min={UI_SCALE_MIN}
                max={UI_SCALE_MAX}
                step={UI_SCALE_STEP}
                addonAfter="×"
                onChange={(v) => update({ uiScale: snapUiScale(v ?? 1) })}
              />
            </Tooltip>
          </div>
        </section>

        <section className="settings-section">
          <h3 className="settings-section-title">AI Provider</h3>

          <div className="settings-field">
            <span className="settings-label">Provider</span>
            <Button onClick={() => setProviderOpen(true)}>Configure AI provider…</Button>
            {providerReady && providerConfigured && (
              <Tag color="success">Configured</Tag>
            )}
            {!providerConfigured && <Tag>Not configured</Tag>}
          </div>
          {providerReady && (
            <p className="settings-hint provider-summary">
              {settings.provider.model} @ {settings.provider.url}
            </p>
          )}

          <div className="settings-field">
            <span className="settings-label">Context</span>
            <Tooltip title="Character budget for the conversation history sent to the model (clamped 4 000–200 000)">
              <InputNumber
                value={settings.historyCharBudget}
                min={HISTORY_BUDGET_MIN}
                max={HISTORY_BUDGET_MAX}
                step={5_000}
                onChange={(v) => update({ historyCharBudget: clampHistoryBudget(v ?? HISTORY_BUDGET_DEFAULT) })}
              />
            </Tooltip>
            <span className="settings-hint">context budget (chars)</span>
          </div>
        </section>

        <section className="settings-section">
          <h3 className="settings-section-title">Editor</h3>

          <div className="settings-field">
            <span className="settings-label">Font</span>
            <Select
              value={settings.editorFont}
              onChange={(editorFont) => update({ editorFont })}
              style={{ width: 220 }}
              options={EDITOR_FONT_OPTIONS.map((o) => ({
                value: o.id,
                label: <span style={{ fontFamily: EDITOR_FONT_STACKS[o.id] }}>{o.name}</span>,
              }))}
            />
          </div>

          <div className="settings-field">
            <span className="settings-label">Size</span>
            <Tooltip title="Editor font size">
              <InputNumber
                value={settings.editorSize}
                min={EDITOR_SIZE_MIN}
                max={EDITOR_SIZE_MAX}
                onChange={(v) => update({ editorSize: v ?? 13 })}
              />
            </Tooltip>
          </div>
        </section>

        <ProviderModal open={providerOpen} onClose={() => setProviderOpen(false)} />
    </Modal>
  );
}
export default SettingsModal;
