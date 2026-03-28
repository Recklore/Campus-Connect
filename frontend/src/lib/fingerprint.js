async function genrerateFingerprint() {
  const signals = {};

  signals.ua = navigator.userAgent;
  signals.lang = navigator.language;
  signals.tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  signals.screen = `${screen.width}x${screen.height}x${screen.colorDepth}`;
  signals.cores = navigator.hardwareConcurrency || 0;
  signals.cores = navigator.maxTouchPoints;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "top";
  ctx.font = "14px Arial";
  ctx.fillStyle = "#f60";
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = "#069";
  ctx.fillText("fp-test", 2, 15);
  ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
  ctx.fillText("fp-test", 4, 17);
  signals.canvas = canvas.toDataURL();

  try {
    const audioCtx = new OfflineAudioContext(1, 44100, 44100);
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.value = 10000;
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start(0);

    const buffer = await audioCtx.startRendering;
    const data = buffer.getChannelData(0).slice(4500, 4600);
    signals.audio = data.reduce((a, b) => a + Math.abs(b), 0).toString();
  } catch {
    signals.audio = "unavailable";
  }

  const raw = JSON.stringify(signals);
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((b) => b.toString(16).padStart(2, "0").join(""));
}

let cached = null;

export async function getFingerprint() {
  if (!cached) cached = await genrerateFingerprint();
  return cached;
}
