/**
 * Physics and sensor integration for the Tibetan Prayer Wheel:
 * - Rotational inertia and bearing damping
 * - Wrist-whirling and angular torque from WebXR controller / hand 6-DOF IMU
 * - Mobile device accelerometer and gyroscope (devicemotion) integration
 * - Direct drag/flick interaction
 * - 360-degree clockwise mantra revolution tracking with haptics and audio hooks
 */

import * as THREE from 'three';
import { MantraTracker } from './MantraTracker';
import { HapticsAndAudio } from './HapticsAndAudio';

export interface PhysicsCallbacks {
  onMantraCompleted: (totalToday: number, hitGoal: boolean) => void;
  onQuarterTurn: () => void;
  onWrongDirectionNotice: () => void;
}

export class PhysicsAndSensors {
  // Rotational state
  angle = 0; // Current barrel angle in radians
  angularVelocity = 0; // rad/s (positive = clockwise looking down)
  angularAcceleration = 0;

  // Constants
  readonly momentOfInertia = 0.0022; // kg·m^2 (brass cylinder + weighted cord)
  readonly bearingFriction = 0.45; // viscous friction damping
  readonly staticFriction = 0.08; // threshold to come to a complete rest
  readonly airDrag = 0.008; // air resistance proportional to v^2

  // Revolution tracking
  private accumulatedAngle = 0; // tracks positive progress towards 2*PI
  private lastQuarterTick = 0;
  private warnedCounterClockwise = false;

  // Wrist tracking (Controller / Hand in WebXR)
  private prevHandPosition = new THREE.Vector3();
  private prevHandVelocity = new THREE.Vector3();
  private prevHandQuaternion = new THREE.Quaternion();
  private hasPrevHand = false;
  private wristWhirlPhase = 0;

  // Device IMU tracking (Mobile devicemotion)
  private gyroZ = 0; // rad/s
  private accelMagnitude = 0;
  private imuAvailable = false;

  // Drag interaction state
  private isDragging = false;
  private dragPlane = new THREE.Plane();
  private prevDragIntersection = new THREE.Vector3();
  private dragRaycaster = new THREE.Raycaster();

  constructor(
    private tracker: MantraTracker,
    private hapticsAndAudio: HapticsAndAudio,
    private callbacks: PhysicsCallbacks
  ) {
    this.initDeviceSensors();
  }

  private initDeviceSensors() {
    if (typeof window === 'undefined') return;

    // Listen to device motion (gyroscope and accelerometer)
    const handleMotion = (event: DeviceMotionEvent) => {
      this.imuAvailable = true;
      if (event.rotationRate) {
        // Gyroscope rotation rate (deg/s) converted to rad/s
        // Usually gamma or alpha corresponds to spinning around phone long axis
        const alpha = (event.rotationRate.alpha || 0) * (Math.PI / 180);
        const beta = (event.rotationRate.beta || 0) * (Math.PI / 180);
        const gamma = (event.rotationRate.gamma || 0) * (Math.PI / 180);

        // Combined rotational energy on device
        this.gyroZ = (gamma * 0.7 + alpha * 0.3) * 0.8;
      }

      if (event.acceleration) {
        const ax = event.acceleration.x || 0;
        const ay = event.acceleration.y || 0;
        const az = event.acceleration.z || 0;
        this.accelMagnitude = Math.sqrt(ax * ax + ay * ay + az * az);
      }
    };

    try {
      window.addEventListener('devicemotion', handleMotion);
    } catch (e) {
      console.warn('DeviceMotion not supported or permission required:', e);
    }
  }

  /**
   * Main physics step.
   * @param dt Delta time in seconds
   * @param isHeld Whether the prayer wheel is currently held in hand
   * @param handTransform World position and orientation of the holding hand/controller
   * @param activeControllers Active WebXR controllers for haptics
   */
  update(
    dt: number,
    isHeld: boolean,
    handTransform?: { position: THREE.Vector3; quaternion: THREE.Quaternion },
    activeControllers?: unknown[]
  ) {
    dt = Math.min(dt, 0.05); // Clamp dt to prevent physics tunneling
    let netTorque = 0;

    // 1. Calculate Torque from Hand / Wrist Motion
    if (isHeld && handTransform) {
      netTorque += this.computeWristTorque(handTransform, dt);
    }

    // 2. Calculate Torque from Device IMU (Mobile/Tablet gyros)
    if (isHeld && this.imuAvailable && Math.abs(this.gyroZ) > 0.1) {
      // Direct angular torque from device gyroscope
      netTorque += this.gyroZ * 0.005;
      // Bonus torque if accelerometer detects rhythmic circular shake
      if (this.accelMagnitude > 2.0) {
        netTorque += Math.sign(this.gyroZ || 1) * this.accelMagnitude * 0.002;
      }
    }

    // 3. Natural Friction and Damping
    const speed = this.angularVelocity;
    const sign = Math.sign(speed);
    const absSpeed = Math.abs(speed);

    // Viscous bearing damping + quadratic air resistance
    const frictionTorque =
      -sign * (this.bearingFriction * absSpeed + this.airDrag * absSpeed * absSpeed) * this.momentOfInertia;
    netTorque += frictionTorque;

    // 4. Integrate Angular Motion (Semi-implicit Euler)
    this.angularAcceleration = netTorque / this.momentOfInertia;
    this.angularVelocity += this.angularAcceleration * dt;

    // Static friction cutoff when speed is very low and no driving torque
    if (absSpeed < this.staticFriction && Math.abs(netTorque) < 0.0008 && !this.isDragging) {
      this.angularVelocity = 0;
    }

    // Update angle
    const deltaAngle = this.angularVelocity * dt;
    this.angle += deltaAngle;

    // 5. Revolution & Mantra Counting Logic (Clockwise = Positive direction)
    this.processMantraProgress(deltaAngle, activeControllers);

    // 6. Update continuous bearing audio sound
    this.hapticsAndAudio.updateBearingSpeed(this.angularVelocity, this.tracker.state.soundEnabled);

    // 7. Update ambient singing bowl & Om Mani chanting track (plays while spinning)
    this.hapticsAndAudio.updateAmbientTrack(
      this.angularVelocity,
      this.tracker.state.soundEnabled,
      this.tracker.state.ambientChantEnabled
    );
  }

  /**
   * Computes the torque generated by wrist rotation and circular wrist movement.
   * Tibetan prayer wheels rely on a weighted bob on a cord:
   * circular acceleration of the axle creates tangential pull on the bob, driving spin!
   */
  private computeWristTorque(
    hand: { position: THREE.Vector3; quaternion: THREE.Quaternion },
    dt: number
  ): number {
    if (!this.hasPrevHand || dt <= 0.001) {
      this.prevHandPosition.copy(hand.position);
      this.prevHandQuaternion.copy(hand.quaternion);
      this.hasPrevHand = true;
      return 0;
    }

    // 1. Angular velocity of the wrist around the handle's vertical axis
    // Delta quaternion: q_delta = q_curr * q_prev^-1
    const invPrev = this.prevHandQuaternion.clone().invert();
    const qDelta = hand.quaternion.clone().multiply(invPrev);

    // Convert small quaternion to angular velocity vector
    // q = [cos(theta/2), sin(theta/2) * v]
    let angle = 2 * Math.acos(THREE.MathUtils.clamp(qDelta.w, -1, 1));
    if (angle > Math.PI) angle -= 2 * Math.PI;

    const sinHalf = Math.sin(angle / 2);
    let handAngularVelY = 0;
    if (Math.abs(sinHalf) > 0.001) {
      const axis = new THREE.Vector3(qDelta.x, qDelta.y, qDelta.z).divideScalar(sinHalf);
      // Project onto handle local Up vector (which in hand space is Y)
      handAngularVelY = (axis.y * angle) / dt;
    }

    // 2. Linear acceleration of hand (circular wrist motion)
    const currentVelocity = hand.position.clone().sub(this.prevHandPosition).divideScalar(dt);
    const handAccel = currentVelocity.clone().sub(this.prevHandVelocity).divideScalar(dt);

    // In horizontal plane (XZ), check circular whirling
    // When doing a circular motion, velocity and acceleration are perpendicular!
    // Centripetal acceleration a_c is directed towards the center of whirl.
    const tangentialWhirl = currentVelocity.x * handAccel.z - currentVelocity.z * handAccel.x;

    // Store for next frame
    this.prevHandPosition.copy(hand.position);
    this.prevHandVelocity.copy(currentVelocity);
    this.prevHandQuaternion.copy(hand.quaternion);

    // Combined torque:
    // Direct wrist twist around axis (negated because Three.js Y-axis is counter-clockwise)
    // + centrifugal boost from circular whirling
    let torque = -handAngularVelY * 0.0012;
    if (Math.abs(tangentialWhirl) > 0.5) {
      torque += Math.sign(tangentialWhirl) * Math.min(0.008, Math.abs(tangentialWhirl) * 0.0006);
    }

    return torque;
  }

  invertVisualDirection = false;

  toggleDirection(): boolean {
    this.invertVisualDirection = !this.invertVisualDirection;
    return this.invertVisualDirection;
  }

  getVisualAngle(): number {
    return this.invertVisualDirection ? this.angle : -this.angle;
  }

  /**
   * Tracks positive (clockwise) rotations. Every 2*PI radians = 1 completed mantra.
   */
  private processMantraProgress(deltaAngle: number, activeControllers?: unknown[]) {
    // In Tibetan tradition: clockwise (deasil / sunwise) is sacred.
    if (deltaAngle > 0) {
      this.warnedCounterClockwise = false;
      this.accumulatedAngle += deltaAngle;

      // Quarter-turn micro ticks (every PI / 2 radians = 90 degrees)
      const quarterTurn = Math.PI / 2;
      if (this.accumulatedAngle - this.lastQuarterTick >= quarterTurn) {
        this.lastQuarterTick = this.accumulatedAngle;
        this.hapticsAndAudio.playTick(this.tracker.state.soundEnabled, 0.12);
        this.hapticsAndAudio.triggerHaptic('tick', this.tracker.state.hapticsEnabled, activeControllers);
        this.callbacks.onQuarterTurn();
      }

      // Full 360-degree rotation (2 * PI radians)
      const fullTurn = Math.PI * 2;
      if (this.accumulatedAngle >= fullTurn) {
        this.accumulatedAngle -= fullTurn;
        this.lastQuarterTick = 0;

        // Register mantra in tracker
        const { hitGoal } = this.tracker.addMantra(1);

        // Feedback
        if (hitGoal) {
          this.hapticsAndAudio.playMilestoneGong(this.tracker.state.soundEnabled);
          this.hapticsAndAudio.triggerHaptic('milestone', this.tracker.state.hapticsEnabled, activeControllers);
        } else {
          this.hapticsAndAudio.playMantraChime(
            this.tracker.state.soundEnabled,
            Math.min(2.5, this.angularVelocity / 4)
          );
          this.hapticsAndAudio.triggerHaptic('mantra', this.tracker.state.hapticsEnabled, activeControllers);
        }

        this.callbacks.onMantraCompleted(this.tracker.state.todayCount, hitGoal);
      }
    } else if (deltaAngle < -0.1) {
      // Counter-clockwise spin
      if (!this.warnedCounterClockwise && Math.abs(this.angularVelocity) > 2.0) {
        this.warnedCounterClockwise = true;
        this.callbacks.onWrongDirectionNotice();
      }
    }
  }

  /**
   * Apply direct impulse or flick (from mouse, controller touch, or UI button).
   */
  applyImpulse(angularImpulse: number) {
    this.angularVelocity += angularImpulse;
  }

  /**
   * Reset tracking states
   */
  resetHandTracking() {
    this.hasPrevHand = false;
  }

  getRPM(): number {
    // 1 rad/s = 60 / (2 * PI) RPM ≈ 9.549 RPM
    return Math.abs(this.angularVelocity) * 9.54929658551;
  }

  isClockwise(): boolean {
    return this.angularVelocity > 0.05;
  }
}
