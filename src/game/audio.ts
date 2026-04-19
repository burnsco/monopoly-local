let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.3, t = 0) {
  const c = getCtx();
  const now = c.currentTime + t;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  osc.start(now);
  osc.stop(now + dur + 0.05);
}

function noise(dur: number, vol = 0.1, t = 0) {
  const c = getCtx();
  const now = c.currentTime + t;
  const size = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, size, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  src.connect(gain);
  gain.connect(c.destination);
  src.start(now);
  src.stop(now + dur);
}

export type SoundName =
  | "diceRoll"
  | "doubles"
  | "movementStep"
  | "passGo"
  | "buyProperty"
  | "auctionWin"
  | "payRent"
  | "payTax"
  | "goToJail"
  | "leaveJail"
  | "cardDraw"
  | "buildHouse"
  | "buildHotel"
  | "sellBuilding"
  | "bankruptcy"
  | "gameOver"
  | "auctionBid";

const sounds: Record<SoundName, () => void> = {
  diceRoll: () => {
    for (let i = 0; i < 6; i++) {
      noise(0.03, 0.12, i * 0.05);
      tone(150 + Math.random() * 80, 0.03, "square", 0.04, i * 0.05);
    }
  },

  doubles: () => {
    tone(523, 0.12, "sine", 0.22);
    tone(784, 0.2, "sine", 0.18, 0.11);
  },

  movementStep: () => {
    tone(500, 0.04, "square", 0.04);
  },

  passGo: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, "sine", 0.22, i * 0.1));
  },

  buyProperty: () => {
    tone(880, 0.07, "square", 0.12);
    tone(1100, 0.12, "sine", 0.18, 0.06);
    tone(1320, 0.28, "sine", 0.22, 0.13);
  },

  auctionWin: () => {
    tone(660, 0.1, "sine", 0.2);
    tone(880, 0.1, "sine", 0.2, 0.1);
    tone(1100, 0.25, "sine", 0.25, 0.2);
  },

  payRent: () => {
    tone(440, 0.18, "sine", 0.18);
    tone(330, 0.28, "sine", 0.15, 0.16);
  },

  payTax: () => {
    tone(392, 0.16, "sine", 0.18);
    tone(294, 0.16, "sine", 0.16, 0.15);
    tone(220, 0.35, "sine", 0.14, 0.3);
  },

  goToJail: () => {
    [880, 660, 440, 330].forEach((f, i) => tone(f, 0.14, "square", 0.18, i * 0.14));
  },

  leaveJail: () => {
    [440, 550, 660].forEach((f, i) => tone(f, 0.15, "sine", 0.2, i * 0.1));
  },

  cardDraw: () => {
    noise(0.06, 0.07);
    tone(600, 0.14, "sine", 0.14, 0.06);
  },

  buildHouse: () => {
    tone(220, 0.04, "square", 0.22);
    noise(0.04, 0.08, 0.05);
    tone(330, 0.1, "triangle", 0.14, 0.08);
  },

  buildHotel: () => {
    tone(165, 0.04, "square", 0.28);
    noise(0.06, 0.12, 0.04);
    tone(220, 0.07, "square", 0.18, 0.08);
    tone(330, 0.14, "triangle", 0.18, 0.14);
  },

  sellBuilding: () => {
    tone(440, 0.04, "square", 0.14);
    tone(330, 0.1, "square", 0.1, 0.06);
  },

  bankruptcy: () => {
    [440, 415, 392, 370, 349].forEach((f, i) => tone(f, 0.28, "sawtooth", 0.14, i * 0.17));
  },

  gameOver: () => {
    const melody = [523, 659, 784, 659, 784, 1047];
    const durs = [0.14, 0.14, 0.14, 0.1, 0.1, 0.5];
    let t = 0;
    melody.forEach((f, i) => {
      tone(f, durs[i] + 0.1, "sine", 0.28, t);
      t += durs[i];
    });
  },

  auctionBid: () => {
    noise(0.04, 0.18);
    tone(180, 0.14, "square", 0.18);
  },
};

export function playSound(name: SoundName) {
  try {
    sounds[name]();
  } catch {
    // ignore audio errors
  }
}

export const LOG_SOUNDS: Array<[RegExp, SoundName]> = [
  [/rolled \d+ \+ \d+\./, "diceRoll"],
  [/passed Go and collected/, "passGo"],
  [/bought .+ for \$/, "buyProperty"],
  [/won the auction for/, "auctionWin"],
  [/paid \$\d+ for rent/, "payRent"],
  [/paid \$\d+ for (Income|Luxury) Tax/, "payTax"],
  [/paid \$\d+ bail\./, "leaveJail"],
  [/rolled doubles to leave Jail/, "leaveJail"],
  [/used a Get Out of Jail Free card/, "leaveJail"],
  [/was sent to Jail/, "goToJail"],
  [/built a hotel/, "buildHotel"],
  [/built a house/, "buildHouse"],
  [/sold a building/, "sellBuilding"],
  [/went bankrupt/, "bankruptcy"],
  [/wins the game/, "gameOver"],
  [/bid \$\d+/, "auctionBid"],
];

export function soundForLogEntry(entry: string): SoundName | null {
  for (const [pattern, sound] of LOG_SOUNDS) {
    if (pattern.test(entry)) return sound;
  }
  return null;
}
