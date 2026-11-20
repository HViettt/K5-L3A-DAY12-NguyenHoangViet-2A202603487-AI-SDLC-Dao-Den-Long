// Hiển thị (placeholder CP0): chỉ đọc state từ core, không chứa luật chơi.
import * as THREE from "three";
import { createWorld, step, TICK_DT } from "../core/world.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x05060a, 10, 40);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
scene.add(new THREE.HemisphereLight(0x8899ff, 0x111122, 0.6));
const ground = new THREE.Mesh(new THREE.CircleGeometry(20, 48), new THREE.MeshStandardMaterial({ color: 0x223322 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const may = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.8), new THREE.MeshStandardMaterial({ color: 0xffd77a, emissive: 0x332200 }));
scene.add(may);

const keys = new Set();
addEventListener("keydown", (e) => keys.add(e.code));
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const world = createWorld(1);
let acc = 0, last = performance.now();
renderer.setAnimationLoop((now) => {
  acc += Math.min((now - last) / 1000, 0.25);
  last = now;
  const input = {
    dx: (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
    dz: (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0),
  };
  while (acc >= TICK_DT) { step(world, input); acc -= TICK_DT; }
  const p = world.player;
  may.position.set(p.x, 0.8, p.z);
  camera.position.set(p.x, 4, p.z + 7);
  camera.lookAt(p.x, 1, p.z);
  renderer.render(scene, camera);
});
