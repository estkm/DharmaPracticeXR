/**
 * Procedural 3D Tibetan Om Mani Prayer Wheel (Mani Khorlo / མ་ཎི་འཁོར་ལོ།)
 * Includes authentic engraved cylinder, weighted pendulum cord, carved rosewood handle,
 * Stupa finial, lotus altar stand, and sacred aura particle effects.
 */

import * as THREE from 'three';

export interface PrayerWheelMeshGroup extends THREE.Group {
  cylinderGroup: THREE.Group;
  handleGroup: THREE.Group;
  pendulumGroup: THREE.Group;
  pendulumBob: THREE.Mesh;
  pendulumCord: THREE.Line;
  auraParticles: THREE.Points;
  standGroup: THREE.Group;
}

export class PrayerWheelModel {
  root: THREE.Group;
  cylinderGroup: THREE.Group; // Rotates around Y
  handleGroup: THREE.Group;   // Held by hand / static relative to root
  pendulumGroup: THREE.Group; // Swings around cylinder
  pendulumBob: THREE.Mesh;
  pendulumCord: THREE.Line;
  cordCurveGeometry: THREE.BufferGeometry;
  auraParticles: THREE.Points;
  auraPositions: Float32Array;
  auraVelocities: Float32Array;
  auraLifetimes: Float32Array;
  standGroup: THREE.Group;

  // Pendulum physics parameters
  private pendulumAngle = 0; // radial swing angle
  private pendulumLagAngle = 0; // lag behind rotation
  private readonly cordLength = 0.11; // meters
  private readonly anchorRadius = 0.065; // cylinder radius
  private readonly anchorY = 0.05; // vertical height on cylinder

  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'TibetanPrayerWheelRoot';

    // 1. Handle group
    this.handleGroup = this.createHandle();
    this.root.add(this.handleGroup);

    // 2. Spinning cylinder group
    this.cylinderGroup = this.createCylinder();
    this.cylinderGroup.position.set(0, 0.12, 0); // Position above handle
    this.root.add(this.cylinderGroup);

    // 3. Pendulum cord & bob
    const { group: pendGroup, bob, cord, geometry } = this.createPendulum();
    this.pendulumGroup = pendGroup;
    this.pendulumBob = bob;
    this.pendulumCord = cord;
    this.cordCurveGeometry = geometry;
    this.cylinderGroup.add(this.pendulumGroup);

    // 4. Sacred aura particles
    const { points, pos, vel, life } = this.createAuraParticles();
    this.auraParticles = points;
    this.auraPositions = pos;
    this.auraVelocities = vel;
    this.auraLifetimes = life;
    this.cylinderGroup.add(this.auraParticles);

    // 5. Altar Stand
    this.standGroup = this.createAltarStand();
    this.root.add(this.standGroup);
  }

  /**
   * Generates high-res canvas texture containing:
   * 1. Sanskrit Ranjana: "ॐ मणि पद्मे हूँ"
   * 2. Tibetan Uchen: "ཨོཾ་མ་ཎི་པདྨེ་ཧཱུྃ"
   * 3. Lotus petals, auspicious symbols, turquoise and coral gemstones.
   */
  private createCylinderTexture(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
    const width = 2048;
    const height = 512;

    // Color Canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Bump / Height Canvas
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = width;
    bumpCanvas.height = height;
    const bCtx = bumpCanvas.getContext('2d')!;

    // Base background: rich antique Tibetan brass with copper tones
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#754a1a');
    bgGrad.addColorStop(0.15, '#b8862d');
    bgGrad.addColorStop(0.35, '#d4af37');
    bgGrad.addColorStop(0.5, '#e8c962');
    bgGrad.addColorStop(0.65, '#d4af37');
    bgGrad.addColorStop(0.85, '#9e6722');
    bgGrad.addColorStop(1, '#663c12');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, width, height);

    // Subtle brushed metal horizontal bands
    for (let y = 0; y < height; y += 4) {
      const alpha = 0.04 + Math.random() * 0.06;
      ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, y, width, 2);
    }

    // Top and bottom ornate copper borders
    const borderHeight = 60;
    // Top border
    ctx.fillStyle = '#9e4624'; // Copper
    ctx.fillRect(0, 0, width, borderHeight);
    ctx.fillStyle = '#ffd700'; // Gold beading line
    ctx.fillRect(0, borderHeight - 4, width, 4);

    // Bottom border
    ctx.fillStyle = '#9e4624';
    ctx.fillRect(0, height - borderHeight, width, borderHeight);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(0, height - borderHeight, width, 4);

    // Lotus petals along top and bottom
    const petalCount = 32;
    const petalW = width / petalCount;
    for (let i = 0; i < petalCount; i++) {
      const x = i * petalW;

      // Top inverted lotus
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.quadraticCurveTo(x + petalW / 2, borderHeight - 8, x + petalW, 0);
      ctx.fillStyle = '#ffd700';
      ctx.fill();
      ctx.strokeStyle = '#5a3010';
      ctx.lineWidth = 2;
      ctx.stroke();

      bCtx.beginPath();
      bCtx.moveTo(x, 0);
      bCtx.quadraticCurveTo(x + petalW / 2, borderHeight - 8, x + petalW, 0);
      bCtx.fillStyle = '#ffffff';
      bCtx.fill();

      // Bottom upright lotus
      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.quadraticCurveTo(x + petalW / 2, height - (borderHeight - 8), x + petalW, height);
      ctx.fillStyle = '#ffd700';
      ctx.fill();
      ctx.stroke();

      bCtx.beginPath();
      bCtx.moveTo(x, height);
      bCtx.quadraticCurveTo(x + petalW / 2, height - (borderHeight - 8), x + petalW, height);
      bCtx.fillStyle = '#ffffff';
      bCtx.fill();
    }

    // Inlaid Gemstones along middle bands (Turquoise & Coral)
    const gemCount = 16;
    const gemSpacing = width / gemCount;
    for (let i = 0; i < gemCount; i++) {
      const gx = i * gemSpacing + gemSpacing / 2;

      // Top row gemstones
      drawGem(ctx, bCtx, gx, borderHeight + 20, i % 2 === 0 ? 'turquoise' : 'coral');
      // Bottom row gemstones
      drawGem(ctx, bCtx, gx, height - borderHeight - 20, i % 2 === 0 ? 'coral' : 'turquoise');
    }

    // Sacred Mantra Text repeated across the cylinder
    // Repeats 4 times around the 360-degree cylinder
    const repetitions = 4;
    const blockW = width / repetitions;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    bCtx.textAlign = 'center';
    bCtx.textBaseline = 'middle';

    for (let r = 0; r < repetitions; r++) {
      const centerX = r * blockW + blockW / 2;

      // Upper script: Tibetan Uchen "ཨོཾ་མ་ཎི་པདྨེ་ཧཱུྃ"
      ctx.font = 'bold 84px "Google Sans", "Noto Sans Tibetan", sans-serif';
      // Embossed shadow
      ctx.fillStyle = '#3a1e05';
      ctx.fillText('ཨོཾ་མ་ཎི་པདྨེ་ཧཱུྃ', centerX + 3, height * 0.38 + 3);
      ctx.fillStyle = '#fff4b8'; // Radiant warm gold
      ctx.fillText('ཨོཾ་མ་ཎི་པདྨེ་ཧཱུྃ', centerX, height * 0.38);

      bCtx.font = 'bold 84px "Google Sans", "Noto Sans Tibetan", sans-serif';
      bCtx.fillStyle = '#ffffff';
      bCtx.fillText('ཨོཾ་མ་ཎི་པདྨེ་ཧཱུྃ', centerX, height * 0.38);

      // Lower script: Sacred Sanskrit / Devanagari "ॐ मणि पद्मे हूँ"
      ctx.font = 'bold 78px "Google Sans", "Noto Sans Devanagari", sans-serif';
      ctx.fillStyle = '#3a1e05';
      ctx.fillText('ॐ मणि पद्मे हूँ', centerX + 3, height * 0.62 + 3);
      ctx.fillStyle = '#ffd700'; // Deep gold
      ctx.fillText('ॐ मणि पद्मे हूँ', centerX, height * 0.62);

      bCtx.font = 'bold 78px "Google Sans", "Noto Sans Devanagari", sans-serif';
      bCtx.fillStyle = '#ffffff';
      bCtx.fillText('ॐ मणि पद्मे हूँ', centerX, height * 0.62);

      // Auspicious Endless Knot (Shrivatsa) between repetitions
      const divX = r * blockW;
      drawEndlessKnot(ctx, bCtx, divX, height / 2);
    }

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;
    map.colorSpace = THREE.SRGBColorSpace;

    const bump = new THREE.CanvasTexture(bumpCanvas);
    bump.wrapS = THREE.RepeatWrapping;
    bump.wrapT = THREE.ClampToEdgeWrapping;

    return { map, bump };
  }

  private createCylinder(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'PrayerWheelCylinder';

    const { map, bump } = this.createCylinderTexture();

    // 1. Main Drum Body
    const drumGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.11, 48, 1, false);
    const drumMat = new THREE.MeshStandardMaterial({
      map,
      bumpMap: bump,
      bumpScale: 0.003,
      metalness: 0.88,
      roughness: 0.3,
    });
    const drum = new THREE.Mesh(drumGeo, drumMat);
    drum.castShadow = true;
    drum.receiveShadow = true;
    group.add(drum);

    // 2. Brass rim bands (top and bottom rings)
    const rimGeo = new THREE.TorusGeometry(0.066, 0.005, 16, 48);
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xdfb15b,
      metalness: 0.92,
      roughness: 0.22,
    });
    const topRim = new THREE.Mesh(rimGeo, brassMat);
    topRim.rotation.x = Math.PI / 2;
    topRim.position.y = 0.055;
    group.add(topRim);

    const bottomRim = new THREE.Mesh(rimGeo, brassMat);
    bottomRim.rotation.x = Math.PI / 2;
    bottomRim.position.y = -0.055;
    group.add(bottomRim);

    // 3. Conical Top Cap with lotus tier
    const topCapGeo = new THREE.CylinderGeometry(0.02, 0.067, 0.028, 48);
    const topCap = new THREE.Mesh(topCapGeo, brassMat);
    topCap.position.y = 0.069;
    group.add(topCap);

    // Lotus stepped disc
    const lotusDiscGeo = new THREE.CylinderGeometry(0.028, 0.038, 0.012, 32);
    const copperMat = new THREE.MeshStandardMaterial({
      color: 0xb85d38,
      metalness: 0.85,
      roughness: 0.35,
    });
    const lotusDisc = new THREE.Mesh(lotusDiscGeo, copperMat);
    lotusDisc.position.y = 0.089;
    group.add(lotusDisc);

    // 4. Stupa / Jewel of Enlightenment (Ratna / Cintamani) finial
    const finialGroup = new THREE.Group();
    finialGroup.position.y = 0.095;

    // Golden lotus collar
    const collarGeo = new THREE.SphereGeometry(0.014, 24, 16);
    collarGeo.scale(1, 0.7, 1);
    const collar = new THREE.Mesh(collarGeo, brassMat);
    collar.position.y = 0.008;
    finialGroup.add(collar);

    // Faceted Stupa spire / flame jewel
    const stupaGeo = new THREE.ConeGeometry(0.012, 0.042, 16);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.95,
      roughness: 0.18,
    });
    const stupa = new THREE.Mesh(stupaGeo, goldMat);
    stupa.position.y = 0.032;
    finialGroup.add(stupa);

    // Jewel tip bead
    const jewelTipGeo = new THREE.SphereGeometry(0.006, 16, 16);
    const rubyMat = new THREE.MeshStandardMaterial({
      color: 0xd62828, // Red coral / ruby jewel
      metalness: 0.2,
      roughness: 0.1,
    });
    const jewelTip = new THREE.Mesh(jewelTipGeo, rubyMat);
    jewelTip.position.y = 0.055;
    finialGroup.add(jewelTip);

    group.add(finialGroup);

    // 5. Bottom cap & bearing washer
    const botCapGeo = new THREE.CylinderGeometry(0.067, 0.02, 0.022, 48);
    const botCap = new THREE.Mesh(botCapGeo, brassMat);
    botCap.position.y = -0.066;
    group.add(botCap);

    // Bearing ring
    const washerGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.008, 24);
    const washer = new THREE.Mesh(washerGeo, brassMat);
    washer.position.y = -0.081;
    group.add(washer);

    // 6. Anchor loop for weighted pendulum cord (attached to cylinder)
    const anchorGeo = new THREE.TorusGeometry(0.005, 0.0015, 8, 16);
    const anchor = new THREE.Mesh(anchorGeo, brassMat);
    anchor.position.set(0.066, 0.0, 0);
    anchor.rotation.y = Math.PI / 2;
    group.add(anchor);

    return group;
  }

  private createHandle(): THREE.Group {
    const handle = new THREE.Group();
    handle.name = 'PrayerWheelHandle';

    // Rosewood Material
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x422013, // Deep Tibetan rosewood
      metalness: 0.05,
      roughness: 0.55,
    });

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.9,
      roughness: 0.25,
    });

    // 1. Central steel spindle rod (runs through entire wheel)
    const spindleGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.38, 16);
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xaaaaaa,
      metalness: 0.95,
      roughness: 0.15,
    });
    const spindle = new THREE.Mesh(spindleGeo, steelMat);
    spindle.position.y = 0.08;
    handle.add(spindle);

    // 2. Brass upper collar (under bearing)
    const collarGeo = new THREE.CylinderGeometry(0.015, 0.013, 0.015, 24);
    const upperCollar = new THREE.Mesh(collarGeo, brassMat);
    upperCollar.position.y = 0.032;
    handle.add(upperCollar);

    // 3. Main carved ergonomic wood handle grip
    // Cylinders with ribbed rings
    const mainShaftGeo = new THREE.CylinderGeometry(0.013, 0.014, 0.14, 24);
    const mainShaft = new THREE.Mesh(mainShaftGeo, woodMat);
    mainShaft.position.y = -0.045;
    mainShaft.castShadow = true;
    handle.add(mainShaft);

    // Ergonomic grip ribs
    const ringOffsets = [-0.01, -0.03, -0.05, -0.07, -0.09];
    ringOffsets.forEach((yOff) => {
      const ringGeo = new THREE.TorusGeometry(0.0145, 0.002, 12, 24);
      const ring = new THREE.Mesh(ringGeo, brassMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = yOff;
      handle.add(ring);
    });

    // 4. Carved lower wood flare
    const lowerFlareGeo = new THREE.CylinderGeometry(0.014, 0.019, 0.025, 24);
    const lowerFlare = new THREE.Mesh(lowerFlareGeo, woodMat);
    lowerFlare.position.y = -0.125;
    handle.add(lowerFlare);

    // 5. Ornate Brass Pommel / Lotus Base
    const pommelGeo = new THREE.SphereGeometry(0.019, 24, 16);
    pommelGeo.scale(1, 0.8, 1);
    const pommel = new THREE.Mesh(pommelGeo, brassMat);
    pommel.position.y = -0.145;
    handle.add(pommel);

    // Dharmachakra (Dharma Wheel) bottom disc at pommel base
    const dharmaDiscGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.004, 24);
    const dharmaDisc = new THREE.Mesh(dharmaDiscGeo, brassMat);
    dharmaDisc.position.y = -0.16;
    handle.add(dharmaDisc);

    // Subtle invisible grab collider around handle for reliable raycasting
    const grabBoxGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.18, 12);
    const grabBoxMat = new THREE.MeshBasicMaterial({
      visible: false,
    });
    const grabBox = new THREE.Mesh(grabBoxGeo, grabBoxMat);
    grabBox.name = 'HandleGrabArea';
    grabBox.position.y = -0.06;
    handle.add(grabBox);

    return handle;
  }

  private createPendulum(): {
    group: THREE.Group;
    bob: THREE.Mesh;
    cord: THREE.Line;
    geometry: THREE.BufferGeometry;
  } {
    const group = new THREE.Group();
    group.name = 'WeightedPendulum';

    // 1. Cord line (dynamically updated curve)
    const pointsCount = 12;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < pointsCount; i++) {
      points.push(new THREE.Vector3(0.066, -0.01 * i, 0));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const cordMat = new THREE.LineBasicMaterial({
      color: 0x8a6230, // Braided silk/brass chain
      linewidth: 2,
    });
    const cord = new THREE.Line(geometry, cordMat);
    group.add(cord);

    // 2. Weighted Brass Bob (Teardrop / Dorje bell)
    const bobGroup = new THREE.Group();
    const bobGeo = new THREE.ConeGeometry(0.012, 0.024, 16);
    bobGeo.rotateX(Math.PI); // Inverted cone
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xdfb15b,
      metalness: 0.92,
      roughness: 0.25,
    });
    const cone = new THREE.Mesh(bobGeo, brassMat);

    const sphereGeo = new THREE.SphereGeometry(0.012, 16, 12);
    const sphere = new THREE.Mesh(sphereGeo, brassMat);
    sphere.position.y = 0.012;

    const ringGeo = new THREE.TorusGeometry(0.004, 0.001, 8, 16);
    const ring = new THREE.Mesh(ringGeo, brassMat);
    ring.position.y = 0.025;

    bobGroup.add(cone);
    bobGroup.add(sphere);
    bobGroup.add(ring);
    bobGroup.position.set(0.066, -this.cordLength, 0);

    const bobMesh = sphere; // Primary reference
    group.add(bobGroup);

    return { group, bob: bobMesh, cord, geometry };
  }

  private createAuraParticles(): {
    points: THREE.Points;
    pos: Float32Array;
    vel: Float32Array;
    life: Float32Array;
  } {
    const count = 120;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const life = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      life[i] = Math.random();
      const angle = Math.random() * Math.PI * 2;
      const r = 0.07 + Math.random() * 0.03;
      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
      pos[i * 3 + 2] = Math.sin(angle) * r;

      vel[i * 3] = Math.cos(angle) * 0.04;
      vel[i * 3 + 1] = 0.02 + Math.random() * 0.03;
      vel[i * 3 + 2] = Math.sin(angle) * 0.04;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    // Custom circle / lotus soft particle
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 64;
    pCanvas.height = 64;
    const pCtx = pCanvas.getContext('2d')!;
    const radGrad = pCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
    radGrad.addColorStop(0, '#ffffff');
    radGrad.addColorStop(0.3, '#ffea75');
    radGrad.addColorStop(0.7, '#ffaa00');
    radGrad.addColorStop(1, 'rgba(255, 170, 0, 0)');
    pCtx.fillStyle = radGrad;
    pCtx.fillRect(0, 0, 64, 64);

    const pTex = new THREE.CanvasTexture(pCanvas);
    const mat = new THREE.PointsMaterial({
      size: 0.035,
      map: pTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0,
    });

    const points = new THREE.Points(geo, mat);
    points.name = 'SacredMantraAura';
    return { points, pos, vel, life };
  }

  private createAltarStand(): THREE.Group {
    const stand = new THREE.Group();
    stand.name = 'TibetanAltarStand';
    stand.position.set(0, -0.22, 0);

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x2b1509, // Dark antique teak
      metalness: 0.1,
      roughness: 0.6,
    });

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xc8963e,
      metalness: 0.88,
      roughness: 0.28,
    });

    // Tier 1 Base Plinth
    const baseGeo = new THREE.CylinderGeometry(0.09, 0.105, 0.02, 32);
    const base = new THREE.Mesh(baseGeo, woodMat);
    base.receiveShadow = true;
    stand.add(base);

    // Tier 2 Lotus pedestal
    const lotusBaseGeo = new THREE.CylinderGeometry(0.07, 0.085, 0.025, 32);
    const lotusBase = new THREE.Mesh(lotusBaseGeo, brassMat);
    lotusBase.position.y = 0.02;
    stand.add(lotusBase);

    // Hollow lotus cup to receive handle pommel
    const cupGeo = new THREE.CylinderGeometry(0.025, 0.02, 0.04, 24, 1, true);
    const cup = new THREE.Mesh(cupGeo, brassMat);
    cup.position.y = 0.045;
    stand.add(cup);

    // Brass bead ring around stand
    const beadRingGeo = new THREE.TorusGeometry(0.088, 0.003, 12, 32);
    const beadRing = new THREE.Mesh(beadRingGeo, brassMat);
    beadRing.rotation.x = Math.PI / 2;
    beadRing.position.y = 0.01;
    stand.add(beadRing);

    return stand;
  }

  /**
   * Updates pendulum physics and particle effects based on current rotational speed.
   */
  update(angularVelocity: number, dt: number) {
    // 1. Pendulum swing physics
    // As wheel spins (angularVelocity = rad/s), centrifugal acceleration = omega^2 * r
    const absSpeed = Math.abs(angularVelocity);
    const g = 9.81;
    const r = this.anchorRadius;
    const centAccel = absSpeed * absSpeed * r;

    // Target radial swing angle outward from vertical: tan(theta) = centAccel / g
    const targetSwingAngle = Math.min(Math.PI * 0.44, Math.atan2(centAccel, g));
    this.pendulumAngle += (targetSwingAngle - this.pendulumAngle) * Math.min(1, dt * 10);

    // Target lag angle behind rotation direction
    const targetLag = -Math.sign(angularVelocity) * Math.min(Math.PI * 0.35, absSpeed * 0.04);
    this.pendulumLagAngle += (targetLag - this.pendulumLagAngle) * Math.min(1, dt * 8);

    // Update cord curve & bob position
    // Anchor position in cylinder local space
    const anchorX = 0.066;
    const anchorY = 0.0;
    const anchorZ = 0.0;

    // Bob position calculated from spherical swing
    const sinA = Math.sin(this.pendulumAngle);
    const cosA = Math.cos(this.pendulumAngle);

    // Outward vector
    const bobX = anchorX + this.cordLength * sinA * Math.cos(this.pendulumLagAngle);
    const bobZ = anchorZ + this.cordLength * sinA * Math.sin(this.pendulumLagAngle);
    const bobY = anchorY - this.cordLength * cosA;

    // Update 12 line points for realistic catenary / curved cord
    const posAttr = this.cordCurveGeometry.attributes.position as THREE.BufferAttribute;
    const count = posAttr.count;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      // Slight sag
      const sag = Math.sin(t * Math.PI) * 0.008 * (1 - sinA);
      const px = THREE.MathUtils.lerp(anchorX, bobX, t);
      const py = THREE.MathUtils.lerp(anchorY, bobY, t) - sag;
      const pz = THREE.MathUtils.lerp(anchorZ, bobZ, t);
      posAttr.setXYZ(i, px, py, pz);
    }
    posAttr.needsUpdate = true;

    // Update bob transform
    const bobGroup = this.pendulumGroup.children[1] as THREE.Group;
    if (bobGroup) {
      bobGroup.position.set(bobX, bobY, bobZ);
      bobGroup.rotation.z = -this.pendulumAngle * 0.9;
      bobGroup.rotation.y = this.pendulumLagAngle;
    }

    // 2. Aura Particles Update
    const mat = this.auraParticles.material as THREE.PointsMaterial;
    const isClockwise = angularVelocity > 0.5; // Sacred direction
    const targetOpacity = isClockwise ? Math.min(0.85, (angularVelocity - 0.5) * 0.25) : 0;
    mat.opacity += (targetOpacity - mat.opacity) * Math.min(1, dt * 6);

    if (mat.opacity > 0.01) {
      const pCount = this.auraLifetimes.length;
      for (let i = 0; i < pCount; i++) {
        this.auraLifetimes[i] += dt * 0.8;
        if (this.auraLifetimes[i] > 1) {
          this.auraLifetimes[i] = 0;
          const a = Math.random() * Math.PI * 2;
          const rad = 0.068 + Math.random() * 0.02;
          this.auraPositions[i * 3] = Math.cos(a) * rad;
          this.auraPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.09;
          this.auraPositions[i * 3 + 2] = Math.sin(a) * rad;

          this.auraVelocities[i * 3] = Math.cos(a) * 0.06;
          this.auraVelocities[i * 3 + 1] = 0.025 + Math.random() * 0.04;
          this.auraVelocities[i * 3 + 2] = Math.sin(a) * 0.06;
        } else {
          this.auraPositions[i * 3] += this.auraVelocities[i * 3] * dt;
          this.auraPositions[i * 3 + 1] += this.auraVelocities[i * 3 + 1] * dt;
          this.auraPositions[i * 3 + 2] += this.auraVelocities[i * 3 + 2] * dt;
        }
      }
      (this.auraParticles.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  setStandVisible(visible: boolean) {
    this.standGroup.visible = visible;
  }
}

/** Helper to draw inlaid turquoise / coral gemstones */
function drawGem(
  ctx: CanvasRenderingContext2D,
  bCtx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: 'turquoise' | 'coral'
) {
  const r = 10;
  // Gold Bezel
  ctx.beginPath();
  ctx.arc(x, y, r + 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd700';
  ctx.fill();
  ctx.strokeStyle = '#6b4312';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Gemstone cabochon
  const grad = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, r);
  if (type === 'turquoise') {
    grad.addColorStop(0, '#5ce8e6');
    grad.addColorStop(0.5, '#18a4a5');
    grad.addColorStop(1, '#0e5f60');
  } else {
    grad.addColorStop(0, '#ff7a6b');
    grad.addColorStop(0.5, '#e34a36');
    grad.addColorStop(1, '#8f1d10');
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Bump
  bCtx.beginPath();
  bCtx.arc(x, y, r + 3, 0, Math.PI * 2);
  bCtx.fillStyle = '#ffffff';
  bCtx.fill();
}

/** Helper to draw auspicious Tibetan Endless Knot (Shrivatsa) */
function drawEndlessKnot(
  ctx: CanvasRenderingContext2D,
  bCtx: CanvasRenderingContext2D,
  x: number,
  y: number
) {
  const size = 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  // Simplified interwoven diamond knot
  ctx.moveTo(0, -size);
  ctx.lineTo(size, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size, 0);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, -size / 2);
  ctx.lineTo(size / 2, 0);
  ctx.lineTo(0, size / 2);
  ctx.lineTo(-size / 2, 0);
  ctx.closePath();
  ctx.stroke();

  bCtx.save();
  bCtx.translate(x, y);
  bCtx.strokeStyle = '#ffffff';
  bCtx.lineWidth = 4;
  bCtx.stroke(new Path2D(`M0,${-size} L${size},0 L0,${size} L${-size},0 Z`));
  bCtx.restore();

  ctx.restore();
}
