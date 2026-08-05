import { describe, expect, test } from "bun:test";
import { baseName, importModeFor } from "./model-import";

describe("importModeFor", () => {
  test("routes triangle mesh formats to mesh mode", () => {
    expect(importModeFor("model.obj")).toBe("mesh");
    expect(importModeFor("model.stl")).toBe("mesh");
    expect(importModeFor("model.ply")).toBe("mesh");
    expect(importModeFor("model.gltf")).toBe("mesh");
    expect(importModeFor("model.glb")).toBe("mesh");
  });

  test("routes CAD solid formats to cad mode", () => {
    expect(importModeFor("model.step")).toBe("cad");
    expect(importModeFor("model.stp")).toBe("cad");
    expect(importModeFor("model.brep")).toBe("cad");
    expect(importModeFor("model.dxf")).toBe("cad");
  });

  test("rejects unsupported and extensionless files", () => {
    expect(importModeFor("model.fbx")).toBeNull();
    expect(importModeFor("model.3ds")).toBeNull();
    expect(importModeFor("model")).toBeNull();
    expect(importModeFor(".hidden")).toBeNull();
  });

  test("is case-insensitive", () => {
    expect(importModeFor("MODEL.STL")).toBe("mesh");
    expect(importModeFor("Model.Step")).toBe("cad");
  });

  test("handles paths with directories and dots in names", () => {
    expect(importModeFor("/some/dir/my.model.obj")).toBe("mesh");
    expect(importModeFor("C:\\dir\\file.STEP")).toBe("cad");
  });
});

describe("baseName", () => {
  test("strips the extension", () => {
    expect(baseName("model.obj")).toBe("model");
    expect(baseName("a.b.model.stl")).toBe("a.b.model");
  });

  test("returns the name as-is without an extension", () => {
    expect(baseName("model")).toBe("model");
  });
});
