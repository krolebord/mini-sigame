import { Accessor, createEffect, createSignal, mergeProps } from "solid-js"
import { createRAF, targetFPS } from '@solid-primitives/raf';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function ProgressLine(props: { progress: number }) {
  return <div
    class="h-2 bg-blue-800 transition-[width] ease-linear duration-100"
    style={{
      width: `${clamp(props.progress, 0, 1) * 100}%`,
    }}
  ></div>
}

export function createTimerProgress({ startTime, endTime }: { startTime: Accessor<number>, endTime: Accessor<number> }): Accessor<number> {
  const now = () => Date.now();

  const [tick, setTick] = createSignal(0);
  const progress = () => {
    tick();
    return clamp((now() + 1 - startTime()) / (endTime() - startTime()), 0, 1);
  };

  const [_, start, stop] = createRAF(targetFPS(() => setTick(x => x + 1), 10));

  createEffect(() => {
    if (now() > endTime()) {
      stop();
    } else {
      start();
    }
  });

  return progress;
}

export function TimerProgressLine(props: { start: number, end: number }) {
  const progress = createTimerProgress({
    startTime: () => props.start,
    endTime: () => props.end,
  });
  
  return <ProgressLine progress={progress()} />
}
