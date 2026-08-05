import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { MeshObject } from "../types/python";

/** Formats routed to mesh projects (parsed by three.js loaders). */
export const MESH_EXTENSIONS = new Set(["obj", "stl", "ply", "gltf", "glb"]);

/** Formats routed to code projects (imported via CadQuery). */
export const CAD_EXTENSIONS = new Set(["step", "stp", "brep", "dxf"]);

/** Supported extensions for the file picker filter. */
export const IMPORT_FILTER = [
  { name: "All supported", extensions: [...MESH_EXTENSIONS, ...CAD_EXTENSIONS] },
  { name: "Triangle meshes", extensions: [...MESH_EXTENSIONS] },
  { name: "CAD solids", extensions: [...CAD_EXTENSIONS] },
];

/** Route a file name to its import mode, or null if unsupported. */
export function importModeFor(fileName: string): "mesh" | "cad" | null {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = fileName.slice(dot + 1).toLowerCase();
  if (MESH_EXTENSIONS.has(ext)) return "mesh";
  if (CAD_EXTENSIONS.has(ext)) return "cad";
  return null;
}

/** Base name without extension, for auto-naming the project. */
export function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/** Scale all mesh vertices by `factor` (unit conversion before unfold). */
export function scaleMesh(mesh: { vertices: number[]; faces: number[] }, factor: number): { vertices: number[]; faces: number[] } {
  return {
    vertices: mesh.vertices.map((v) => v * factor),
    faces: mesh.faces,
  };
}

/**
 * Convert a single three.js geometry into a MeshObject (positions + faces).
 * Handles indexed and non-indexed geometries. Positions are assumed to be in
 * world space (callers apply node transforms first).
 */
function geometryToMesh(geometry: THREE.BufferGeometry): MeshObject {
  const pos = geometry.getAttribute("position");
  const vertices: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    vertices.push(pos.getX(i), pos.getY(i), pos.getZ(i));
  }
  let faces: number[];
  const index = geometry.getIndex();
  if (index) {
    faces = Array.from(index.array);
  } else {
    // Non-indexed: every 3 consecutive positions form a triangle.
    faces = [];
    for (let i = 0; i + 2 < pos.count; i += 3) {
      faces.push(i, i + 1, i + 2);
    }
  }
  return { vertices, faces };
}

/**
 * Merge a three.js Object3D's meshes into a single MeshObject.
 *
 * Builds the mesh per-child and concatenates with vertex offsets rather than
 * using `mergeGeometries` (which loses index buffers and fails on mixed
 * attribute layouts). Applies each node's world transform so sub-meshes at
 * different positions land correctly in one coordinate space.
 */
function objectToMesh(obj: THREE.Object3D): MeshObject {
  const merged: MeshObject = { vertices: [], faces: [] };
  obj.updateWorldMatrix(true, true);
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const pos = mesh.geometry.getAttribute("position");
    if (!pos) return;

    const world = mesh.matrixWorld;
    const needTransform =
      world.elements[0] !== 1 ||
      world.elements[5] !== 1 ||
      world.elements[10] !== 1 ||
      world.elements[12] !== 0 ||
      world.elements[13] !== 0 ||
      world.elements[14] !== 0;
    const vertices: number[] = [];
    const tmp = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      tmp.fromBufferAttribute(pos, i);
      if (needTransform) tmp.applyMatrix4(world);
      vertices.push(tmp.x, tmp.y, tmp.z);
    }

    let faces: number[];
    const index = mesh.geometry.getIndex();
    const offset = merged.vertices.length / 3;
    if (index) {
      faces = [];
      for (let i = 0; i < index.count; i++) {
        faces.push(index.getX(i) + offset);
      }
    } else {
      faces = [];
      for (let i = 0; i + 2 < pos.count; i += 3) {
        faces.push(offset + i, offset + i + 1, offset + i + 2);
      }
    }
    merged.vertices.push(...vertices);
    merged.faces.push(...faces);
  });
  return merged;
}

/** Parse file bytes into a MeshObject based on the extension. */
export function parseMesh(fileName: string, bytes: Uint8Array): Promise<MeshObject> {
  const ext = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

  if (ext === "obj") {
    const text = new TextDecoder().decode(bytes);
    return Promise.resolve(objectToMesh(new OBJLoader().parse(text)));
  }
  if (ext === "stl") {
    return Promise.resolve(geometryToMesh(new STLLoader().parse(data)));
  }
  if (ext === "ply") {
    return Promise.resolve(geometryToMesh(new PLYLoader().parse(data)));
  }
  if (ext === "gltf" || ext === "glb") {
    return new Promise((resolve, reject) => {
      new GLTFLoader().parse(data, "", (gltf: { scene: THREE.Object3D }) => {
        resolve(objectToMesh(gltf.scene));
      }, reject);
    });
  }
  return Promise.reject(new Error(`Unsupported mesh format: .${ext}`));
}
