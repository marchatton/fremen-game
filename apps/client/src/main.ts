import { GAME_CONSTANTS } from '@fremen/shared';
import { Renderer } from './core/Renderer';
import { CameraController } from './core/Camera';
import { InputManager } from './core/InputManager';
import { Player } from './entities/Player';
import { FPSCounter } from './ui/FPSCounter';
import { NetworkManager } from './networking/NetworkManager';
import * as THREE from 'three';

console.log('Fremen Game - Client Starting');
console.log('Game Constants:', GAME_CONSTANTS);

const canvas = document.getElementById('canvas') as HTMLCanvasElement;

const renderer = new Renderer(canvas);
const scene = renderer.getScene();
const camera = renderer.getCamera();

const cameraController = new CameraController(camera, canvas);
const inputManager = new InputManager();
const fpsCounter = new FPSCounter();

const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
const network = new NetworkManager(serverUrl);

let localPlayerId: string | null = null;
const players = new Map<string, Player>();

network.onWelcome((data) => {
  localPlayerId = data.playerId;
  console.log(`Welcome! Player ID: ${localPlayerId}`);
  
  terrainManager = new TerrainManager(scene, data.seed);
  terrainManager.update(0, 0);
});

network.onState((data) => {
  for (const playerState of data.players) {
    let player = players.get(playerState.id);
    
    if (!player) {
      const isLocal = playerState.id === localPlayerId;
      player = new Player(playerState.id, isLocal ? 0x4a90e2 : 0xe24a4a);
      players.set(playerState.id, player);
      scene.add(player.getMesh());
      console.log(`Added player: ${playerState.id}`);
    }

    player.setPosition(playerState.position.x, playerState.position.y, playerState.position.z);
    player.setRotation(playerState.rotation);
  }

  const currentPlayerIds = new Set(data.players.map(p => p.id));
  for (const [id, player] of players) {
    if (!currentPlayerIds.has(id)) {
      scene.remove(player.getMesh());
      players.delete(id);
      console.log(`Removed player: ${id}`);
    }
  }
});

network.connect().catch(console.error);

import { TerrainManager } from './terrain/TerrainManager';

let terrainManager: TerrainManager | null = null;

let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const currentTime = performance.now();
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  const movement = inputManager.getMovement();
  const mouseDelta = inputManager.getMouseDelta();

  if (!cameraController.isDebugMode() && localPlayerId) {
    const localPlayer = players.get(localPlayerId);
    if (localPlayer) {
      let rotation = localPlayer.getMesh().rotation.y;
      
      const rotationSpeed = 0.002;
      if (inputManager.isPointerLockActive()) {
        rotation -= mouseDelta.x * rotationSpeed;
        localPlayer.setRotation(rotation);
      }

      if (network.isConnected()) {
        network.sendInput(movement, rotation);
      }
      
      cameraController.setTarget(localPlayer.getPosition());
      
      if (terrainManager) {
        terrainManager.update(localPlayer.getPosition().x, localPlayer.getPosition().z);
      }
    }
  }

  cameraController.update(deltaTime);
  fpsCounter.update();
  renderer.render();
}

animate();
