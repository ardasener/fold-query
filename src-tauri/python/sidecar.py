#!/usr/bin/env python3
"""FoldQuery persistent sidecar.

Speaks NDJSON JSON-RPC over stdio. CadQuery is imported once at startup so
subsequent requests avoid the (slow) OCP import.

Request:
    {"id": int, "method": str, "params": {...}}

Response:
    {"id": int, "result": {...}}   or   {"id": int, "error": str}

Methods:
    ping               -> {"pong": true}
    run_script {source} -> {"stdout": str, "error": str|null, "objects": [{"vertices": [...], "faces": [...]}]}
    get_docs {symbol}   -> {"symbol": str, "docstring": str}
    export_cad {source, format} -> {"path": str}   (format: "step" | "brep")
"""

import contextlib
import inspect
import io
import json
import sys
import traceback

import cadquery  # noqa: F401 - imported once at startup


def _tessellate(obj):
    """Tessellate a CadQuery shape (or Workplane) into flat vertex/face arrays."""
    shape = obj.val() if hasattr(obj, "val") else obj
    vertices, triangles = shape.tessellate(0.1)
    flat_vertices = []
    for v in vertices:
        flat_vertices.extend((float(v.x), float(v.y), float(v.z)))
    flat_faces = []
    for t in triangles:
        flat_faces.extend((int(t[0]), int(t[1]), int(t[2])))
    return {"vertices": flat_vertices, "faces": flat_faces}


def run_script(source):
    """Execute a CadQuery script, collecting shown objects and output."""
    shown = []
    result = {"stdout": "", "error": None, "objects": []}

    def show_object(obj, name=None, options=None):
        shown.append(obj)

    captured = io.StringIO()
    try:
        with contextlib.redirect_stdout(captured):
            exec(
                compile(source, "<cadquery>", "exec"),
                {"show_object": show_object, "cq": cadquery},
            )
        result["stdout"] = captured.getvalue()
        for obj in shown:
            try:
                result["objects"].append(_tessellate(obj))
            except Exception as exc:  # report tessellation failure per object
                result["error"] = "Failed to tessellate a shown object: %r" % (exc,)
                break
    except Exception:
        result["error"] = traceback.format_exc()
    return result


def get_docs(symbol):
    """Resolve a dotted symbol path (e.g. 'Workplane.box') to its docstring."""
    parts = [p for p in symbol.strip().split(".") if p]
    if not parts:
        return {"symbol": symbol, "docstring": "Provide a symbol path such as 'Workplane.box'."}
    obj = cadquery
    for part in parts:
        try:
            obj = getattr(obj, part)
        except AttributeError:
            return {
                "symbol": symbol,
                "docstring": "Symbol '%s' not found in the installed CadQuery package." % symbol,
            }
    doc = inspect.getdoc(obj)
    if not doc:
        doc = "No docstring available for '%s' (a %s)." % (symbol, type(obj).__name__)
    return {"symbol": symbol, "docstring": doc[:4000]}


def export_cad(source, fmt, target_path):
    """Run a CadQuery script and export the last shown solid to STEP or BREP."""
    shown = []

    def show_object(obj, name=None, options=None):
        shown.append(obj)

    captured = io.StringIO()
    with contextlib.redirect_stdout(captured):
        exec(
            compile(source, "<cadquery>", "exec"),
            {"show_object": show_object, "cq": cadquery},
        )
    if not shown:
        return {"error": "No objects were shown by the script."}
    solid = shown[-1]
    solid = solid.val() if hasattr(solid, "val") else solid
    try:
        if fmt == "step":
            cadquery.exporters.exportStep(solid, target_path)
        elif fmt == "brep":
            cadquery.exporters.exportBrep(solid, target_path)
        else:
            return {"error": "Unsupported CAD export format: %r" % fmt}
    except Exception as exc:
        return {"error": "CAD export failed: %r" % (exc,)}
    return {"path": target_path}


def main():
    out = sys.stdout
    for raw in sys.stdin.buffer:
        line = raw.decode("utf-8", "replace").strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            continue
        req_id = req.get("id")
        method = req.get("method")
        params = req.get("params") or {}
        try:
            if method == "ping":
                result = {"pong": True}
            elif method == "run_script":
                result = run_script(params.get("source", ""))
            elif method == "export_cad":
                result = export_cad(
                    params.get("source", ""),
                    params.get("format", "step"),
                    params.get("targetPath", ""),
                )
            elif method == "get_docs":
                result = get_docs(params.get("symbol", ""))
            else:
                out.write(json.dumps({"id": req_id, "error": "Unknown method '%s'" % method}) + "\n")
                out.flush()
                continue
            out.write(json.dumps({"id": req_id, "result": result}) + "\n")
        except Exception as exc:  # never let the sidecar die
            out.write(json.dumps({"id": req_id, "error": repr(exc)}) + "\n")
        out.flush()


if __name__ == "__main__":
    main()
