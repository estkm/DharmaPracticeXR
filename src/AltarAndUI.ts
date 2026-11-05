/**
 * Spatial UI Card for the Om Mani Prayer Wheel using built-in XR Blocks UI.
 * Displays live mantra count, daily goal progress bar, rotation speed (RPM),
 * streak stats, sacred meaning of the six syllables, and sound/haptic toggles.
 */

import * as THREE from 'three';
import * as xb from 'xrblocks';
import { MantraTracker, TrackerState } from './MantraTracker';
import { PhysicsAndSensors } from './PhysicsAndSensors';

export class AltarAndUI {
  card: xb.UICard;
  private countText: xb.UIText;
  private progressFill: xb.UIPanel;
  private percentText: xb.UIText;
  private rpmText: xb.UIText;
  private directionStatusText: xb.UIText;
  private streakText: xb.UIText;
  private lifetimeText: xb.UIText;
  private soundButton: xb.UIButton;
  private chantButton: xb.UIButton;
  private hapticsButton: xb.UIButton;
  private directionButton: xb.UIButton;
  private modeButton: xb.UIButton;
  private goalButtons: xb.UIButton[] = [];
  private infoPanel: xb.UIPanel;
  private infoExpanded = false;
  private toggleInfoButton: xb.UIButton;

  constructor(
    private tracker: MantraTracker,
    private physics: PhysicsAndSensors,
    private onSpinRequested: (impulse: number) => void,
    private onModeToggleRequested: () => void
  ) {
    // 1. Header with Tibetan script and Title
    const header = new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(218, 165, 32, 0.25)',
      },
      children: [
        new xb.UIIcon({
          icon: 'self_improvement',
          style: { width: 38, height: 38, color: '#ffd700' },
        }),
        new xb.UIPanel({
          style: {
            flexGrow: 1,
            flexDirection: 'column',
            gap: 2,
          },
          children: [
            new xb.UIText({
              text: 'OM MANI PADME HUM',
              style: { fontSize: 22, fontWeight: 'bold', color: '#ffd700' },
            }),
            new xb.UIText({
              text: 'Tibetan Mani Khorlo • ཨོཾ་མ་ཎི་པདྨེ་ཧཱུྃ',
              style: { fontSize: 13, opacity: 0.8, color: '#f3e5ab' },
            }),
          ],
        }),
      ],
    });

    // 2. Large Mantra Counter display
    this.countText = new xb.UIText({
      text: '0 / 108',
      style: {
        fontSize: 38,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#ffea75',
      },
    });

    const counterHeader = new xb.UIText({
      text: 'MANTRAS COMPLETED TODAY',
      style: {
        fontSize: 12,
        textAlign: 'center',
        opacity: 0.75,
        color: '#d4af37',
      },
    });

    // 3. Daily Goal Progress Bar
    this.progressFill = new xb.UIPanel({
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        height: '100%',
        width: '0%',
        borderRadius: 8,
        backgroundColor: '#d4af37',
      },
    });

    const progressBarTrack = new xb.UIPanel({
      style: {
        position: 'relative',
        width: '100%',
        height: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
      },
      children: [this.progressFill],
    });

    this.percentText = new xb.UIText({
      text: '0% towards daily goal',
      style: {
        fontSize: 13,
        textAlign: 'center',
        opacity: 0.85,
        color: '#f5dfa3',
      },
    });

    // 4. Live Speed & Sacred Direction
    this.rpmText = new xb.UIText({
      text: '0 RPM',
      style: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
    });

    this.directionStatusText = new xb.UIText({
      text: 'Ready to spin (Clockwise / Sunwise)',
      style: { fontSize: 13, opacity: 0.85, color: '#88e0a8' },
    });

    const speedBar = new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 215, 0, 0.08)',
      },
      children: [this.directionStatusText, this.rpmText],
    });

    // 5. Daily Streak and Lifetime Stats
    this.streakText = new xb.UIText({
      text: '1 Day Streak',
      style: { fontSize: 14, fontWeight: 'bold', color: '#ffb347' },
    });

    this.lifetimeText = new xb.UIText({
      text: 'Total: 0',
      style: { fontSize: 14, opacity: 0.85, color: '#e0d5c1' },
    });

    const statsRow = new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingLeft: 4,
        paddingRight: 4,
      },
      children: [
        new xb.UIPanel({
          style: { flexDirection: 'row', alignItems: 'center', gap: 6 },
          children: [
            new xb.UIIcon({
              icon: 'local_fire_department',
              style: { width: 18, height: 18, color: '#ffb347' },
            }),
            this.streakText,
          ],
        }),
        this.lifetimeText,
      ],
    });

    // 6. Action Controls: Quick Spin & Mode Toggle
    const spinSlowBtn = new xb.UIButton({
      label: 'Gentle Spin',
      icon: 'rotate_right',
      style: { flexGrow: 1, height: 38 },
      onClick: () => this.onSpinRequested(4.5),
    });

    const spinFastBtn = new xb.UIButton({
      label: 'Fast Whirl',
      icon: 'sync',
      style: { flexGrow: 1, height: 38 },
      onClick: () => this.onSpinRequested(12.0),
    });

    this.modeButton = new xb.UIButton({
      label: 'Held in Hand',
      icon: 'pan_tool',
      style: { flexGrow: 1, height: 38 },
      onClick: () => this.onModeToggleRequested(),
    });

    const actionRow = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 8 },
      children: [spinSlowBtn, spinFastBtn, this.modeButton],
    });

    // 7. Settings: Sound, Haptics, Daily Goal (21, 108, 1008)
    this.soundButton = new xb.UIButton({
      label: 'Sound: ON',
      icon: 'volume_up',
      style: { flexGrow: 1, height: 34 },
      onClick: () => {
        const enabled = this.tracker.toggleSound();
        this.soundButton.label = enabled ? 'Sound: ON' : 'Sound: OFF';
        this.soundButton.icon = enabled ? 'volume_up' : 'volume_off';
      },
    });

    this.chantButton = new xb.UIButton({
      label: 'Chant: ON',
      icon: 'graphic_eq',
      style: { flexGrow: 1, height: 34 },
      onClick: () => {
        const enabled = this.tracker.toggleAmbientChant();
        this.chantButton.label = enabled ? 'Chant: ON' : 'Chant: OFF';
        this.chantButton.icon = enabled ? 'graphic_eq' : 'volume_mute';
      },
    });

    this.hapticsButton = new xb.UIButton({
      label: 'Haptics: ON',
      icon: 'vibration',
      style: { flexGrow: 1, height: 34 },
      onClick: () => {
        const enabled = this.tracker.toggleHaptics();
        this.hapticsButton.label = enabled ? 'Haptics: ON' : 'Haptics: OFF';
        this.hapticsButton.icon = enabled ? 'vibration' : 'mobile_off';
      },
    });

    this.directionButton = new xb.UIButton({
      label: 'Spin: Clockwise',
      icon: 'autorenew',
      style: { flexGrow: 1, height: 34 },
      onClick: () => {
        const inv = this.physics.toggleDirection();
        this.directionButton.label = inv ? 'Spin: Reversed' : 'Spin: Clockwise';
      },
    });

    const resetBtn = new xb.UIButton({
      label: 'Reset Today',
      icon: 'restart_alt',
      style: { flexGrow: 0.9, height: 34 },
      onClick: () => {
        this.tracker.resetToday();
      },
    });

    const settingsRow1 = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 6 },
      children: [this.soundButton, this.chantButton, this.hapticsButton],
    });

    const settingsRow2 = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 6 },
      children: [this.directionButton, resetBtn],
    });

    // Goal Buttons (21, 108, 1008)
    const goal21 = new xb.UIButton({
      label: '21 Goal',
      style: { flexGrow: 1, height: 30 },
      onClick: () => this.tracker.setDailyGoal(21),
    });
    const goal108 = new xb.UIButton({
      label: '108 (Mala)',
      style: { flexGrow: 1, height: 30 },
      onClick: () => this.tracker.setDailyGoal(108),
    });
    const goal1008 = new xb.UIButton({
      label: '1,008 Goal',
      style: { flexGrow: 1, height: 30 },
      onClick: () => this.tracker.setDailyGoal(1008),
    });
    this.goalButtons = [goal21, goal108, goal1008];

    const goalsRow = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 8, alignItems: 'center' },
      children: [
        new xb.UIText({
          text: 'Daily Goal:',
          style: { fontSize: 13, opacity: 0.75, width: 75 },
        }),
        goal21,
        goal108,
        goal1008,
      ],
    });

    // 8. Sacred Meaning & Instructions Panel
    this.infoPanel = new xb.UIPanel({
      visible: false,
      style: {
        width: '100%',
        flexDirection: 'column',
        gap: 6,
        padding: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        borderWidth: 1,
        borderColor: 'rgba(218, 165, 32, 0.2)',
      },
      children: [
        new xb.UIText({
          text: 'HOW TO PRACTICE:',
          style: { fontSize: 13, fontWeight: 'bold', color: '#ffd700' },
        }),
        new xb.UIText({
          text: '• Grasp handle in XR and whirl wrist in a gentle circular motion to sustain spin.\n• Ambient Tibetan singing bowl drone & Om Mani monk chanting swells while spinning!\n• On mobile, whirl or rotate device to activate accelerometer & gyroscope!\n• Always spin Clockwise (sunwise) to activate the mantras.\n• The weighted brass bob swings outward, maintaining momentum through inertia.',
          style: { fontSize: 12, lineHeight: 1.35, opacity: 0.9, color: '#f5dfa3' },
        }),
        new xb.UIText({
          text: 'THE SIX SYLLABLES OF COMPASSION:\n• OM (ཨོཾ): Purifies pride & ego (Generosity)\n• MA (མ་): Purifies jealousy & craving (Ethics)\n• NI (ཎི་): Purifies passion & desire (Patience)\n• PAD (པད): Purifies prejudice & ignorance (Diligence)\n• ME (མེ): Purifies greed & possessiveness (Meditation)\n• HUM (ཧཱུྃ): Purifies aggression & hatred (Wisdom)',
          style: { fontSize: 11, lineHeight: 1.35, opacity: 0.85, color: '#e8c962' },
        }),
      ],
    });

    this.toggleInfoButton = new xb.UIButton({
      label: 'Sacred Meaning & Instructions',
      icon: 'info',
      style: { width: '100%', height: 32 },
      onClick: () => {
        this.infoExpanded = !this.infoExpanded;
        this.infoPanel.visible = this.infoExpanded;
        this.toggleInfoButton.label = this.infoExpanded ? 'Hide Info' : 'Sacred Meaning & Instructions';
      },
    });

    // Assemble the complete UICard
    this.card = new xb.UICard({
      size: { width: 0.62, height: 'auto' },
      manipulation: true,
      edge: true,
      style: {
        flexDirection: 'column',
        gap: 12,
        padding: 18,
        borderRadius: 20,
        backgroundColor: 'rgba(26, 15, 10, 0.92)',
        borderColor: '#d4af37',
        borderWidth: 1.5,
      },
      children: [
        header,
        counterHeader,
        this.countText,
        progressBarTrack,
        this.percentText,
        speedBar,
        statsRow,
        actionRow,
        goalsRow,
        settingsRow1,
        settingsRow2,
        this.toggleInfoButton,
        this.infoPanel,
      ],
    });

    // Position card to the left of the prayer wheel in comfortable eye view
    this.card.position.set(-0.48, 1.45, -1.05);
    this.card.rotation.y = 0.22; // angled towards user
    this.card.name = 'OmManiPrayerWheelUICard';

    // Subscribe to tracker updates
    this.tracker.subscribe((state) => this.onStateChange(state));
  }

  private onStateChange(state: TrackerState) {
    this.countText.text = `${state.todayCount} / ${state.dailyGoal}`;

    const pct = Math.min(100, Math.round((state.todayCount / state.dailyGoal) * 100));
    this.progressFill.style.width = `${pct}%`;
    this.percentText.text = `${pct}% towards ${state.dailyGoal} daily goal`;

    this.streakText.text = `${state.streakDays} Day${state.streakDays === 1 ? '' : 's'} Streak 🔥`;
    this.lifetimeText.text = `Lifetime: ${state.totalLifetimeCount}`;

    this.soundButton.label = state.soundEnabled ? 'Sound: ON' : 'Sound: OFF';
    this.soundButton.icon = state.soundEnabled ? 'volume_up' : 'volume_off';

    this.chantButton.label = state.ambientChantEnabled ? 'Chant: ON' : 'Chant: OFF';
    this.chantButton.icon = state.ambientChantEnabled ? 'graphic_eq' : 'volume_mute';

    this.hapticsButton.label = state.hapticsEnabled ? 'Haptics: ON' : 'Haptics: OFF';
    this.hapticsButton.icon = state.hapticsEnabled ? 'vibration' : 'mobile_off';

    this.modeButton.label = state.standMode ? 'On Altar Stand' : 'Held in Hand';
    this.modeButton.icon = state.standMode ? 'table_restaurant' : 'pan_tool';
  }

  updateLiveMetrics() {
    const rpm = Math.round(this.physics.getRPM());
    this.rpmText.text = `${rpm} RPM`;

    if (rpm < 3) {
      this.directionStatusText.text = 'Gentle whirl to spin';
      this.directionStatusText.style.color = '#e0d5c1';
    } else if (this.physics.isClockwise()) {
      this.directionStatusText.text = 'Clockwise (Sunwise) • Mantras Radiating ✨';
      this.directionStatusText.style.color = '#88e0a8';
    } else {
      this.directionStatusText.text = '⚠️ Counter-Clockwise (Spin Clockwise)';
      this.directionStatusText.style.color = '#ff9999';
    }
  }

  showGoalCelebration(goal: number) {
    this.directionStatusText.text = `🎉 REJOICE! ${goal} MANTRAS COMPLETED! 🙏`;
    this.directionStatusText.style.color = '#ffd700';
  }
}
