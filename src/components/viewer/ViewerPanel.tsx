import { Canvas, useThree } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Button, Tooltip } from "antd";
import { ScanOutlined } from "@ant-design/icons";
import { useSettings } from "../../settings/SettingsContext";
import { sceneColors } from "../../themes/scene";
import { withAlpha } from "../../themes/palettes";
import type { MeshObject } from "../../types/python";
import "./ViewerPanel.css";

interface ViewerPanelProps {
  objects: MeshObject[] | null;
}

interface Bounds {
  center: THREE.Vector3;
  radius: number;
  minY: number;
}

type ControlsLike = { target: THREE.Vector3; update: () => void } | null;

function computeBounds(objects: MeshObject[]): Bounds {
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const o of objects) {
    for (let i = 0; i + 2 < o.vertices.length; i += 3) {
      v.set(o.vertices[i], o.vertices[i + 1], o.vertices[i + 2]);
      box.expandByPoint(v);
    }
  }
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  return { center, radius: size.length() / 2, minY: box.min.y };
}

function frameCamera(camera: THREE.Camera, controls: ControlsLike, bounds: Bounds) {
  const persp = camera as THREE.PerspectiveCamera;
  const fov = ((persp.fov ?? 45) * Math.PI) / 180;
  const minDistance = Math.max(bounds.radius * 1.5, 0.5);
  const distance = Math.max((bounds.radius / Math.sin(fov / 2)) * 1.2, minDistance);
  const direction = new THREE.Vector3(1, 0.8, 1.2).normalize();
  camera.position.copy(bounds.center).addScaledVector(direction, distance);
  camera.lookAt(bounds.center);
  if (controls) {
    controls.target.copy(bounds.center);
    controls.update();
  }
}

function CameraRig({
  bounds,
  frameRequest,
  userMoved,
  controlsRef,
}: {
  bounds: Bounds | null;
  frameRequest: number;
  userMoved: boolean;
  controlsRef: React.RefObject<ControlsLike>;
}) {
  const camera = useThree((s) => s.camera);
  const lastApplied = useRef(0);

  useEffect(() => {
    if (!bounds) return;
    // Auto-frame until the user moves the camera; the reset button always
    // reframes (frameRequest changes).
    if (userMoved && frameRequest === lastApplied.current) return;
    lastApplied.current = frameRequest;
    frameCamera(camera, controlsRef.current, bounds);
  }, [bounds, frameRequest, userMoved, camera, controlsRef]);

  return null;
}

function MeshView({ data, color, edgeColor }: { data: MeshObject; color: string; edgeColor: string }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(data.vertices, 3));
    g.setIndex(data.faces);
    g.computeVertexNormals();
    return g;
  }, [data]);

  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={edgeColor} />
      </lineSegments>
    </group>
  );
}

function Scene({ objects, gridY }: { objects: MeshObject[] | null; gridY: number }) {
  const { palette } = useSettings();
  const colors = sceneColors(palette);
  const edgeColor = withAlpha(palette.text, 0.6);

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 6]} intensity={1.2} />
      {objects && objects.length > 0 &&
        objects.map((o, i) => (
          <MeshView key={i} data={o} color={palette.primary} edgeColor={edgeColor} />
        ))}
      <Grid
        position={[0, gridY, 0]}
        cellSize={0.5}
        sectionSize={1}
        cellColor={colors.grid}
        sectionColor={colors.gridSection}
        fadeDistance={25}
      />
    </>
  );
}

function ViewerPanel({ objects }: ViewerPanelProps) {
  const { palette } = useSettings();
  const colors = sceneColors(palette);
  const controlsRef = useRef<ControlsLike>(null);
  const [userMoved, setUserMoved] = useState(false);
  const [frameRequest, setFrameRequest] = useState(0);

  const hasModel = objects != null && objects.length > 0;
  const bounds = useMemo(() => (hasModel ? computeBounds(objects!) : null), [objects, hasModel]);
  const gridY = bounds ? bounds.minY - Math.max(bounds.radius * 0.05, 0.02) : -0.9;

  return (
    <div className="viewer-panel">
      <Canvas camera={{ position: [4, 3, 5], fov: 45 }}>
        <color attach="background" args={[colors.background]} />
        <Scene objects={objects} gridY={gridY} />
        <OrbitControls
          makeDefault
          ref={controlsRef as never}
          onStart={() => setUserMoved(true)}
        />
        <CameraRig
          bounds={bounds}
          frameRequest={frameRequest}
          userMoved={userMoved}
          controlsRef={controlsRef}
        />
      </Canvas>
      {hasModel && (
        <Tooltip title="Reset view">
          <Button
            className="viewer-reset"
            icon={<ScanOutlined />}
            onClick={() => {
              setUserMoved(true);
              setFrameRequest((v) => v + 1);
            }}
            aria-label="Reset view"
          />
        </Tooltip>
      )}
    </div>
  );
}

export default ViewerPanel;
