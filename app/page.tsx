"use client";

import { useEffect, useRef, useState, CSSProperties } from "react";
console.log(process.env.NEXT_PUBLIC_PRIVY_APP_ID)
import PrivyPanel from "@/components/privy-panel";
import { usePrivy } from "@privy-io/react-auth";
// ─── CONFIG ────────────────────────────────────────────────────────────────
const GAME_CONFIG = {
  demoMode: true,
  sleepDurationMs: 1 * 60 * 1000,
  sleepCooldownMs: 2 * 60 * 1000,
  decayIntervalMs: 4000,
  growthIntervalMs: 6000,
  witherThresholdMs: 30 * 1000,
};

const LS_KEY_PREFIX = "spicy_pepper_v3";

// ─── TYPES ─────────────────────────────────────────────────────────────────
type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
type Stage = "seed" | "sprout" | "flame" | "renegade";
type Screen = "mint" | "plant" | "game";
type Mode = "idle" | "water" | "play" | "clean" | "fertilize";

const RARITIES: Rarity[] = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
const STAGES: Stage[] = ["seed", "sprout", "flame", "renegade"];

type Patch = {
  id: number;
  background: string;
};

type Pepper = {
  id: number;
  rarity: Rarity;
  stage: Stage;
  mintedAt: number;
  plantedAt: number | null;
  hydration: number;
  happiness: number;
  hygiene: number;
  growth: number;
  sleepUntil: number | null;
  lastSleepAt: number | null;
  isWithered: boolean;
  evolved: boolean;
  lastInteractionAt: number;
};

type GameState = {
  patch: Patch;
  pepper: Pepper | null;
  screen: Screen;
};

type Drop = {
  id: number;
  x: number;
  y: number;
  speed: number;
};

type DirtySpot = {
  id: number;
  x: number;
  y: number;
  removed: boolean;
};

type NotificationState = {
  text: string;
  color: string;
};

type PepperVisualProps = {
  pepper: Pepper | null;
  mode: Mode;
  style?: CSSProperties;
};

type StatBarProps = {
  label: string;
  value: number;
  color: string;
  icon: string;
};

const PATCH_BACKGROUNDS: string[] = [
  "/backgrounds/beach.png",
  "/backgrounds/desert.png",
  "/backgrounds/field.png",
  "/backgrounds/jungle.png",
  "/backgrounds/mountains.png",
  "/backgrounds/woodland.png",
];


function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomRarity(): Rarity {
  const roll = Math.random();
  if (roll < 0.45) return "Common";
  if (roll < 0.70) return "Uncommon";
  if (roll < 0.87) return "Rare";
  if (roll < 0.97) return "Epic";
  return "Legendary";
}

function rarityColor(rarity: Rarity): string {
  const map: Record<Rarity, string> = {
    Common: "#a1a1aa",
    Uncommon: "#86efac",
    Rare: "#7dd3fc",
    Epic: "#e879f9",
    Legendary: "#fbbf24",
  };
  return map[rarity];
}

function rarityGlow(rarity: Rarity): string {
  const map: Record<Rarity, string> = {
    Common: "0 0 0px transparent",
    Uncommon: "0 0 18px #86efac88",
    Rare: "0 0 22px #7dd3fc88",
    Epic: "0 0 28px #e879f988",
    Legendary: "0 0 36px #fbbf2499",
  };
  return map[rarity];
}

function stageColor(stage: Stage): string {
  const map: Record<Stage, string> = {
    seed: "#a3e635",
    sprout: "#4ade80",
    flame: "#f97316",
    renegade: "#ef4444",
  };
  return map[stage];
}

function stageGrowthRange(stage: Stage): [number, number] {
  const map: Record<Stage, [number, number]> = {
    seed: [0, 24],
    sprout: [25, 59],
    flame: [60, 99],
    renegade: [100, 100],
  };
  return map[stage];
}

function growthToStage(growth: number): Stage {
  if (growth >= 100) return "renegade";
  if (growth >= 60) return "flame";
  if (growth >= 25) return "sprout";
  return "seed";
}

function createFreshPepper(rarity: Rarity | null = null): Pepper {
  return {
    id: Date.now(),
    rarity: rarity || getRandomRarity(),
    stage: "seed",
    mintedAt: Date.now(),
    plantedAt: null,
    hydration: 50,
    happiness: 50,
    hygiene: 50,
    growth: 0,
    sleepUntil: null,
    lastSleepAt: null,
    isWithered: false,
    evolved: false,
    lastInteractionAt: Date.now(),
  };
}

function createFreshPatch(): Patch {
  return {
    id: Date.now(),
    background: randomFrom(PATCH_BACKGROUNDS),
  };
}

function defaultState(): GameState {
  return {
    patch: createFreshPatch(),
    pepper: null,
    screen: "mint",
  };
}

function loadState(storageKey: string): GameState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as GameState;
    return parsed;
  } catch {
    return defaultState();
  }
}

function saveState(storageKey: string, state: GameState): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {}
}

// ─── ICONS ─────────────────────────────────────────────────────────────────
const DropIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M12 2C12 2 5 10 5 15a7 7 0 0014 0C19 10 12 2 12 2z" />
  </svg>
);

const SleepIcon = () => (

  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
);
function getPepperImage(rarity: Rarity): string {
  const map: Record<Rarity, string> = {
    Common: "/peppers/pepper-basic.png",
    Uncommon: "/peppers/pepper-business.png",
    Rare: "/peppers/pepper-avax.png",
    Epic: "/peppers/pepper-commando.png",
    Legendary: "/peppers/pepper-king.png",
  };

  return map[rarity];
}

function getFaceImage(mode: Mode, pepper: Pepper | null, care: number): string {
  if (!pepper) return "/faces/sleepy-1.png";
  if (pepper.isWithered) return "/faces/sleepy-3.png";

  if (pepper.sleepUntil && Date.now() < pepper.sleepUntil) {
    return "/faces/sleepy-2.png";
  }

  if (mode === "water") return "/faces/play1.png";
  if (mode === "play") return "/faces/play2.png";
  if (mode === "clean") return "/faces/clean1.png";
  if (mode === "fertilize") return "/faces/ferti1.png";

  if (care < 25) return "/faces/sleepy-3.png";
  if (care < 45) return "/faces/idle5.png";
  if (care < 65) return "/faces/idle3.png";
  if (care < 85) return "/faces/idle2.png";

  return "/faces/idle-1.png";
}

// ─── PEPPER VISUALS ────────────────────────────────────────────────────────

function PepperVisual({ pepper, mode, style }: PepperVisualProps) {
  const stage = pepper?.stage || "seed";
  const care = pepper
    ? Math.round((pepper.hydration + pepper.happiness + pepper.hygiene) / 3)
    : 0;

  const glowColor = stageColor(stage);
  const rarityGlowVal = rarityGlow(pepper?.rarity ?? "Common");

  return (
    <div
      style={{
        position: "relative",
        width: 220,
        height: 220,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        filter: pepper?.isWithered ? "grayscale(1) brightness(0.5)" : "none",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: "50%",
          transform: "translateX(-50%)",
          width: 110,
          height: 42,
          borderRadius: "50%",
          background: glowColor,
          opacity: 0.18,
          filter: "blur(14px)",
          boxShadow: rarityGlowVal,
        }}
      />
      <img
        src={getFaceImage(mode, pepper, care)}
        alt="Pepper face"
        draggable={false}
        style={{
          position: "absolute",
          left: "50%",
          top: "45%",
          transform: "translate(-50%, -50%)",
          width: 150,
          height: "auto",
          objectFit: "contain",
          userSelect: "none",
          pointerEvents: "none",
          zIndex: 3,
        }}
      />

      <img
        src={getPepperImage(pepper?.rarity ?? "Common")}
        alt="Pepper"
        draggable={false}
        style={{
          width: 
            stage === "renegade"
              ? 190
              : stage === "flame"
              ? 170
              : stage === "sprout"
              ? 150
              : 130,
          height: "auto",
          objectFit: "contain",
          userSelect: "none",
          pointerEvents: "none",
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          filter:
            pepper?.sleepUntil && Date.now() < pepper.sleepUntil
              ? "brightness(0.7)"
              : "none",

        }}
      />

    </div>
  );
}

// ─── STAT BAR ──────────────────────────────────────────────────────────────
function StatBar({ label, value, color, icon }: StatBarProps) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3, color: "#cbd5e1" }}>
        <span>{icon} {label}</span>
        <span style={{ fontWeight: 600, color }}>{value}/100</span>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: "#1e293b", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${value}%`,
            background: color,
            borderRadius: 99,
            transition: "width 0.5s ease",
            boxShadow: `0 0 8px ${color}88`,
          }}
        />
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function SpicyPepperGame() {
    const { ready, authenticated, user, login, logout } = usePrivy();

  const storageKey =
    authenticated && user?.id
      ? `${LS_KEY_PREFIX}_${user.id}`
      : `${LS_KEY_PREFIX}_guest`;

  const [gameState, setGameState] = useState<GameState>(defaultState);
  const [mode, setMode] = useState<Mode>("idle");
  const [showStats, setShowStats] = useState(false);
  const [showEvolution, setShowEvolution] = useState(false);
  const [showWither, setShowWither] = useState(false);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [sleepCountdown, setSleepCountdown] = useState<number | null>(null);

  // Water game
  const [drops, setDrops] = useState<Drop[]>([]);
  const [waterScore, setWaterScore] = useState(0);
  const [waterTime, setWaterTime] = useState(8);
  const [pepperX, setPepperX] = useState(80);
  const pepperXRef = useRef<number>(80);

  // Play game
  const [toyPos, setToyPos] = useState<{ x: number; y: number }>({ x: 100, y: 80 });
  const [dragging, setDragging] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const [playTime, setPlayTime] = useState(8);

  // Clean game
  const [dirtySpots, setDirtySpots] = useState<DirtySpot[]>([]);
  const [cleanTime, setCleanTime] = useState(10);
  const [cleanScore, setCleanScore] = useState(0);

  // Fertilize game
  const [bagPos, setBagPos] = useState<{ x: number; y: number }>({ x: 30, y: 180 });
  const [draggingBag, setDraggingBag] = useState(false);
  const [fertilizeTime, setFertilizeTime] = useState(8);
  const [fertilizeDone, setFertilizeDone] = useState(false);

  const gameAreaRef = useRef<HTMLElement | null>(null);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { patch, pepper, screen } = gameState;


  // ── Save on change ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    saveState(storageKey, gameState);
  }, [gameState, ready, storageKey]);

  function updatePepper(
  updater: Partial<Pepper> | ((pepper: Pepper) => Pepper)
) {
  setGameState((prev) => {
    if (!prev.pepper) return prev;

    const updated =
      typeof updater === "function"
        ? updater(prev.pepper)
        : { ...prev.pepper, ...updater };

    return { ...prev, pepper: updated };
  });
}

  function showNotif(text: string, color: string = "#4ade80") {
  if (notifTimer.current) clearTimeout(notifTimer.current);
  setNotification({ text, color });
  notifTimer.current = setTimeout(() => setNotification(null), 2200);
}

  // ── Sleep countdown ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!pepper?.sleepUntil) { setSleepCountdown(null); return; }
    const interval = setInterval(() => {
      const remaining = (pepper.sleepUntil ?? 0) - Date.now();
      if (remaining <= 0) {
        updatePepper((p) => ({ ...p, sleepUntil: null }));
        setSleepCountdown(null);
        showNotif("Pepper je budan! 🌶️", "#fbbf24");
        clearInterval(interval);
      } else {
        setSleepCountdown(Math.ceil(remaining / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [pepper?.sleepUntil]);

  // ── Passive decay ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!pepper || pepper.isWithered || pepper.evolved) return;
    if (pepper.sleepUntil && Date.now() < pepper.sleepUntil) return;

    const interval = setInterval(() => {
      updatePepper((p) => ({
        ...p,
        hydration: Math.max(p.hydration - 3, 0),
        happiness: Math.max(p.happiness - 1, 0),
        hygiene: Math.max(p.hygiene - 1, 0),
      }));
    }, GAME_CONFIG.decayIntervalMs);

    return () => clearInterval(interval);
  }, [pepper?.sleepUntil, pepper?.isWithered, pepper?.evolved, pepper?.id]);

  // ── Passive growth ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!pepper || !pepper.plantedAt || pepper.isWithered || pepper.evolved) return;
    if (pepper.sleepUntil && Date.now() < pepper.sleepUntil) return;

    const interval = setInterval(() => {
      setGameState((prev) => {
        if (!prev.pepper) return prev;
        const p = prev.pepper;
        const care = Math.round((p.hydration + p.happiness + p.hygiene) / 3);
        let growthDelta = 0;
        if (care >= 60) growthDelta = 1;
        else if (care < 30) growthDelta = -1;

        const newGrowth = Math.min(Math.max(p.growth + growthDelta, 0), 100);
        const newStage = growthToStage(newGrowth);

        return { ...prev, pepper: { ...p, growth: newGrowth, stage: newStage } };
      });
    }, GAME_CONFIG.growthIntervalMs);

    return () => clearInterval(interval);
  }, [pepper?.sleepUntil, pepper?.isWithered, pepper?.evolved, pepper?.plantedAt, pepper?.id]);

  // ── Wither check ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pepper || pepper.isWithered || pepper.evolved) return;

    const interval = setInterval(() => {
      const care = Math.round((pepper.hydration + pepper.happiness + pepper.hygiene) / 3);
      const timeSince = Date.now() - pepper.lastInteractionAt;
      if (care < 15 && timeSince > GAME_CONFIG.witherThresholdMs) {
        updatePepper((p) => ({ ...p, isWithered: true }));
        setShowWither(true);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [pepper?.hydration, pepper?.happiness, pepper?.hygiene, pepper?.lastInteractionAt]);

  // ── Evolution check ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!pepper || pepper.evolved || pepper.isWithered) return;
    const care = Math.round((pepper.hydration + pepper.happiness + pepper.hygiene) / 3);
    if (pepper.growth >= 100 && care >= 50) {
      updatePepper((p) => ({ ...p, evolved: true, stage: "renegade" }));
      setTimeout(() => setShowEvolution(true), 400);
    }
  }, [pepper?.growth, pepper?.hydration, pepper?.happiness, pepper?.hygiene]);

  // ─── ACTIONS ────────────────────────────────────────────────────────────
  function handleMint() {
    const p = createFreshPepper();
    setGameState((prev) => ({ ...prev, pepper: p, screen: "plant" }));
  }

  function handlePlant() {
    updatePepper((p) => ({ ...p, plantedAt: Date.now() }));
    setGameState((prev) => ({ ...prev, screen: "game" }));
    showNotif("Posađeno na Patch! 🌱");
  }

  function handleSleep() {
    if (!pepper) return;
    if (pepper.sleepUntil && Date.now() < pepper.sleepUntil) {
      showNotif("Pepper već spava! 😴", "#7dd3fc");
      return;
    }
    if (pepper.lastSleepAt && Date.now() - pepper.lastSleepAt < GAME_CONFIG.sleepCooldownMs) {
      const wait = Math.ceil((GAME_CONFIG.sleepCooldownMs - (Date.now() - pepper.lastSleepAt)) / 1000);
      showNotif(`Cooldown još ${wait}s ⏳`, "#f97316");
      return;
    }
    updatePepper((p) => ({
      ...p,
      sleepUntil: Date.now() + GAME_CONFIG.sleepDurationMs,
      lastSleepAt: Date.now(),
    }));
    showNotif("Pepper spava... 💤", "#7dd3fc");
  }

  function handleRevive() {
    updatePepper((p) => ({
      ...p,
      isWithered: false,
      growth: Math.max(p.growth - 20, 0),
      hydration: 50,
      happiness: 50,
      hygiene: 50,
      lastInteractionAt: Date.now(),
    }));
    setShowWither(false);
    showNotif("Pepper oživio! 💚");
  }

  function handleHardReset() {
    const fresh = defaultState();
    setGameState(fresh);
    setMode("idle");
    setShowEvolution(false);
    setShowWither(false);
    setShowStats(false);
  }

  // ─── WATER MINI-GAME ────────────────────────────────────────────────────
  function startWater() {
    if (mode !== "idle") return;
    if (pepper?.sleepUntil && Date.now() < pepper.sleepUntil) {
      showNotif("Pepper spava!", "#7dd3fc"); return;
    }
    setMode("water");
    setDrops([]);
    setWaterScore(0);
    setWaterTime(8);
    setPepperX(80);
    pepperXRef.current = 80;
    updatePepper((p) => ({ ...p, lastInteractionAt: Date.now() }));
  }

  useEffect(() => {
    if (mode !== "water") return;
    const spawn = setInterval(() => {
      const area = gameAreaRef.current;
      if (!area) return;
      const rect = area.getBoundingClientRect();
      setDrops((prev) => [
        ...prev,
        { id: Math.random(), x: Math.random() * (rect.width - 24), y: -24, speed: 4 + Math.random() * 3 },
      ]);
    }, 420);
    return () => clearInterval(spawn);
  }, [mode]);

  useEffect(() => {
    if (mode !== "water") return;
    const fall = setInterval(() => {
      const area = gameAreaRef.current;
      if (!area) return;
      const rect = area.getBoundingClientRect();
      const px = pepperXRef.current;
      const pLeft = px, pRight = px + 180, pTop = rect.height - 230, pBottom = rect.height - 20;
      let hits = 0;
      setDrops((prev) => {
        const next = [];
        for (const d of prev) {
          const nd = { ...d, y: d.y + d.speed };
          const hit = nd.x + 20 > pLeft && nd.x < pRight && nd.y + 20 > pTop && nd.y < pBottom;
          if (hit) { hits++; continue; }
          if (nd.y < rect.height + 30) next.push(nd);
        }
        return next;
      });
      if (hits > 0) setWaterScore((s) => s + hits);
    }, 28);
    return () => clearInterval(fall);
  }, [mode]);

  useEffect(() => {
    if (mode !== "water") return;
    const t = setInterval(() => {
      setWaterTime((prev) => {
        if (prev <= 1) {
          const gain = Math.min(waterScore * 5, 35);
          const growthBonus = Math.max(2, Math.floor(waterScore / 2));
          updatePepper((p) => ({
            ...p,
            hydration: Math.min(p.hydration + gain, 100),
            growth: Math.min(p.growth + growthBonus, 100),
            stage: growthToStage(Math.min(p.growth + growthBonus, 100)),
            lastInteractionAt: Date.now(),
          }));
          showNotif(`+${gain} Hydration 💧 +${growthBonus} Growth`, "#7dd3fc");
          setMode("idle");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [mode, waterScore]);

  function movePepper(clientX: number) {
    const area = gameAreaRef.current;
    if (!area) return;
    const rect = area.getBoundingClientRect();
    let nx = clientX - rect.left - 90;
    nx = Math.max(0, Math.min(nx, rect.width - 180));
    pepperXRef.current = nx;
    setPepperX(nx);
  }

  // ─── PLAY MINI-GAME ─────────────────────────────────────────────────────
  function startPlay() {
    if (mode !== "idle") return;
    if (pepper?.sleepUntil && Date.now() < pepper.sleepUntil) {
      showNotif("Pepper spava!", "#7dd3fc"); return;
    }
    setMode("play");
    setPlayProgress(0);
    setPlayTime(8);
    setToyPos({ x: 100, y: 80 });
    setDragging(false);
    updatePepper((p) => ({ ...p, lastInteractionAt: Date.now() }));
  }

  useEffect(() => {
    if (mode !== "play" || !dragging) return;
    const i = setInterval(() => setPlayProgress((p) => Math.min(p + 4, 100)), 100);
    return () => clearInterval(i);
  }, [mode, dragging]);

  useEffect(() => {
    if (mode !== "play") return;
    const t = setInterval(() => {
      setPlayTime((prev) => {
        if (prev <= 1) {
          const gain = Math.min(Math.floor(playProgress / 3), 30);
          updatePepper((p) => ({
            ...p,
            happiness: Math.min(p.happiness + gain, 100),
            lastInteractionAt: Date.now(),
          }));
          showNotif(`+${gain} Happiness ⚽`, "#f472b6");
          setMode("idle");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [mode, playProgress]);

  // ─── CLEAN MINI-GAME ────────────────────────────────────────────────────
  function startClean() {
    if (mode !== "idle") return;
    if (pepper?.sleepUntil && Date.now() < pepper.sleepUntil) {
      showNotif("Pepper spava!", "#7dd3fc"); return;
    }
    const area = gameAreaRef.current;
    const rect = area?.getBoundingClientRect() || { width: 320, height: 400 };
    const spots = Array.from({ length: 6 }, (_, i) => ({
      id: i,
      x: 20 + Math.random() * (rect.width - 60),
      y: 30 + Math.random() * (rect.height * 0.6),
      removed: false,
    }));
    setDirtySpots(spots);
    setCleanScore(0);
    setCleanTime(10);
    setMode("clean");
    updatePepper((p) => ({ ...p, lastInteractionAt: Date.now() }));
  }

  function tapSpot(id: number) {
    setDirtySpots((prev) => {
      const next = prev.map((s) => s.id === id ? { ...s, removed: true } : s);
      const removed = next.filter((s) => s.removed).length;
      setCleanScore(removed);
      return next;
    });
  }

  useEffect(() => {
    if (mode !== "clean") return;
    const t = setInterval(() => {
      setCleanTime((prev) => {
        if (prev <= 1) {
          const all = dirtySpots.length;
          const removed = dirtySpots.filter((s) => s.removed).length;
          const gain = Math.round((removed / Math.max(all, 1)) * 35);
          updatePepper((p) => ({
            ...p,
            hygiene: Math.min(p.hygiene + gain, 100),
            lastInteractionAt: Date.now(),
          }));
          showNotif(`+${gain} Hygiene 🫧`, "#a78bfa");
          setMode("idle");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);

  }, [mode, dirtySpots]);

    useEffect(() => {
    if (!ready) return;
    setGameState(loadState(storageKey));
  }, [ready, storageKey]);

  // ─── FERTILIZE MINI-GAME ─────────────────────────────────────────────────
  function startFertilize() {
    if (mode !== "idle") return;
    if (pepper?.sleepUntil && Date.now() < pepper.sleepUntil) {
      showNotif("Pepper spava!", "#7dd3fc"); return;
    }
    setBagPos({ x: 30, y: 200 });
    setDraggingBag(false);
    setFertilizeTime(8);
    setFertilizeDone(false);
    setMode("fertilize");
    updatePepper((p) => ({ ...p, lastInteractionAt: Date.now() }));
  }

  useEffect(() => {
    if (mode !== "fertilize") return;
    const t = setInterval(() => {
      setFertilizeTime((prev) => {
        if (prev <= 1) {
          if (!fertilizeDone) showNotif("Previše sporo! 😬", "#f97316");
          setMode("idle");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [mode, fertilizeDone]);

  function checkFertilizeDrop(x: number, y: number) {
    const area = gameAreaRef.current;
    if (!area) return;
    const rect = area.getBoundingClientRect();
    const zoneX = rect.width / 2 - 50;
    const zoneY = rect.height - 200;
    if (x > zoneX - 30 && x < zoneX + 130 && y > zoneY - 30 && y < zoneY + 130) {
      const gain = 12;
      updatePepper((p) => ({
        ...p,
        growth: Math.min(p.growth + gain, 100),
        stage: growthToStage(Math.min(p.growth + gain, 100)),
        lastInteractionAt: Date.now(),
      }));
      showNotif(`+${gain} Growth 🌿`, "#a3e635");
      setFertilizeDone(true);
      setMode("idle");
    }
  }

  // ─── GAME AREA HANDLERS ─────────────────────────────────────────────────
  function handleAreaMove(clientX: number, clientY: number) {
    if (mode === "water") movePepper(clientX);
    if (mode === "play" && dragging) {
      const rect = gameAreaRef.current?.getBoundingClientRect();
      if (!rect) return;
      setToyPos({ x: clientX - rect.left - 24, y: clientY - rect.top - 24 });
    }
    if (mode === "fertilize" && draggingBag) {
      const rect = gameAreaRef.current?.getBoundingClientRect();
      if (!rect) return;
      setBagPos({ x: clientX - rect.left - 28, y: clientY - rect.top - 28 });
    }
  }

  function handleAreaUp(clientX: number, clientY: number) {
    if (mode === "play") setDragging(false);
    if (mode === "fertilize" && draggingBag) {
      const rect = gameAreaRef.current?.getBoundingClientRect();
      if (rect) checkFertilizeDrop(clientX - rect.left, clientY - rect.top);
      setDraggingBag(false);
    }
  }

  const care = pepper
    ? Math.round((pepper.hydration + pepper.happiness + pepper.hygiene) / 3)
    : 0;

  const isSleeping = !!pepper?.sleepUntil && Date.now() < pepper.sleepUntil;

  // ─── RENDER ─────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #000; font-family: 'DM Sans', sans-serif; }
        @keyframes pepperFloat {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-20px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes confetti {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(120px) rotate(720deg); opacity: 0; }
        }
        @keyframes glow {
          0%,100% { box-shadow: 0 0 20px #ef444499; }
          50% { box-shadow: 0 0 40px #ef4444cc, 0 0 80px #f9731644; }
        }
        .btn {
          border: none;
          border-radius: 14px;
          padding: 12px 16px;
          font-family: 'Syne', sans-serif;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.1s, opacity 0.2s;
          width: 100%;
        }
        .btn:active { transform: scale(0.96); }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>

      <div style={{
        minHeight: "100dvh",
        background: "#050505",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
      }}>
        <div style={{
          width: "100%",
          maxWidth: 430,
          minHeight: "100dvh",
          position: "relative",
          overflow: "hidden",
          backgroundImage: `url(${patch.background})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}>
          {/* Dark overlay */}
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />

          {/* NOTIFICATION */}
          {notification && (
            <div style={{
              position: "absolute",
              top: 80,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.85)",
              border: `1px solid ${notification.color}44`,
              color: notification.color,
              padding: "10px 22px",
              borderRadius: 99,
              fontFamily: "Syne, sans-serif",
              fontSize: 14,
              fontWeight: 700,
              zIndex: 999,
              whiteSpace: "nowrap",
              animation: "dropIn 0.3s ease",
              boxShadow: `0 0 20px ${notification.color}33`,
            }}>
              {notification.text}
            </div>
          )}

          {/* ── MINT SCREEN ──────────────────────────────────────────── */}
          {screen === "mint" && (
            <div style={{
              position: "relative",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "100dvh",
              padding: "40px 28px",
              gap: 24,
              animation: "dropIn 0.5s ease",
            }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: "Syne, sans-serif", fontSize: 11, letterSpacing: 4, color: "#f97316", textTransform: "uppercase", marginBottom: 12 }}>
                  Spicy Pepper
                </p>
                <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 42, fontWeight: 800, color: "#fff", lineHeight: 1.1, marginBottom: 16 }}>
                  Mint<br />Your Pepper
                </h1>
                <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>
                  Uzgoji svog NFT Peppera kroz 7 dana brige.<br />Hrani, zalijevaj i evolviraj u Renegade.
                </p>
              </div>

              <div style={{ fontSize: 96 }}>🌶️</div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                width: "100%",
                maxWidth: 320,
              }}>
                {RARITIES.map((r) => (
                  <div key={r} style={{
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${rarityColor(r)}33`,
                    borderRadius: 12,
                    padding: "8px 12px",
                    textAlign: "center",
                    fontSize: 12,
                    fontFamily: "Syne, sans-serif",
                    fontWeight: 600,
                    color: rarityColor(r),
                  }}>
                    {r}
                  </div>
                ))}
              </div>

              <button className="btn" onClick={handleMint} style={{
                background: "linear-gradient(135deg, #f97316, #ef4444)",
                color: "#fff",
                fontSize: 17,
                padding: "16px",
                maxWidth: 320,
                animation: "glow 2s ease-in-out infinite",
              }}>
                🌶️ Mint Pepper
              </button>
            </div>
          )}

          {/* ── PLANT SCREEN ─────────────────────────────────────────── */}
          {screen === "plant" && pepper && (
            <div style={{
              position: "relative",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "100dvh",
              padding: "40px 28px",
              gap: 24,
              animation: "dropIn 0.5s ease",
            }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: "Syne, sans-serif", fontSize: 11, letterSpacing: 4, color: "#a3e635", textTransform: "uppercase", marginBottom: 12 }}>
                  Pepper Minted!
                </p>
                <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
                  Plant on Patch
                </h2>
                <p style={{ color: "#94a3b8", fontSize: 14 }}>
                  Postavi ga na tvoj Land Patch da počne rasti.
                </p>
              </div>

              {/* Pepper card */}
              <div style={{
                background: "rgba(255,255,255,0.07)",
                border: `1px solid ${rarityColor(pepper.rarity)}44`,
                borderRadius: 24,
                padding: "28px 32px",
                textAlign: "center",
                boxShadow: rarityGlow(pepper.rarity),
                width: "100%",
                maxWidth: 280,
              }}>
                <div style={{ fontSize: 72, marginBottom: 16 }}>🌱</div>
                <p style={{
                  fontFamily: "Syne, sans-serif",
                  fontWeight: 800,
                  fontSize: 20,
                  color: rarityColor(pepper.rarity),
                  marginBottom: 6,
                }}>
                  {pepper.rarity}
                </p>
                <p style={{ color: "#64748b", fontSize: 12 }}>
                  #{pepper.id.toString().slice(-6)}
                </p>
              </div>

              <div style={{ width: "100%", maxWidth: 280, display: "flex", flexDirection: "column", gap: 10 }}>
                <button className="btn" onClick={handlePlant} style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "#fff", padding: 16, fontSize: 16 }}>
                  🌱 Plant on Patch #{patch.id}
                </button>
                <button className="btn" onClick={handleHardReset} style={{ background: "rgba(255,255,255,0.07)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)" }}>
                  Resetiraj
                </button>
              </div>
            </div>
          )}

          {/* ── GAME SCREEN ──────────────────────────────────────────── */}
          {screen === "game" && pepper && (
            <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", minHeight: "100dvh" }}>

              {/* Header */}
              <header style={{ padding: "16px 16px 8px" }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(0,0,0,0.5)",
                  backdropFilter: "blur(12px)",
                  borderRadius: 18,
                  padding: "12px 16px",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}>
                  <div>
                    <p style={{ fontSize: 10, color: "#64748b", fontFamily: "Syne, sans-serif", letterSpacing: 2, textTransform: "uppercase" }}>
                      Patch #{patch.id}
                    </p>
                    <p style={{ fontSize: 15, fontWeight: 700, fontFamily: "Syne, sans-serif", color: rarityColor(pepper.rarity) }}>
                      {pepper.rarity} · {pepper.stage.charAt(0).toUpperCase() + pepper.stage.slice(1)}
                    </p>
                  </div>

                  <div style={{ textAlign: "center" }}>
                    {isSleeping ? (
                      <div style={{ animation: "pulse 1.5s ease-in-out infinite", color: "#7dd3fc", fontSize: 12, fontFamily: "Syne, sans-serif" }}>
                        💤 {sleepCountdown}s
                      </div>
                    ) : (
                      <>
                        <p style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Care</p>
                        <p style={{ fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif", color: care < 30 ? "#ef4444" : care < 60 ? "#f97316" : "#4ade80" }}>
                          {care}%
                        </p>
                      </>
                    )}
                  </div>

                  <button onClick={handleSleep} style={{
                    background: "rgba(125,211,252,0.12)",
                    border: "1px solid rgba(125,211,252,0.25)",
                    borderRadius: 12,
                    padding: "8px 12px",
                    color: "#7dd3fc",
                    fontSize: 20,
                    cursor: "pointer",
                  }}>
                    <SleepIcon />
                  </button>
                </div>
              </header>

              {/* Game area */}
              <section
                ref={gameAreaRef}
                style={{ flex: 1, position: "relative", touchAction: "none", userSelect: "none" }}
                onMouseMove={(e) => handleAreaMove(e.clientX, e.clientY)}
                onMouseUp={(e) => handleAreaUp(e.clientX, e.clientY)}
                onMouseLeave={(e) => handleAreaUp(e.clientX, e.clientY)}
                onTouchMove={(e) => {
                  e.preventDefault();
                  handleAreaMove(e.touches[0].clientX, e.touches[0].clientY);
                }}
                onTouchEnd={(e) => {
                  const t = e.changedTouches[0];
                  handleAreaUp(t.clientX, t.clientY);
                }}
              >
                {/* Water drops */}
                {mode === "water" && drops.map((d) => (
                  <div key={d.id} style={{
                    position: "absolute",
                    left: d.x,
                    top: d.y,
                    width: 20,
                    height: 26,
                    borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
                    background: "linear-gradient(180deg, #93c5fd, #3b82f6)",
                    boxShadow: "0 0 8px #3b82f666",
                    pointerEvents: "none",
                  }} />
                ))}

                {/* Play toy */}
                {mode === "play" && (
                  <div
                    onMouseDown={() => setDragging(true)}
                    onTouchStart={() => setDragging(true)}
                    style={{
                      position: "absolute",
                      left: toyPos.x,
                      top: toyPos.y,
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      background: dragging
                        ? "linear-gradient(135deg,#f43f5e,#ec4899)"
                        : "linear-gradient(135deg,#ec4899,#f9a8d4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 26,
                      cursor: dragging ? "grabbing" : "grab",
                      boxShadow: dragging ? "0 0 24px #ec489988" : "0 4px 16px #0006",
                      transition: "background 0.2s, box-shadow 0.2s",
                      zIndex: 30,
                    }}
                  >
                    ⚽
                  </div>
                )}

                {/* Clean dirty spots */}
                {mode === "clean" && dirtySpots.map((s) => !s.removed && (
                  <button
                    key={s.id}
                    onClick={() => tapSpot(s.id)}
                    style={{
                      position: "absolute",
                      left: s.x,
                      top: s.y,
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      background: "radial-gradient(circle, #78350f, #92400e)",
                      border: "2px solid #b45309",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      cursor: "pointer",
                      zIndex: 30,
                      boxShadow: "0 0 12px #92400e88",
                      animation: "pulse 1s ease-in-out infinite",
                    }}
                  >
                    💩
                  </button>
                ))}

                {/* Fertilize drop zone */}
                {mode === "fertilize" && (
                  <div style={{
                    position: "absolute",
                    bottom: 220,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 100,
                    height: 100,
                    borderRadius: 20,
                    border: "2px dashed #a3e63588",
                    background: "rgba(163,230,53,0.07)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 32,
                    zIndex: 20,
                  }}>
                    🟫
                  </div>
                )}

                {/* Fertilize bag */}
                {mode === "fertilize" && !fertilizeDone && (
                  <div
                    onMouseDown={() => setDraggingBag(true)}
                    onTouchStart={() => setDraggingBag(true)}
                    style={{
                      position: "absolute",
                      left: bagPos.x,
                      top: bagPos.y,
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      background: draggingBag ? "#713f12" : "#854d0e",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 30,
                      cursor: draggingBag ? "grabbing" : "grab",
                      boxShadow: draggingBag ? "0 0 20px #a3e63566" : "0 4px 16px #0006",
                      zIndex: 35,
                      border: "2px solid #a16207",
                    }}
                  >
                    🌿
                  </div>
                )}

                {/* Timer overlay */}
                {(mode === "water" || mode === "play" || mode === "clean" || mode === "fertilize") && (
                  <div style={{
                    position: "absolute",
                    top: 14,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(0,0,0,0.7)",
                    backdropFilter: "blur(8px)",
                    borderRadius: 99,
                    padding: "6px 18px",
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: "Syne, sans-serif",
                    color: "#7dd3fc",
                    zIndex: 40,
                  }}>
                    {mode === "water" && `💧 ${waterTime}s · ${waterScore} drops`}
                    {mode === "play" && `⚽ ${playTime}s`}
                    {mode === "clean" && `🫧 ${cleanTime}s · ${cleanScore}/${dirtySpots.length}`}
                    {mode === "fertilize" && `🌿 ${fertilizeTime}s · Drag to zone`}
                  </div>
                )}

                {/* Pepper character */}
                <div style={{
                  position: "absolute",
                  bottom: 20,
                  left: mode === "water" ? pepperX : "50%",
                  transform: mode === "water" ? "none" : "translateX(-50%)",
                  pointerEvents: "none",
                  transition: mode === "water" ? "none" : "left 0.3s ease",
                }}>
                  <PepperVisual pepper={pepper} mode={mode} style={{}} />
                </div>

                {/* Sleep overlay */}
                {isSleeping && (
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,0.55)",
                    backdropFilter: "blur(3px)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    zIndex: 50,
                  }}>
                    <div style={{ fontSize: 64 }}>💤</div>
                    <p style={{ fontFamily: "Syne, sans-serif", fontSize: 20, fontWeight: 800, color: "#7dd3fc" }}>
                      Pepper spava
                    </p>
                    <p style={{ color: "#64748b", fontSize: 14 }}>
                      Budi se za {sleepCountdown}s
                    </p>
                  </div>
                )}
              </section>

              {/* Bottom panel */}
              <section style={{ padding: "8px 16px 20px" }}>
                <div style={{
                  background: "rgba(0,0,0,0.6)",
                  backdropFilter: "blur(16px)",
                  borderRadius: 24,
                  padding: "16px",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}>
                  {/* Care bar */}
                  <StatBar label="Care" value={care} color={care < 30 ? "#ef4444" : care < 60 ? "#f97316" : "#4ade80"} icon="❤️" />

                  {/* Growth bar */}
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3, color: "#cbd5e1" }}>
                      <span>🌱 Growth · <span style={{ color: stageColor(pepper.stage), fontWeight: 700 }}>{pepper.stage}</span></span>
                      <span style={{ fontWeight: 600, color: "#fbbf24" }}>{pepper.growth}/100</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 99, background: "#1e293b", overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${pepper.growth}%`,
                        background: `linear-gradient(90deg, ${stageColor(pepper.stage)}, #fbbf24)`,
                        borderRadius: 99,
                        transition: "width 0.5s ease",
                        boxShadow: `0 0 10px ${stageColor(pepper.stage)}88`,
                      }} />
                    </div>
                  </div>

                  {/* Play progress during play mode */}
                  {mode === "play" && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3, color: "#cbd5e1" }}>
                        <span>⚽ Play Progress</span>
                        <span style={{ color: "#f472b6", fontWeight: 700 }}>{playProgress}%</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 99, background: "#1e293b", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${playProgress}%`, background: "#ec4899", borderRadius: 99, transition: "width 0.15s", boxShadow: "0 0 8px #ec489988" }} />
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                    <button className="btn" onClick={startWater} disabled={mode !== "idle" || isSleeping} style={{ background: mode === "water" ? "#1d4ed8" : "rgba(59,130,246,0.85)", color: "#fff" }}>
                      💧 Water
                    </button>
                    <button className="btn" onClick={startPlay} disabled={mode !== "idle" || isSleeping} style={{ background: mode === "play" ? "#9d174d" : "rgba(236,72,153,0.85)", color: "#fff" }}>
                      ⚽ Play
                    </button>
                    <button className="btn" onClick={startClean} disabled={mode !== "idle" || isSleeping} style={{ background: mode === "clean" ? "#5b21b6" : "rgba(139,92,246,0.85)", color: "#fff" }}>
                      🫧 Clean
                    </button>
                    <button className="btn" onClick={startFertilize} disabled={mode !== "idle" || isSleeping} style={{ background: mode === "fertilize" ? "#713f12" : "rgba(161,98,7,0.85)", color: "#fff" }}>
                      🌿 Fertilize
                    </button>
                  </div>

                  {/* Secondary buttons */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                    <button className="btn" onClick={() => setShowStats((s) => !s)} style={{ background: "rgba(255,255,255,0.07)", color: "#cbd5e1", border: "1px solid rgba(255,255,255,0.1)" }}>
                      {showStats ? "Hide Stats" : "📊 Stats"}
                    </button>
                    <button className="btn" onClick={handleHardReset} style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                      🔄 Reset
                    </button>
                  </div>

                  {/* Stats panel */}
                  {showStats && (
                    <div style={{ marginTop: 14, padding: "14px", background: "rgba(0,0,0,0.4)", borderRadius: 16, animation: "dropIn 0.25s ease" }}>
                      <StatBar label="Hydration" value={pepper.hydration} color="#7dd3fc" icon="💧" />
                      <StatBar label="Happiness" value={pepper.happiness} color="#f472b6" icon="⚽" />
                      <StatBar label="Hygiene" value={pepper.hygiene} color="#a78bfa" icon="🫧" />
                      <div style={{ marginTop: 8, fontSize: 11, color: "#475569", textAlign: "center", fontFamily: "Syne, sans-serif" }}>
                        ID #{pepper.id.toString().slice(-6)} · Planted: {pepper.plantedAt ? new Date(pepper.plantedAt).toLocaleTimeString() : "—"}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* ── WITHER MODAL ─────────────────────────────────────────── */}
          {showWither && (
            <div style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
              padding: "24px",
              animation: "dropIn 0.4s ease",
            }}>
              <div style={{
                background: "#0f0f0f",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 28,
                padding: "36px 28px",
                textAlign: "center",
                width: "100%",
                maxWidth: 320,
                boxShadow: "0 0 60px rgba(239,68,68,0.2)",
              }}>
                <div style={{ fontSize: 72, marginBottom: 20 }}>💀</div>
                <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 26, fontWeight: 800, color: "#ef4444", marginBottom: 10 }}>
                  Pepper Venuo
                </h2>
                <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                  Nisi se dovoljno brinuo o pepperu. Možeš ga oživiti uz kaznu od -20% growth.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button className="btn" onClick={handleRevive} style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", padding: 16, fontSize: 15 }}>
                    💚 Revive (-20% Growth)
                  </button>
                  <button className="btn" onClick={handleHardReset} style={{ background: "rgba(255,255,255,0.07)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)" }}>
                    🌱 Mint Novi Pepper
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── EVOLUTION MODAL ───────────────────────────────────────── */}
          {showEvolution && (
            <div style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.9)",
              backdropFilter: "blur(12px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 200,
              padding: "24px",
              animation: "dropIn 0.5s ease",
            }}>
              {/* Confetti */}
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} style={{
                  position: "absolute",
                  left: `${Math.random() * 100}%`,
                  top: "-20px",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: ["#f97316","#ef4444","#fbbf24","#4ade80","#7dd3fc","#e879f9"][i % 6],
                  animation: `confetti ${1.5 + Math.random()}s ease-out ${Math.random() * 0.5}s forwards`,
                  opacity: 0,
                }} />
              ))}

              <div style={{
                background: "linear-gradient(160deg, #0f0a00, #1a0f00)",
                border: "1px solid #fbbf2444",
                borderRadius: 32,
                padding: "44px 32px",
                textAlign: "center",
                width: "100%",
                maxWidth: 340,
                boxShadow: "0 0 80px rgba(251,191,36,0.25), 0 0 160px rgba(239,68,68,0.1)",
                position: "relative",
              }}>
                <div style={{ fontSize: 100, marginBottom: 20, animation: "pepperFloat 2s ease-in-out infinite" }}>
                  🔥
                </div>
                <div style={{
                  fontFamily: "Syne, sans-serif",
                  fontSize: 11,
                  letterSpacing: 4,
                  color: "#fbbf24",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}>
                  Evolution Complete
                </div>
                <h2 style={{
                  fontFamily: "Syne, sans-serif",
                  fontSize: 36,
                  fontWeight: 800,
                  marginBottom: 10,
                  background: "linear-gradient(135deg, #fbbf24, #ef4444)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}>
                  Renegade!
                </h2>
                <p style={{
                  color: "#fbbf2488",
                  fontSize: 14,
                  lineHeight: 1.6,
                  marginBottom: 8,
                }}>
                  Rarity: <span style={{ color: rarityColor(pepper?.rarity ?? "Common"), fontWeight: 700 }}>
                    {pepper?.rarity}
                  </span>
                </p>
                <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6, marginBottom: 28 }}>
                  Tvoj pepper je dostigao konačnu evoluciju. Čestitamo!
                </p>
                <button className="btn" onClick={() => { setShowEvolution(false); handleHardReset(); }} style={{
                  background: "linear-gradient(135deg, #f97316, #ef4444)",
                  color: "#fff",
                  padding: 16,
                  fontSize: 16,
                  animation: "glow 2s ease-in-out infinite",
                }}>
                  🌶️ Mint Novog Peppera
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}