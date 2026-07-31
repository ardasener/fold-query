#!/usr/bin/env python3
"""FoldQuery CadQuery runner.

Reads a CadQuery script from stdin, executes it with a ``show_object`` shim,
tessellates every shown shape, and prints a single JSON result to stdout:

    {"stdout": str, "error": str | null, "objects": [{"vertices": [...], "faces": [...]}]}

Errors inside the user script (including tracebacks) are captured into the
"error" field rather than terminating the runner, so the app can always parse
the output.
"""

import contextlib
import io
import json
import sys
import traceback


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


def main():
    source = sys.stdin.read()
    shown = []
    result = {"stdout": "", "error": None, "objects": []}

    def show_object(obj, name=None, options=None):
        shown.append(obj)

    captured = io.StringIO()
    try:
        with contextlib.redirect_stdout(captured):
            exec(compile(source, "<cadquery>", "exec"), {"show_object": show_object})
        result["stdout"] = captured.getvalue()
        for obj in shown:
            try:
                result["objects"].append(_tessellate(obj))
            except Exception as exc:  # report tessellation failure per object
                result["error"] = "Failed to tessellate a shown object: %r" % (exc,)
                break
    except Exception:
        result["error"] = traceback.format_exc()

    print(json.dumps(result))


if __name__ == "__main__":
    main()
