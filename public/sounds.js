// WebAudio approximations of the 16 PoE alert sounds for in-app preview.
// These are synthesized stand-ins so switching sounds is audible while editing;
// they are NOT the real game sounds.

let ctx = null;
function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Each preset: waveform + note sequence [freq, startSec, durSec]
const PRESETS = {
  1:  { wave: 'sine',     notes: [[880, 0, .12], [1320, .13, .18]] },          // bright two-tone up
  2:  { wave: 'sine',     notes: [[660, 0, .12], [440, .13, .2]] },            // two-tone down
  3:  { wave: 'triangle', notes: [[523, 0, .1], [659, .1, .1], [784, .2, .2]] },// major arpeggio
  4:  { wave: 'square',   notes: [[220, 0, .25]] },                            // low buzz
  5:  { wave: 'sine',     notes: [[988, 0, .08], [988, .12, .08], [988, .24, .16]] }, // triple ping
  6:  { wave: 'sawtooth', notes: [[392, 0, .15], [523, .15, .15], [659, .3, .3]] },   // fanfare (jackpot)
  7:  { wave: 'sine',     notes: [[1568, 0, .3]] },                            // high chime
  8:  { wave: 'triangle', notes: [[330, 0, .12], [330, .18, .12]] },           // double knock
  9:  { wave: 'sine',     notes: [[784, 0, .1], [587, .12, .2]] },             // soft bell down
  10: { wave: 'square',   notes: [[147, 0, .3]] },                             // deep thud
  11: { wave: 'sine',     notes: [[440, 0, .1], [554, .1, .1], [659, .2, .1], [880, .3, .2]] }, // rising run
  12: { wave: 'triangle', notes: [[1047, 0, .1], [784, .12, .1], [523, .24, .2]] },             // falling run
  13: { wave: 'sawtooth', notes: [[262, 0, .12], [262, .16, .12], [330, .32, .25]] },           // horn call
  14: { wave: 'sine',     notes: [[698, 0, .4]] },                             // long tone
  15: { wave: 'triangle', notes: [[880, 0, .06], [1100, .07, .06], [880, .14, .06], [1100, .21, .12]] }, // trill
  16: { wave: 'square',   notes: [[494, 0, .1], [494, .14, .1], [740, .28, .25]] },             // alarm rise
};

export function playAlertPreview(id, volume = 300) {
  const preset = PRESETS[id];
  if (!preset) return;
  const ac = audio();
  const gainTop = Math.max(0, Math.min(volume, 300)) / 300 * 0.35;
  const t0 = ac.currentTime + 0.02;
  for (const [freq, start, dur] of preset.notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = preset.wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0 + start);
    gain.gain.linearRampToValueAtTime(gainTop, t0 + start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + start + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0 + start);
    osc.stop(t0 + start + dur + 0.05);
  }
}
