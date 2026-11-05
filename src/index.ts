/**
 * Om Mani Prayer Wheel (Mani Khorlo / མ་ཎི་འཁོར་ལོ།) in WebXR using XR Blocks.
 * Features realistic wrist rotation physics, accelerometer and gyroscope sensor input,
 * centrifugal weighted pendulum cord, haptic feedback on rotations, daily mantra tracking,
 * and Tibetan singing bowl sound synthesis.
 */

import * as THREE from 'three';
import * as xb from 'xrblocks';

import { PrayerWheelModel } from './PrayerWheelModel';
import { MantraTracker } from './MantraTracker';
import { HapticsAndAudio } from './HapticsAndAudio';
import { PhysicsAndSensors } from './PhysicsAndSensors';
import { AltarAndUI } from './AltarAndUI';

class OmManiPrayerWheelApp extends xb.Script {
  private model!: PrayerWheelModel;
  private tracker!: MantraTracker;
  private hapticsAndAudio!: HapticsAndAudio;
  private physics!: PhysicsAndSensors;
  private altarUI!: AltarAndUI;

  // Altar environment
  private altarTable!: THREE.Group;
  private butterLamps: THREE.PointLight[] = [];

  // Interaction & hand holding state
  private isHeldInHand = true;
  private holdingHandIndex = 0; // 0 for primary right controller/hand, 1 for left
  private handWorldPos = new THREE.Vector3();
  private handWorldQuat = new THREE.Quaternion();

  // Drag interaction on cylinder (desktop/pointer fallback)
  private isPointerDownOnCylinder = false;
  private prevPointerX = 0;
  private pointerVelocity = 0;

  // Default rest pose when placed on stand
  private readonly standWorldPos = new THREE.Vector3(0.18, 1.25, -0.85);

  init() {
    // 1. Lighting (Tibetan temple warm lighting + butter lamps)
    this.setupLighting();

    // 2. Initialize Models & Systems
    this.tracker = new MantraTracker();
    this.hapticsAndAudio = new HapticsAndAudio();
    this.model = new PrayerWheelModel();
    this.add(this.model.root);

    // 3. Altar Table & Butter Lamps
    this.setupAltarTable();

    // 4. Physics Engine & Callbacks
    this.physics = new PhysicsAndSensors(this.tracker, this.hapticsAndAudio, {
      onMantraCompleted: (totalToday, hitGoal) => {
        if (hitGoal) {
          this.altarUI.showGoalCelebration(this.tracker.state.dailyGoal);
        }
      },
      onQuarterTurn: () => {
        // Quarter turn tick
      },
      onWrongDirectionNotice: () => {
        // Handled in UI metrics
      },
    });

    // 5. Spatial UI Card
    this.altarUI = new AltarAndUI(
      this.tracker,
      this.physics,
      (impulse) => {
        // Button spin request
        this.physics.applyImpulse(impulse);
        this.hapticsAndAudio.ensureAudioContext();
      },
      () => {
        // Toggle hand-held vs stand mode
        this.toggleHandHeldMode();
      }
    );
    this.add(this.altarUI.card);

    // 6. Setup Initial Pose
    this.isHeldInHand = !this.tracker.state.standMode;
    this.updateWheelPlacement(true);

    // 7. Desktop Pointer Events for Direct Dragging & Flicking
    this.setupDesktopInteractions();

    // Initial nudge to demonstrate rotation
    this.physics.applyImpulse(2.5);
  }

  private setupLighting() {
    // Warm hemisphere light (temple ambiance)
    const hemiLight = new THREE.HemisphereLight(0xfffaed, 0x5c3d28, 2.5);
    this.add(hemiLight);

    // Directional sunlight casting soft shadows
    const dirLight = new THREE.DirectionalLight(0xfff5db, 1.8);
    dirLight.position.set(2, 4, 1.5);
    dirLight.castShadow = true;
    this.add(dirLight);
  }

  private setupAltarTable() {
    this.altarTable = new THREE.Group();
    this.altarTable.position.copy(this.standWorldPos);
    this.altarTable.position.y -= 0.22; // Table surface under stand

    // Altar Table Top (Dark lacquered wood)
    const tableTopGeo = new THREE.BoxGeometry(0.7, 0.04, 0.45);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x1f110b, // Tibetan dark ebony/teak
      roughness: 0.5,
      metalness: 0.1,
    });
    const tableTop = new THREE.Mesh(tableTopGeo, tableMat);
    tableTop.receiveShadow = true;
    this.altarTable.add(tableTop);

    // Gold silk runner cloth on table
    const runnerGeo = new THREE.PlaneGeometry(0.35, 0.46);
    const runnerMat = new THREE.MeshStandardMaterial({
      color: 0x9e2a2b, // Tibetan deep red/maroon silk
      roughness: 0.7,
      side: THREE.DoubleSide,
    });
    const runner = new THREE.Mesh(runnerGeo, runnerMat);
    runner.rotation.x = -Math.PI / 2;
    runner.position.y = 0.021;
    this.altarTable.add(runner);

    // Two Tibetan Butter Lamps (Diyo / Mar-me) with flickering golden flame
    const lampOffsets = [-0.22, 0.22];
    lampOffsets.forEach((xOff) => {
      const lampGroup = new THREE.Group();
      lampGroup.position.set(xOff, 0.02, 0);

      // Brass lamp cup
      const cupGeo = new THREE.CylinderGeometry(0.035, 0.015, 0.045, 16);
      const brassMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.9,
        roughness: 0.3,
      });
      const cup = new THREE.Mesh(cupGeo, brassMat);
      cup.position.y = 0.022;
      lampGroup.add(cup);

      // Flame glow
      const flameGeo = new THREE.ConeGeometry(0.008, 0.022, 8);
      const flameMat = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
      });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.y = 0.052;
      lampGroup.add(flame);

      // Point light for butter lamp
      const pLight = new THREE.PointLight(0xff9922, 0.8, 1.2);
      pLight.position.y = 0.06;
      lampGroup.add(pLight);
      this.butterLamps.push(pLight);

      this.altarTable.add(lampGroup);
    });

    this.add(this.altarTable);
  }

  private toggleHandHeldMode() {
    this.isHeldInHand = !this.isHeldInHand;
    this.tracker.toggleStandMode(!this.isHeldInHand);
    this.model.setStandVisible(!this.isHeldInHand);
    this.altarTable.visible = !this.isHeldInHand;
    this.physics.resetHandTracking();
    this.updateWheelPlacement(true);
  }

  private updateWheelPlacement(force = false) {
    if (!this.isHeldInHand) {
      // Place on altar stand
      this.model.root.position.copy(this.standWorldPos);
      this.model.root.rotation.set(0, -0.2, 0);
      this.model.setStandVisible(true);
      this.altarTable.visible = true;
    } else {
      // Held in hand: hide stand and altar table
      this.model.setStandVisible(false);
      this.altarTable.visible = false;
      if (force) {
        // Default floating pose in front of user
        this.model.root.position.set(0.18, 1.35, -0.65);
        this.model.root.rotation.set(0, 0, 0);
      }
    }
  }

  private setupDesktopInteractions() {
    // Window mouse/pointer drag for desktop testing
    window.addEventListener('pointerdown', (e) => {
      this.isPointerDownOnCylinder = true;
      this.prevPointerX = e.clientX;
      this.hapticsAndAudio.ensureAudioContext();
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isPointerDownOnCylinder) return;
      const deltaX = e.clientX - this.prevPointerX;
      this.prevPointerX = e.clientX;
      this.pointerVelocity = deltaX;

      // Dragging horizontally adds rotational velocity
      // Dragging to the right rotates clockwise
      this.physics.angularVelocity += deltaX * 0.08;
    });

    window.addEventListener('pointerup', () => {
      this.isPointerDownOnCylinder = false;
    });

    // Keyboard controls (Space to whirl, Arrows to spin)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        this.physics.applyImpulse(5.0);
        this.hapticsAndAudio.ensureAudioContext();
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        this.physics.applyImpulse(3.0);
        this.hapticsAndAudio.ensureAudioContext();
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        this.physics.applyImpulse(-3.0);
      } else if (e.code === 'KeyH') {
        this.toggleHandHeldMode();
      } else if (e.code === 'KeyR') {
        this.physics.toggleDirection();
      } else if (e.code === 'KeyM') {
        this.tracker.toggleAmbientChant();
        this.hapticsAndAudio.ensureAudioContext();
      }
    });
  }

  /**
   * XR Blocks input events: onSelectStart, onSelecting, onSelectEnd
   */
  onSelectStart(event: xb.SelectEvent) {
    this.hapticsAndAudio.ensureAudioContext();
    // Quick impulse on trigger/pinch
    this.physics.applyImpulse(4.5);
  }

  update() {
    const dt = xb.getDeltaTime();

    // 1. Butter Lamp flame flicker
    const now = performance.now() * 0.005;
    this.butterLamps.forEach((lamp, idx) => {
      lamp.intensity = 0.7 + Math.sin(now + idx * 3) * 0.2 + (Math.random() - 0.5) * 0.1;
    });

    // 2. Track WebXR Hand / Controller pose
    let handTransform: { position: THREE.Vector3; quaternion: THREE.Quaternion } | undefined;
    const controllers = xb.core.input.controllers;

    if (this.isHeldInHand) {
      let activeCtrl: (typeof controllers)[number] | null = null;
      if (controllers && controllers.length > 0) {
        activeCtrl = controllers[this.holdingHandIndex] || controllers[0];
      }

      if (activeCtrl && activeCtrl.visible) {
        // Hand position & orientation from controller
        activeCtrl.getWorldPosition(this.handWorldPos);
        activeCtrl.getWorldQuaternion(this.handWorldQuat);

        // Position the prayer wheel handle right inside the hand grip
        // Offset slightly forward & up to sit naturally above the palm
        const offset = new THREE.Vector3(0, 0.05, -0.05).applyQuaternion(this.handWorldQuat);
        this.model.root.position.copy(this.handWorldPos).add(offset);
        this.model.root.quaternion.copy(this.handWorldQuat);

        handTransform = {
          position: this.handWorldPos,
          quaternion: this.handWorldQuat,
        };
      } else {
        // Desktop / Simulator fallback: follow gentle floating breathing motion
        const t = performance.now() * 0.0015;
        this.model.root.position.set(
          0.18 + Math.sin(t) * 0.015,
          1.35 + Math.cos(t * 1.5) * 0.01,
          -0.65
        );
        this.model.root.rotation.set(
          Math.sin(t * 0.8) * 0.04,
          Math.cos(t * 0.5) * 0.05,
          0
        );

        handTransform = {
          position: this.model.root.position,
          quaternion: this.model.root.quaternion,
        };
      }
    }

    // 3. Step Physics & Sensor calculations
    this.physics.update(dt, this.isHeldInHand, handTransform, controllers);

    // 4. Update 3D Model rotation and dynamic centrifugal pendulum
    // Uses getVisualAngle() so clockwise progress turns clockwise in Three.js space
    this.model.cylinderGroup.rotation.y = this.physics.getVisualAngle();
    this.model.update(this.physics.angularVelocity, dt);

    // 5. Update Live UI metrics
    this.altarUI.updateLiveMetrics();
  }

  dispose() {
    this.hapticsAndAudio.dispose();
  }
}

// XR Blocks Setup
const options = new xb.Options();
options.enableHands();
options.hands.visualization = true;
options.hands.visualizeMeshes = true;
options.reticles.enabled = true;
options.simulator.defaultMode = xb.SimulatorMode.CONTROLLER;
options.setAppTitle('Om Mani Prayer Wheel');
options.setAppDescription(
  'Interactive Tibetan Prayer Wheel with wrist rotation physics, accelerometer and gyroscope tracking, haptic feedback, and daily progress.'
);

// Simulator instructions for user convenience
options.simulator.instructions.customInstructions = [
  {
    header: 'Om Mani Prayer Wheel',
    description:
      'Grasp the handle and whirl your wrist in a gentle circle to spin the prayer wheel! On desktop, click/drag the drum, press Spacebar, or use the UI buttons. Always spin Clockwise (sunwise) to activate mantras.',
  },
];

document.addEventListener('DOMContentLoaded', async () => {
  xb.add(new OmManiPrayerWheelApp());
  await xb.init(options);
});
