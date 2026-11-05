/**
 * Daily mantra tracking and progress persistence for the Om Mani Prayer Wheel.
 */

export interface DayRecord {
  date: string; // YYYY-MM-DD
  count: number;
  minutesSpent: number;
}

export interface TrackerState {
  todayDate: string;
  todayCount: number;
  dailyGoal: number;
  totalLifetimeCount: number;
  streakDays: number;
  history: Record<string, DayRecord>;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  ambientChantEnabled: boolean; // Ambient singing bowl and Om Mani chanting
  standMode: boolean; // true if placed on altar stand, false if held
}

const STORAGE_KEY = 'om_mani_prayer_wheel_data_v1';

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class MantraTracker {
  state: TrackerState;
  private listeners: Array<(state: TrackerState) => void> = [];
  private sessionStartTime: number = Date.now();

  constructor() {
    this.state = this.loadState();
    this.checkDayRollover();
  }

  private loadState(): TrackerState {
    const defaultState: TrackerState = {
      todayDate: getTodayString(),
      todayCount: 0,
      dailyGoal: 108,
      totalLifetimeCount: 0,
      streakDays: 1,
      history: {},
      soundEnabled: true,
      hapticsEnabled: true,
      ambientChantEnabled: true,
      standMode: false,
    };

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...defaultState,
          ...parsed,
        };
      }
    } catch (e) {
      console.warn('Failed to load prayer wheel progress from localStorage:', e);
    }
    return defaultState;
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('Failed to save prayer wheel progress:', e);
    }
    this.notify();
  }

  checkDayRollover() {
    const today = getTodayString();
    if (this.state.todayDate !== today) {
      // Check streak
      const lastDate = new Date(this.state.todayDate);
      const currDate = new Date(today);
      const diffDays = Math.round(
        (currDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Save previous day to history if count > 0
      if (this.state.todayCount > 0) {
        this.state.history[this.state.todayDate] = {
          date: this.state.todayDate,
          count: this.state.todayCount,
          minutesSpent: this.state.history[this.state.todayDate]?.minutesSpent || 1,
        };
      }

      if (diffDays === 1 && this.state.todayCount >= Math.min(21, this.state.dailyGoal)) {
        this.state.streakDays += 1;
      } else if (diffDays > 1) {
        this.state.streakDays = 1;
      }

      this.state.todayDate = today;
      this.state.todayCount = 0;
      this.saveState();
    }
  }

  addMantra(amount = 1): { completedMantra: boolean; hitGoal: boolean } {
    this.checkDayRollover();
    const prevCount = this.state.todayCount;
    this.state.todayCount += amount;
    this.state.totalLifetimeCount += amount;

    // Track minutes
    const now = Date.now();
    const minutesDelta = Math.floor((now - this.sessionStartTime) / 60000);
    if (!this.state.history[this.state.todayDate]) {
      this.state.history[this.state.todayDate] = {
        date: this.state.todayDate,
        count: this.state.todayCount,
        minutesSpent: Math.max(1, minutesDelta),
      };
    } else {
      this.state.history[this.state.todayDate].count = this.state.todayCount;
      this.state.history[this.state.todayDate].minutesSpent += Math.max(0, minutesDelta);
    }
    this.sessionStartTime = now;

    const hitGoal =
      prevCount < this.state.dailyGoal && this.state.todayCount >= this.state.dailyGoal;

    this.saveState();
    return { completedMantra: true, hitGoal };
  }

  setDailyGoal(goal: number) {
    this.state.dailyGoal = goal;
    this.saveState();
  }

  toggleSound(enabled?: boolean): boolean {
    this.state.soundEnabled = enabled !== undefined ? enabled : !this.state.soundEnabled;
    this.saveState();
    return this.state.soundEnabled;
  }

  toggleAmbientChant(enabled?: boolean): boolean {
    this.state.ambientChantEnabled =
      enabled !== undefined ? enabled : !this.state.ambientChantEnabled;
    this.saveState();
    return this.state.ambientChantEnabled;
  }

  toggleHaptics(enabled?: boolean): boolean {
    this.state.hapticsEnabled = enabled !== undefined ? enabled : !this.state.hapticsEnabled;
    this.saveState();
    return this.state.hapticsEnabled;
  }

  toggleStandMode(stand?: boolean): boolean {
    this.state.standMode = stand !== undefined ? stand : !this.state.standMode;
    this.saveState();
    return this.state.standMode;
  }

  resetToday() {
    this.state.todayCount = 0;
    if (this.state.history[this.state.todayDate]) {
      this.state.history[this.state.todayDate].count = 0;
    }
    this.saveState();
  }

  subscribe(listener: (state: TrackerState) => void): () => void {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('Error notifying tracker listener:', err);
      }
    }
  }
}
