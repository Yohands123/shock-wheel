import { useCallback, useEffect, useRef, useState } from "react";
import { landingPlan, nextRotation, pegsPassed, restingRotation, sliceStep, spinAngle } from "../../wheelMath";

const FREE_SPEED = 0.6; // degrees per ms while waiting for the server
const RAMP_MS = 450; // time to reach free-spin speed
const MIN_LAND_MS = 3200; // the slow-down always takes at least this long
const FLAP_KICK = -24; // degrees; pegs move left to right under the pointer, so the tip swings right

/** Damped spring back to rest after the last peg kick. */
function flapAt(msSinceKick: number) {
  if (msSinceKick > 400) return 0;
  return FLAP_KICK * Math.exp(-msSinceKick / 70) * Math.cos(msSinceKick / 30);
}

let audio: AudioContext | null = null;
function click() {
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = 1700;
    gain.gain.setValueAtTime(0.08, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.025);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.03);
  } catch {
    // No audio available; the wheel works silently
  }
}

type Motion =
  | { kind: "idle" }
  | { kind: "free"; t0: number; a0: number }
  | { kind: "land"; t0: number; start: number; target: number; overshoot: number; duration: number; done: () => void };

/**
 * Drives the wheel. startFreeSpin() begins turning the moment the user presses Spin;
 * spinTo(slice) then decelerates onto the slice the server picked. The animation never chooses.
 */
export function useWheelSpin(count: number, opts: { reducedMotion: boolean; sound: boolean }) {
  const [rotation, setRotation] = useState(0);
  const [flap, setFlap] = useState(0);
  // Labels are oriented for where the wheel will rest, so they don't flip mid-spin
  const [labelRotation, setLabelRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const raf = useRef<number | undefined>(undefined);
  const angle = useRef(0);
  const motion = useRef<Motion>({ kind: "idle" });
  const lastKick = useRef(-Infinity);
  const soundRef = useRef(opts.sound);
  soundRef.current = opts.sound;

  useEffect(() => () => cancelAnimationFrame(raf.current ?? 0), []);

  const frame = useCallback(
    (now: number) => {
      const m = motion.current;
      const prev = angle.current;
      let next = prev;
      if (m.kind === "free") {
        const t = now - m.t0;
        // Ease up to speed: distance under a linear velocity ramp, then constant speed
        next = t < RAMP_MS ? m.a0 + (FREE_SPEED * t * t) / (2 * RAMP_MS) : m.a0 + (FREE_SPEED * RAMP_MS) / 2 + FREE_SPEED * (t - RAMP_MS);
      } else if (m.kind === "land") {
        next = spinAngle((now - m.t0) / m.duration, m.start, m.target, m.overshoot);
      }
      if (pegsPassed(prev, next, count) > 0) {
        lastKick.current = now;
        if (soundRef.current) click();
      }
      angle.current = next;
      setRotation(next);
      setFlap(flapAt(now - lastKick.current));

      if (m.kind === "land" && now - m.t0 >= m.duration) {
        angle.current = m.target;
        setRotation(m.target);
        setFlap(0);
        setSpinning(false);
        motion.current = { kind: "idle" };
        m.done();
        return;
      }
      raf.current = requestAnimationFrame(frame);
    },
    [count],
  );

  /** Rest on a slice instantly (initial load). */
  const placeAt = useCallback(
    (sliceIndex: number) => {
      if (count === 0) return;
      const deg = restingRotation(sliceIndex, count);
      angle.current = deg;
      setRotation(deg);
      setLabelRotation(deg);
    },
    [count],
  );

  /** Start turning while the server decides. No-op with reduced motion. */
  const startFreeSpin = useCallback(() => {
    if (opts.reducedMotion || count === 0 || motion.current.kind !== "idle") return;
    motion.current = { kind: "free", t0: performance.now(), a0: angle.current };
    setSpinning(true);
    raf.current = requestAnimationFrame(frame);
  }, [opts.reducedMotion, count, frame]);

  /** Stop any free spin without landing (e.g. the request failed). */
  const cancel = useCallback(() => {
    cancelAnimationFrame(raf.current ?? 0);
    motion.current = { kind: "idle" };
    setFlap(0);
    setSpinning(false);
  }, []);

  /** Decelerate onto the server's slice. Resolves when the wheel has settled. */
  const spinTo = useCallback(
    (sliceIndex: number) =>
      new Promise<void>((resolve) => {
        if (count === 0) return resolve();
        const from = angle.current;
        if (opts.reducedMotion) {
          const target = nextRotation(from, sliceIndex, count, 0);
          cancel();
          angle.current = target;
          setRotation(target);
          setLabelRotation(target);
          return resolve();
        }
        const wasFree = motion.current.kind === "free";
        const plan = landingPlan(from, sliceIndex, count, wasFree ? FREE_SPEED : 0, MIN_LAND_MS);
        setLabelRotation(plan.target);
        cancelAnimationFrame(raf.current ?? 0);
        motion.current = {
          kind: "land",
          t0: performance.now(),
          start: from,
          target: plan.target,
          overshoot: sliceStep(count) * 0.3,
          duration: plan.duration,
          done: resolve,
        };
        setSpinning(true);
        raf.current = requestAnimationFrame(frame);
      }),
    [count, opts.reducedMotion, frame, cancel],
  );

  return { rotation, flap, labelRotation, spinning, startFreeSpin, spinTo, cancel, placeAt };
}
