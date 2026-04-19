import { describe, it, expect, vi } from "vitest";

// --- Web Audio API mock ---------------------------------------------------
// Set up before the module is imported so the lazy AudioContext creation
// picks up the stub on first playSound call.

vi.stubGlobal(
  "AudioContext",
  vi.fn(function MockAudioContext(this: object) {
    Object.assign(this, {
      state: "running",
      currentTime: 0,
      sampleRate: 44100,
      resume: vi.fn().mockResolvedValue(undefined),
      destination: {},
      createOscillator: vi.fn(() => ({
        connect: vi.fn(),
        type: "sine",
        frequency: { setValueAtTime: vi.fn() },
        start: vi.fn(),
        stop: vi.fn(),
      })),
      createGain: vi.fn(() => ({
        connect: vi.fn(),
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
      })),
      createBuffer: vi.fn((_ch: number, size: number) => ({
        getChannelData: vi.fn(() => new Float32Array(size)),
      })),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      })),
    });
  }),
);

import { playSound, soundForLogEntry, LOG_SOUNDS, type SoundName } from "../src/game/audio";

// -------------------------------------------------------------------------

describe("playSound", () => {
  const allSounds: SoundName[] = [
    "diceRoll",
    "doubles",
    "movementStep",
    "passGo",
    "buyProperty",
    "auctionWin",
    "payRent",
    "payTax",
    "goToJail",
    "leaveJail",
    "cardDraw",
    "buildHouse",
    "buildHotel",
    "sellBuilding",
    "bankruptcy",
    "gameOver",
    "auctionBid",
  ];

  it.each(allSounds)('plays "%s" without throwing', (name) => {
    expect(() => playSound(name)).not.toThrow();
  });

  it("initialises an AudioContext on first call", () => {
    const MockAC = vi.mocked(AudioContext as unknown as new () => object);
    expect(MockAC.mock.instances.length).toBeGreaterThan(0);
  });
});

describe("soundForLogEntry — pattern matching", () => {
  const cases: Array<[string, SoundName | null]> = [
    // dice roll
    ["Ada rolled 3 + 4.", "diceRoll"],
    ["Grace rolled 6 + 6.", "diceRoll"],
    ["Ada rolled 1 + 12.", "diceRoll"],
    // pass go
    ["Ada passed Go and collected $200.", "passGo"],
    // buy property
    ["Ada bought Mediterranean Avenue for $60.", "buyProperty"],
    ["Grace bought Boardwalk for $400.", "buyProperty"],
    // auction win
    ["Ada won the auction for Boardwalk at $300.", "auctionWin"],
    // pay rent
    ["Ada paid $50 for rent on Park Place.", "payRent"],
    ["Grace paid $1400 for rent on Boardwalk.", "payRent"],
    // pay tax
    ["Ada paid $200 for Income Tax.", "payTax"],
    ["Grace paid $75 for Luxury Tax.", "payTax"],
    // leave jail
    ["Ada paid $50 bail.", "leaveJail"],
    ["Ada rolled doubles to leave Jail.", "leaveJail"],
    ["Ada used a Get Out of Jail Free card.", "leaveJail"],
    // go to jail
    ["Ada was sent to Jail: triple doubles.", "goToJail"],
    ["Grace was sent to Jail: landed on Go To Jail.", "goToJail"],
    // build hotel (must not match "buildHouse")
    ["Ada built a hotel on Boardwalk.", "buildHotel"],
    // build house
    ["Ada built a house on Mediterranean Avenue.", "buildHouse"],
    // sell building
    ["Ada sold a building on Mediterranean Avenue for $25.", "sellBuilding"],
    // bankruptcy
    ["Ada went bankrupt.", "bankruptcy"],
    // game over
    ["Ada wins the game.", "gameOver"],
    // auction bid
    ["Ada bid $100.", "auctionBid"],
    ["Grace bid $350.", "auctionBid"],
    // no match
    ["Ada ended their turn. Grace is up.", null],
    ["Ada needs $200 for rent and must raise funds.", null],
    ["Ada settled $200 for rent.", null],
    ["Ada passed.", null],
    ["", null],
  ];

  it.each(cases)('"%s" → %s', (entry, expected) => {
    expect(soundForLogEntry(entry)).toBe(expected);
  });
});

describe("LOG_SOUNDS ordering and validity", () => {
  it("hotel pattern appears before house so hotels trigger the right sound", () => {
    const hotelIdx = LOG_SOUNDS.findIndex(([, s]) => s === "buildHotel");
    const houseIdx = LOG_SOUNDS.findIndex(([, s]) => s === "buildHouse");
    expect(hotelIdx).toBeLessThan(houseIdx);
  });

  it("all SoundNames referenced in LOG_SOUNDS are valid SoundName values", () => {
    const valid = new Set<SoundName>([
      "diceRoll",
      "doubles",
      "movementStep",
      "passGo",
      "buyProperty",
      "auctionWin",
      "payRent",
      "payTax",
      "goToJail",
      "leaveJail",
      "cardDraw",
      "buildHouse",
      "buildHotel",
      "sellBuilding",
      "bankruptcy",
      "gameOver",
      "auctionBid",
    ]);
    for (const [, sound] of LOG_SOUNDS) {
      expect(valid.has(sound)).toBe(true);
    }
  });

  it("every entry has a non-empty RegExp and a SoundName string", () => {
    expect(LOG_SOUNDS.length).toBeGreaterThan(0);
    for (const [pattern, sound] of LOG_SOUNDS) {
      expect(pattern).toBeInstanceOf(RegExp);
      expect(typeof sound).toBe("string");
      expect(sound.length).toBeGreaterThan(0);
    }
  });
});
