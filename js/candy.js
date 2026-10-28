import * as THREE from 'three';

export const PALETTE = [0xff7a18, 0x8e44ff, 0x39d353, 0xe0245e, 0xffd23f, 0x2ec4ff];
const STRIPES = [0xfff4e0, 0x140a1c];

// Candy lies along the local X axis.
const bodyGeo = new THREE.CapsuleGeometry(0.28, 0.42, 8, 20).rotateZ(Math.PI / 2);
const bandGeo = new THREE.CylinderGeometry(0.287, 0.287, 0.09, 24, 1, true).rotateZ(Math.PI / 2);
const knotGeo = new THREE.SphereGeometry(0.075, 10, 8);
const rightEndGeo = new THREE.ConeGeometry(0.22, 0.34, 12, 1, true).rotateZ(Math.PI / 2).translate(0.66, 0, 0);
const leftEndGeo = new THREE.ConeGeometry(0.22, 0.34, 12, 1, true).rotateZ(-Math.PI / 2).translate(-0.66, 0, 0);

export function createCandy(color) {
  const wrapper = new THREE.MeshStandardMaterial({
    color, metalness: 0.55, roughness: 0.28, emissive: color, emissiveIntensity: 0, side: THREE.DoubleSide,
  });
  const stripe = new THREE.MeshStandardMaterial({
    color: STRIPES[Math.floor(Math.random() * STRIPES.length)], metalness: 0.3, roughness: 0.4,
  });

  const group = new THREE.Group();
  const meshes = [
    new THREE.Mesh(bodyGeo, wrapper),
    new THREE.Mesh(rightEndGeo, wrapper),
    new THREE.Mesh(leftEndGeo, wrapper),
    new THREE.Mesh(knotGeo, wrapper),
    new THREE.Mesh(knotGeo, wrapper),
    new THREE.Mesh(bandGeo, stripe),
    new THREE.Mesh(bandGeo, stripe),
  ];
  meshes[3].position.x = 0.5;
  meshes[4].position.x = -0.5;
  meshes[5].position.x = 0.17;
  meshes[6].position.x = -0.17;
  for (const m of meshes) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  group.rotation.order = 'YZX';

  return {
    group,
    meshes,
    color,
    setGlow(v) {
      wrapper.emissiveIntensity = v;
    },
    /** Turn into a dull, flattened, empty wrapper. */
    toWrapper() {
      for (const mat of [wrapper, stripe]) {
        mat.color.multiplyScalar(0.35);
        mat.metalness = 0.1;
        mat.roughness = 0.95;
      }
      wrapper.emissiveIntensity = 0;
      meshes[5].visible = meshes[6].visible = false;
    },
    dispose() {
      wrapper.dispose();
      stripe.dispose();
    },
  };
}
