export type Cue = "dumbbell" | "plate" | "collar" | "bench" | "storage" | "complete";

const cues = {
  dumbbell: { hz: 84, end: 49, noise: .036, cutoff: 530, length: .14 },
  plate: { hz: 186, end: 78, noise: .045, cutoff: 1000, length: .17 },
  collar: { hz: 612, end: 470, noise: .05, cutoff: 2450, length: .07 },
  bench: { hz: 265, end: 130, noise: .052, cutoff: 1550, length: .095 },
  storage: { hz: 142, end: 92, noise: .027, cutoff: 710, length: .09 },
} as const;

let audio: AudioContext | undefined;
let noise: AudioBuffer | undefined;
let audible = true;

export function enableAudio(enabled: boolean) {
  audible = enabled;
  if (enabled) unlockAudio();
}

export function unlockAudio() {
  if (!audible || !window.AudioContext) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume().catch(() => undefined);
  } catch {
    audio = undefined;
  }
}

function tone(context: AudioContext, start: number, length: number, hz: number, end: number, volume: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.setValueAtTime(hz, start);
  oscillator.frequency.exponentialRampToValueAtTime(end, start + length);
  gain.gain.setValueAtTime(.001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .008);
  gain.gain.exponentialRampToValueAtTime(.001, start + length);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + length);
}

export function playFeedback(cue: Cue, vibration?: number | number[]) {
  navigator.vibrate?.(vibration ?? (cue === "complete" ? [38, 24, 46] : 8));
  if (!audible || !audio || audio.state !== "running") return;
  const start = audio.currentTime;
  if (cue === "complete") {
    tone(audio, start, .13, 392, 392, .043);
    tone(audio, start + .105, .19, 523.25, 523.25, .04);
    return;
  }

  const sound = cues[cue];
  if (!noise) {
    noise = audio.createBuffer(1, Math.ceil(audio.sampleRate * .2), audio.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = 2 * Math.random() - 1;
  }
  const source = audio.createBufferSource();
  source.buffer = noise;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = sound.cutoff;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(sound.noise, start);
  gain.gain.exponentialRampToValueAtTime(.001, start + sound.length);
  source.connect(filter).connect(gain).connect(audio.destination);
  source.start(start);
  source.stop(start + sound.length);
  tone(audio, start, sound.length, sound.hz, sound.end, .045);
}
