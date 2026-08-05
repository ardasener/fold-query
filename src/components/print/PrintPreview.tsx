import { Alert, Button, InputNumber, Select, Spin, Tooltip } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import {
  islandBounds,
  layoutPagesBestFit,
  overflowIslands,
  type PrintPage,
} from "../../lib/net-layout";
import { buildPrintDocument, PRINT_ROOT_ID } from "../../lib/net-print";
import { getPaper, PAPER_SIZES, PRINT_MARGIN_MM, usableAreaMm, type PaperSize, type PaperSizeId } from "../../lib/paper";
import { UNFOLD_TARGET_MAX, UNFOLD_TARGET_MIN, useSettings } from "../../settings/SettingsContext";
import type { MeshObject } from "../../types/python";
import type { Net } from "../../types/unfold";
import "./PrintPreview.css";

interface PrintPreviewProps {
  /** The mesh to unfold (typically `lastRun.objects[0]`), or null if none. */
  mesh: MeshObject | null;
  /** Whether the Print Preview pane is currently the visible right view. */
  visible: boolean;
}

/** One page rendered for the on-screen preview (scaled for display only).
 *  Renders the full paper sheet with the content inset by the print margin,
 *  matching the print output (WYSIWYG). */
function PagePreview({ page, pageCount, paper }: { page: PrintPage; pageCount: number; paper: PaperSize }) {
  return (
    <div className="print-page-preview">
      <div className="print-page-boundary">
        <svg
          className="print-page-svg"
          viewBox={`0 0 ${paper.widthMm} ${paper.heightMm}`}
          preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
        >
          {page.islands.map((placed, i) => {
            const { minX, minY } = islandBounds(placed.island);
            return (
              <g key={i} transform={`translate(${PRINT_MARGIN_MM + placed.x - minX} ${PRINT_MARGIN_MM + placed.y - minY})`}>
                {placed.island.edges.map((e, j) => {
                  const [x1, y1] = placed.island.vertices[e.a];
                  const [x2, y2] = placed.island.vertices[e.b];
                  return (
                    <path
                      key={j}
                      className={`net-edge net-edge-${e.kind}`}
                      d={`M ${x1} ${y1} L ${x2} ${y2}`}
                    />
                  );
                })}
                <text className="net-island-label" x={minX + placed.width / 2} y={minY + placed.height / 2}>
                  {placed.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="print-page-number">
        {page.pageIndex + 1} / {pageCount}
      </div>
    </div>
  );
}

function print(net: Net, paperSizeId: PaperSizeId): void {
  const paper = getPaper(paperSizeId);
  const root = buildPrintDocument(net, paper);
  document.body.appendChild(root);
  const cleanup = () => {
    document.getElementById(PRINT_ROOT_ID)?.remove();
  };
  window.addEventListener("afterprint", cleanup, { once: true });
  // Fallback: some webviews never fire afterprint; clean up after a delay.
  window.setTimeout(cleanup, 30_000);
  window.print();
}

function PrintPreview({ mesh, visible }: PrintPreviewProps) {
  const { settings, update } = useSettings();
  const [net, setNet] = useState<Net | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unfolding, setUnfolding] = useState(false);
  // Monotonic request id: any response that is no longer the latest is stale
  // and must be dropped (Tauri invokes are not cancellable).
  const requestId = useRef(0);

  useEffect(() => {
    if (!visible) return;
    if (!mesh || mesh.vertices.length === 0) {
      setNet(null);
      setError(null);
      setUnfolding(false);
      return;
    }
    const id = ++requestId.current;
    setUnfolding(true);
    setError(null);
    // targetFaces is part of the request: changing it re-unfolds (simplification
    // changes the mesh itself, unlike paper size which only re-lays out).
    invoke<Net>("unfold", { mesh, targetFaces: settings.unfoldTargetFaces })
      .then((result) => {
        if (id !== requestId.current) return;
        setNet(result);
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        setError(String(err));
      })
      .finally(() => {
        if (id === requestId.current) setUnfolding(false);
      });
  }, [mesh, visible, settings.unfoldTargetFaces]);

  const paper = getPaper(settings.paperSize);
  const { widthMm, heightMm } = usableAreaMm(paper, PRINT_MARGIN_MM);
  const pages = net ? layoutPagesBestFit(net, widthMm, heightMm) : [];
  const overflow = net ? overflowIslands(pages) : [];

  let body;
  if (!mesh || mesh.vertices.length === 0) {
    body = (
      <div className="print-sheet">
        <p className="print-sheet-caption">Run the CadQuery script to unfold</p>
      </div>
    );
  } else if (error) {
    body = (
      <Alert
        type="error"
        message="Unfold failed"
        description={
          <span>
            {error}. This usually means the model is not a closed manifold — check the CadQuery
            script for open or non-manifold geometry.
          </span>
        }
        showIcon
      />
    );
  } else if (net) {
    body = (
      <div className="print-pages-stack">
        {pages.map((page) => (
          <PagePreview
            key={page.pageIndex}
            page={page}
            pageCount={pages.length}
            paper={paper}
          />
        ))}
      </div>
    );
  } else {
    body = null;
  }

  return (
    <div className="print-preview">
      <div className="print-preview-body">
        {body}
        {net?.simplified && !net.simplified.error && (
          <Alert
            type="info"
            className="print-notice-alert"
            message={
              <span>
                Mesh simplified from {net.simplified.originalFaces} →{" "}
                {net.simplified.finalFaces} triangles for unfolding.
              </span>
            }
            showIcon
            closable
          />
        )}
        {net?.simplified?.error && (
          <Alert
            type="info"
            className="print-notice-alert"
            message="Mesh simplification skipped"
            description={
              <span>
                Reducing to {net.simplified?.finalFaces} faces would have opened holes in the
                model, so the original mesh ({net.simplified?.originalFaces} faces) was used
                instead.
              </span>
            }
            showIcon
            closable
          />
        )}
        {overflow.length > 0 && (
          <Alert
            type="warning"
            className="print-overflow-alert"
            message="Some islands are too large for one page"
            description={
              <span>
                Island{overflow.length > 1 ? "s" : ""}{" "}
                {overflow.map((o) => o.label).join(", ")}{" "}
                {overflow.length > 1 ? "are" : "is"} larger than one {paper.label} sheet. They
                will print running off the page.
              </span>
            }
            showIcon
          />
        )}
      </div>
      <div className="print-settings-bar">
        <Select<PaperSizeId>
          className="print-paper-select"
          value={settings.paperSize}
          onChange={(v) => update({ paperSize: v })}
          options={PAPER_SIZES.map((p) => ({ value: p.id, label: p.label }))}
          aria-label="Paper size"
        />
        <Tooltip title="Maximum triangle count after mesh simplification for unfolding. Curved models (spheres, cylinders) are decimated to at most this many faces before unfolding.">
          <span className="print-target-label">Max faces</span>
          <InputNumber
            className="print-target-input"
            min={UNFOLD_TARGET_MIN}
            max={UNFOLD_TARGET_MAX}
            value={settings.unfoldTargetFaces}
            onChange={(v) => {
              if (typeof v === "number" && Number.isFinite(v)) {
                update({ unfoldTargetFaces: v });
              }
            }}
            aria-label="Maximum face count"
          />
        </Tooltip>
        {/* Reserved slot for future glue-flap configuration. */}
        <div className="print-settings-spacer" />
        <Tooltip title="Print at true scale (1:1)">
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            disabled={!net}
            onClick={() => net && print(net, settings.paperSize)}
          >
            Print
          </Button>
        </Tooltip>
      </div>
      {unfolding && (
        <div className="net-spinner-overlay">
          <Spin size="large" />
        </div>
      )}
    </div>
  );
}

export default PrintPreview;
