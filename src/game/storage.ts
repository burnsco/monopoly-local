import { BOARD_SPACES } from "./data/board";
import type { DeedState, DeckType, GameState, TurnPhase } from "./types";

export const SAVE_KEY = "monopoly-local-save";
const PURCHASABLE_SPACES = BOARD_SPACES.filter(
  (space) => space.type === "property" || space.type === "railroad" || space.type === "utility",
);
const VALID_PHASES = new Set<TurnPhase>([
  "await_roll",
  "moving",
  "await_purchase",
  "show_card",
  "auction",
  "manage_debt",
  "await_end_turn",
  "game_over",
]);
const VALID_DECKS: readonly DeckType[] = ["chance", "communityChest"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDeedState(value: unknown): value is DeedState {
  return (
    isRecord(value) &&
    (value.ownerId === null || typeof value.ownerId === "string") &&
    typeof value.houses === "number" &&
    typeof value.hotel === "boolean" &&
    typeof value.mortgaged === "boolean"
  );
}

function isValidGameState(value: unknown): value is GameState {
  if (!isRecord(value)) {
    return false;
  }

  const deeds = value.deeds;
  const decks = value.decks;
  const settings = value.settings;

  if (
    !Array.isArray(value.players) ||
    !value.players.every(
      (player) =>
        isRecord(player) &&
        typeof player.id === "string" &&
        typeof player.name === "string" &&
        typeof player.token === "string" &&
        typeof player.color === "string" &&
        typeof player.money === "number" &&
        typeof player.position === "number" &&
        typeof player.inJail === "boolean" &&
        typeof player.jailTurns === "number" &&
        typeof player.bankrupt === "boolean" &&
        Array.isArray(player.getOutOfJailCards),
    )
  ) {
    return false;
  }

  if (
    typeof value.currentPlayerIndex !== "number" ||
    !VALID_PHASES.has(value.phase as TurnPhase) ||
    !isRecord(deeds) ||
    !PURCHASABLE_SPACES.every((space) => isDeedState(deeds[String(space.index)])) ||
    !isRecord(decks) ||
    !VALID_DECKS.every(
      (deckType) =>
        isRecord(decks[deckType]) &&
        Array.isArray(decks[deckType].drawPile) &&
        Array.isArray(decks[deckType].discardPile),
    ) ||
    !Array.isArray(value.log) ||
    !isRecord(settings) ||
    typeof settings.passGoAmount !== "number" ||
    typeof settings.bailAmount !== "number" ||
    typeof settings.startingMoney !== "number" ||
    typeof settings.auctionsEnabled !== "boolean"
  ) {
    return false;
  }

  return true;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState): void {
  getStorage()?.setItem(SAVE_KEY, JSON.stringify(state));
}

export function loadGame(): GameState | null {
  const storage = getStorage();
  const saved = storage?.getItem(SAVE_KEY);

  if (!saved) {
    return null;
  }

  try {
    const parsed = JSON.parse(saved) as unknown;

    if (!isValidGameState(parsed)) {
      storage?.removeItem(SAVE_KEY);
      return null;
    }

    return parsed;
  } catch {
    storage?.removeItem(SAVE_KEY);
    return null;
  }
}

export function clearSavedGame(): void {
  getStorage()?.removeItem(SAVE_KEY);
}
