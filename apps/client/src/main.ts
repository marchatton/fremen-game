import { GAME_CONSTANTS, TerrainGenerator } from '@fremen/shared';
import { Renderer } from './core/Renderer';
import { CameraController } from './core/Camera';
import { InputManager } from './core/InputManager';
import { Player } from './entities/Player';
import { FPSCounter } from './ui/FPSCounter';
import { ChatUI } from './ui/ChatUI';
import { InteractionPrompt } from './ui/InteractionPrompt';
import { ObjectiveTracker } from './ui/ObjectiveTracker';
import { RidingHUD } from './ui/RidingHUD';
import { NetworkManager } from './networking/NetworkManager';
import { PredictionManager } from './core/PredictionManager';
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
const chatUI = new ChatUI();
const interactionPrompt = new InteractionPrompt();
const objectiveTracker = new ObjectiveTracker();
const ridingHUD = new RidingHUD();
const predictionManager = new PredictionManager();

chatUI.onSend((message) => {
  network.sendChat(message);
});

const serverUrl = 'http://localhost:3000';
const network = new NetworkManager(serverUrl);

import { Worm } from './entities/Worm';
import { Thumper } from './entities/Thumper';
import { ObjectiveMarker } from './entities/ObjectiveMarker';
import { PlayerStateEnum } from '@fremen/shared';

let localPlayerId: string | null = null;
let localPlayerState: PlayerStateEnum = PlayerStateEnum.ACTIVE;
let currentObjective: any = null;
let objectiveMarker: ObjectiveMarker | null = null;
const players = new Map<string, Player>();
const worms = new Map<string, Worm>();
const wormStates = new Map<string, any>();
const thumpers = new Map<string, Thumper>();

network.onWelcome((data) => {
  localPlayerId = data.playerId;
  console.log(`Welcome! Player ID: ${localPlayerId}`);
  
  terrainManager = new TerrainManager(scene, data.seed);
  terrainManager.update(0, 0);
  
  heightSampler = new TerrainGenerator({ seed: data.seed });
});

network.onChat((data) => {
  chatUI.addMessage(data.playerName, data.message);
});

network.onState((data) => {
  if (data.objective) {
    if (currentObjective?.status === 'ACTIVE' && data.objective.status === 'COMPLETED') {
      objectiveTracker.showCompletion();
      if (objectiveMarker) {
        scene.remove(objectiveMarker.getGroup());
        objectiveMarker.dispose();
        objectiveMarker = null;
      }
    }
    
    if (data.objective.status === 'ACTIVE' && (!currentObjective || currentObjective.id !== data.objective.id)) {
      if (objectiveMarker) {
        scene.remove(objectiveMarker.getGroup());
        objectiveMarker.dispose();
      }
      
      const pos = new THREE.Vector3(
        data.objective.targetPosition.x,
        data.objective.targetPosition.y,
        data.objective.targetPosition.z
      );
      objectiveMarker = new ObjectiveMarker(pos, data.objective.radius);
      scene.add(objectiveMarker.getGroup());
      console.log('Spawned objective marker at', pos);
    }
    
    currentObjective = data.objective;
  }

  for (const playerState of data.players) {
    let player = players.get(playerState.id);
    
    if (!player) {
      const isLocal = playerState.id === localPlayerId;
      player = new Player(playerState.id, isLocal ? 0x4a90e2 : 0xe24a4a);
      players.set(playerState.id, player);
      scene.add(player.getMesh());
      console.log(`Added player: ${playerState.id}`);
    }

    if (playerState.id === localPlayerId) {
      const wasRiding = localPlayerState === PlayerStateEnum.RIDING;
      localPlayerState = playerState.state;
      const isRiding = localPlayerState === PlayerStateEnum.RIDING;
      
      if (wasRiding !== isRiding) {
        cameraController.setRidingMode(isRiding);
      }
    }

    if (playerState.id === localPlayerId && data.lastProcessedInputSeq !== undefined) {
      const reconciledPosition = predictionManager.reconcile(
        playerState.position,
        data.lastProcessedInputSeq,
        player.getPosition(),
        5,
        0.016
      );
      
      if (heightSampler) {
        reconciledPosition.y = heightSampler.getHeight(reconciledPosition.x, reconciledPosition.z) + 1;
      }
      
      player.setPosition(reconciledPosition.x, reconciledPosition.y, reconciledPosition.z);
    } else {
      const p = player.getPosition();
      player.setPosition(
        p.x + (playerState.position.x - p.x) * 0.5,
        p.y + (playerState.position.y - p.y) * 0.5,
        p.z + (playerState.position.z - p.z) * 0.5
      );
    }
    
    player.setRotation(playerState.rotation);
  }

  const currentPlayerIds = new Set(data.players.map((p) => p.id));
  for (const [id, player] of players) {
    if (!currentPlayerIds.has(id)) {
      scene.remove(player.getMesh());
      players.delete(id);
      console.log(`Removed player: ${id}`);
    }
  }

  for (const wormState of data.worms) {
    wormStates.set(wormState.id, wormState);
    
    let worm = worms.get(wormState.id);
    
    if (!worm) {
      worm = new Worm(wormState.id);
      worms.set(wormState.id, worm);
      scene.add(worm.getGroup());
      console.log(`Added worm: ${wormState.id}`);
    }

    worm.updateFromState(wormState, deltaTime);
  }

  const currentWormIds = new Set(data.worms.map((w) => w.id));
  for (const [id, worm] of worms) {
    if (!currentWormIds.has(id)) {
      scene.remove(worm.getGroup());
      worm.dispose();
      worms.delete(id);
      console.log(`Removed worm: ${id}`);
    }
  }

  for (const thumperState of data.thumpers) {
    let thumper = thumpers.get(thumperState.id);
    
    if (!thumper) {
      const pos = new THREE.Vector3(thumperState.position.x, thumperState.position.y, thumperState.position.z);
      thumper = new Thumper(thumperState.id, pos);
      thumpers.set(thumperState.id, thumper);
      scene.add(thumper.getGroup());
      console.log(`Added thumper: ${thumperState.id}`);
    }

    thumper.update(0.016, thumperState);
  }

  const currentThumperIds = new Set(data.thumpers.map((t) => t.id));
  for (const [id, thumper] of thumpers) {
    if (!currentThumperIds.has(id)) {
      scene.remove(thumper.getGroup());
      thumper.dispose();
      thumpers.delete(id);
      console.log(`Removed thumper: ${id}`);
    }
  }
});

network.connect().catch(console.error);

import { TerrainManager } from './terrain/TerrainManager';

let terrainManager: TerrainManager | null = null;
let heightSampler: TerrainGenerator | null = null;

let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const currentTime = performance.now();
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  const movement = inputManager.getMovement();
  const mouseDelta = inputManager.getMouseDelta();

  let nearestMountableWorm: string | null = null;
  if (localPlayerId && localPlayerState === PlayerStateEnum.ACTIVE) {
    const localPlayer = players.get(localPlayerId);
    if (localPlayer) {
      let closestDist = GAME_CONSTANTS.WORM_MOUNT_DISTANCE;
      
      for (const [wormId, wormState] of wormStates) {
        if (wormState.aiState !== 'RIDDEN_BY' && wormState.controlPoints.length > 0) {
          const head = wormState.controlPoints[0];
          const dist = Math.sqrt(
            (localPlayer.getPosition().x - head.x) ** 2 +
            (localPlayer.getPosition().z - head.z) ** 2
          );
          
          if (dist < closestDist) {
            closestDist = dist;
            nearestMountableWorm = wormId;
          }
        }
      }
    }
  }

  if (nearestMountableWorm) {
    interactionPrompt.show('Press E to Mount');
    if (inputManager.shouldMount()) {
      network.sendMountAttempt(nearestMountableWorm);
    }
  } else if (localPlayerState === PlayerStateEnum.RIDING) {
    interactionPrompt.show('Press E to Dismount');
    if (inputManager.shouldMount()) {
      network.sendDismount();
    }
  } else {
    interactionPrompt.hide();
  }

  if (!cameraController.isDebugMode() && localPlayerId && localPlayerState === PlayerStateEnum.RIDING) {
    const localPlayer = players.get(localPlayerId);
    if (localPlayer && network.isConnected()) {
      const wormControl = {
        direction: movement.right,
        speedIntent: movement.forward,
      };

      if (movement.forward !== 0 || movement.right !== 0) {
        network.sendInput({ forward: 0, right: 0 }, 0, false, wormControl);
      }

      cameraController.setTarget(localPlayer.getPosition());

      if (terrainManager) {
        terrainManager.update(localPlayer.getPosition().x, localPlayer.getPosition().z);
      }
    }
  } else if (!cameraController.isDebugMode() && localPlayerId && localPlayerState === PlayerStateEnum.ACTIVE) {
    const localPlayer = players.get(localPlayerId);
    if (localPlayer) {
      let rotation = localPlayer.getMesh().rotation.y;
      
      const rotationSpeed = 0.002;
      if (inputManager.isPointerLockActive()) {
        rotation -= mouseDelta.x * rotationSpeed;
        localPlayer.setRotation(rotation);
      }

      const shouldDeployThumper = inputManager.shouldDeployThumper();

      if (network.isConnected() && ((movement.forward !== 0 || movement.right !== 0) || shouldDeployThumper)) {
        const speed = 5;
        const dx = movement.right * speed * deltaTime;
        const dz = -movement.forward * speed * deltaTime;
        
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        
        const predictedPos = localPlayer.getPosition();
        if (movement.forward !== 0 || movement.right !== 0) {
          predictedPos.x += dx * cos - dz * sin;
          predictedPos.z += dx * sin + dz * cos;
        }
        
        if (heightSampler) {
          const groundY = heightSampler.getHeight(predictedPos.x, predictedPos.z) + 1;
          predictedPos.y = groundY;
        }
        
        const seq = network.sendInput(movement, rotation, shouldDeployThumper);
        predictionManager.addInput(seq, movement, rotation, {
          x: predictedPos.x,
          y: predictedPos.y,
          z: predictedPos.z,
        });
      }
      
      cameraController.setTarget(localPlayer.getPosition());
      
      if (terrainManager) {
        terrainManager.update(localPlayer.getPosition().x, localPlayer.getPosition().z);
      }
    }
  }

  if (objectiveMarker) {
    objectiveMarker.update(deltaTime);
  }

  cameraController.update(deltaTime);
  fpsCounter.update();

  if (currentObjective && localPlayerId) {
    const localPlayer = players.get(localPlayerId);
    if (localPlayer) {
      objectiveTracker.update(currentObjective, localPlayer.getPosition());
    }
  }

  if (localPlayerState === PlayerStateEnum.RIDING && localPlayerId) {
    const localPlayer = players.get(localPlayerId);
    if (localPlayer) {
      const playerData = Array.from(wormStates.values()).find(w => w.riderId === localPlayerId);
      if (playerData) {
        ridingHUD.show();
        ridingHUD.updateSpeed(playerData.speed);
        ridingHUD.updateHealth(playerData.health, GAME_CONSTANTS.WORM_INITIAL_HEALTH);
      }
    }
  } else {
    ridingHUD.hide();
  }

  renderer.render();
}

animate();
