import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { useSettings } from "../../settings/SettingsContext";
import { sceneColors } from "../../themes/scene";
import { withAlpha } from "../../themes/palettes";
import type { MeshObject } from "../../types/python";
import "./ViewerPanel.css";

interface ViewerPanelProps {
  objects: MeshObject[] | null;
}

function MeshView({ data, color, edgeColor }: { data: MeshObject; color: string; edgeColor: string }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(data.vertices, 3));
    g.setIndex(data.faces);
    g.computeVertexNormals();
    g.center();
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

function Scene({ objects }: ViewerPanelProps) {
  const { palette } = useSettings();
  const colors = sceneColors(palette);
  const edgeColor = withAlpha(palette.text, 0.6);

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 6]} intensity={1.2} />
      <group position={[0, 0.6, 0]}>
        {objects && objects.length > 0 &&
          objects.map((o, i) => (
            <MeshView key={i} data={o} color={palette.primary} edgeColor={edgeColor} />
          ))}
      </group>
      <Grid
        position={[0, -0.9, 0]}
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

  return (
    <div className="viewer-panel">
      <Canvas camera={{ position: [4, 3, 5], fov: 45 }}>
        <color attach="background" args={[colors.background]} />
        <Scene objects={objects} />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}

export default ViewerPanel;
