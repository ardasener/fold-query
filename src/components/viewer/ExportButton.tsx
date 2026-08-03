import { useCallback, useState } from "react";
import { Button, Dropdown, message, Tooltip } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { invoke } from "@tauri-apps/api/core";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { PLYExporter } from "three/examples/jsm/exporters/PLYExporter.js";
import type { MeshObject } from "../../types/python";

type ExportFormat = "glb" | "obj" | "stl" | "ply";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  glb: "GLB (.glb)",
  obj: "OBJ (.obj)",
  stl: "STL (.stl)",
  ply: "PLY (.ply)",
};

const EXTENSIONS: Record<ExportFormat, string> = {
  glb: "glb",
  obj: "obj",
  stl: "stl",
  ply: "ply",
};

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "model";
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function toUint8Array(value: ArrayBuffer | DataView | string): Uint8Array {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value instanceof DataView) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return new TextEncoder().encode(value);
}

function buildGroup(objects: MeshObject[]): THREE.Group {
  const group = new THREE.Group();
  for (const o of objects) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(o.vertices, 3));
    geometry.setIndex(o.faces);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: "#b54708" }),
    );
    mesh.updateMatrix();
    group.add(mesh);
  }
  return group;
}

interface ExportButtonProps {
  projectName: string;
  objects: MeshObject[] | null;
}

function ExportButton({ projectName, objects }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const hasModel = objects != null && objects.length > 0;

  const exportAs = useCallback(
    async (format: ExportFormat) => {
      if (!objects || objects.length === 0) return;
      setExporting(true);
      try {
        const group = buildGroup(objects);
        const fileName = `${sanitizeFileName(projectName)}-${timestamp()}.${EXTENSIONS[format]}`;

        let raw: ArrayBuffer | DataView | string;
        if (format === "glb") {
          const glbResult = await new Promise<ArrayBuffer | Record<string, unknown>>(
            (resolve, reject) => {
              new GLTFExporter().parse(group, resolve, reject, { binary: true });
            },
          );
          if (!(glbResult instanceof ArrayBuffer)) throw new Error("Unexpected GLTF result");
          raw = glbResult;
        } else if (format === "obj") {
          raw = new OBJExporter().parse(group);
        } else if (format === "stl") {
          raw = new STLExporter().parse(group, { binary: true }) as DataView;
        } else {
          raw = await new Promise<ArrayBuffer | DataView | string>((resolve) => {
            new PLYExporter().parse(group, resolve, { binary: true });
          });
        }

        const path = await invoke<string>("write_downloads_file", {
          fileName,
          data: toUint8Array(raw),
        });
        void message.success(`Exported to ${path}`);
      } catch (err) {
        void message.error(`Export failed: ${String(err)}`);
      } finally {
        setExporting(false);
      }
    },
    [objects, projectName],
  );

  return (
    <Dropdown
      menu={{
        items: (Object.keys(FORMAT_LABELS) as ExportFormat[]).map((f) => ({
          key: f,
          label: FORMAT_LABELS[f],
        })),
        onClick: ({ key }) => void exportAs(key as ExportFormat),
      }}
      trigger={["click"]}
      disabled={!hasModel}
    >
      <Tooltip title="Export model">
        <Button
          type="text"
          size="small"
          className="pane-switch"
          icon={<DownloadOutlined />}
          loading={exporting}
          disabled={!hasModel}
          aria-label="Export model"
        />
      </Tooltip>
    </Dropdown>
  );
}

export default ExportButton;
