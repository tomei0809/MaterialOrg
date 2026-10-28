'use client';

import { useEffect, useRef, useState } from 'react';
import { useLoaded } from '@/components/preview/hooks';
import { cached, fetchBuffer } from '@/lib/previewCache';
import { isTyping, ToolGroup, toolButton, ViewerToolbar } from './ViewerParts';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
// 波形を描く上限（大きな音声は読み込みに時間がかかるため描かない）
const MAX_WAVEFORM_BYTES = 50 * 1024 * 1024;
const BARS = 480;

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '‒:‒‒';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(s % 60).padStart(2, '0')}`;
};

// 音声を BARS 本の棒（0〜1 の大きさ）にまとめる
async function waveformPeaks(url: string) {
  const buffer = await fetchBuffer(url);
  const AudioCtx = window.AudioContext;
  const context = new AudioCtx();
  try {
    const audio = await context.decodeAudioData(buffer.slice(0));
    const data = audio.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / BARS));
    const peaks: number[] = [];
    for (let i = 0; i < BARS; i++) {
      let max = 0;
      for (let j = i * step; j < Math.min(data.length, (i + 1) * step); j++) max = Math.max(max, Math.abs(data[j]));
      peaks.push(max);
    }
    const top = Math.max(...peaks, 0.001);
    return peaks.map((p) => p / top);
  } finally {
    void context.close();
  }
}

function Waveform({ url, onSeek, current, duration }: { url: string; onSeek: (ratio: number) => void; current: number; duration: number }) {
  const peaks = useLoaded(`wave:${url}`, () => cached(`wave:${url}`, () => waveformPeaks(url)));
  if (peaks.status !== 'done') {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-muted">
        {peaks.status === 'loading' ? '波形を作っています…' : '波形を表示できませんでした'}
      </div>
    );
  }
  const progress = duration > 0 ? current / duration : 0;
  return (
    <button
      type="button"
      aria-label="クリックした位置へ移動"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onSeek((event.clientX - rect.left) / rect.width);
      }}
      className="relative flex h-32 w-full cursor-pointer items-center gap-px"
    >
      {peaks.value.map((p, i) => (
        <span
          key={i}
          className={`min-w-px flex-1 rounded-full ${i / peaks.value.length <= progress ? 'bg-foreground' : 'bg-muted/40'}`}
          style={{ height: `${Math.max(3, p * 100)}%` }}
        />
      ))}
      <span aria-hidden="true" className="absolute top-0 bottom-0 w-0.5 bg-primary" style={{ left: `${progress * 100}%` }} />
    </button>
  );
}

// 動画・音声：大きく再生。速度・10秒送り・キー操作（Space・←→）
export function MediaViewer({ url, kind, size, name }: { url: string; kind: 'video' | 'audio'; size: number; name: string }) {
  // 再生位置・速度は要素を直接操作するため ref で持つ（state は要素ができたことを知らせるだけ）
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [media, setMediaState] = useState<HTMLMediaElement | null>(null);
  const setMedia = (el: HTMLMediaElement | null) => {
    mediaRef.current = el;
    setMediaState(el);
  };
  const [speed, setSpeed] = useState(1);
  const [time, setTime] = useState({ current: 0, duration: NaN });
  const frame = useRef(0);

  useEffect(() => {
    if (mediaRef.current) mediaRef.current.playbackRate = speed;
  }, [media, speed]);

  // 再生位置の表示をなめらかに動かす
  useEffect(() => {
    if (!media) return;
    const tick = () => {
      setTime({ current: media.currentTime, duration: media.duration });
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [media]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = mediaRef.current;
      if (!el || isTyping(event) || event.ctrlKey || event.metaKey || event.shiftKey) return;
      // 動画の操作ボタンにフォーカスがあるときは、ブラウザ標準の操作に任せる
      if ((event.target as HTMLElement)?.tagName === 'VIDEO' || (event.target as HTMLElement)?.tagName === 'AUDIO') return;
      if (event.key === ' ') {
        if (el.paused) void el.play();
        else el.pause();
      } else if (event.key === 'ArrowRight') el.currentTime += 5;
      else if (event.key === 'ArrowLeft') el.currentTime -= 5;
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [media]);

  const skip = (seconds: number) => {
    const el = mediaRef.current;
    if (el) el.currentTime = Math.max(0, el.currentTime + seconds);
  };
  const seek = (ratio: number) => {
    const el = mediaRef.current;
    if (el && Number.isFinite(el.duration)) el.currentTime = ratio * el.duration;
  };

  return (
    <>
      <ViewerToolbar>
        <ToolGroup label="移動">
          <button type="button" className={toolButton} onClick={() => skip(-10)} title="10秒戻る">
            −10秒
          </button>
          <button type="button" className={toolButton} onClick={() => skip(10)} title="10秒進む">
            ＋10秒
          </button>
        </ToolGroup>
        <ToolGroup label="再生速度">
          {SPEEDS.map((s) => (
            <button key={s} type="button" className={toolButton} aria-pressed={speed === s} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
        </ToolGroup>
        <span className="text-xs text-muted tabular-nums">
          {formatTime(time.current)} / {formatTime(time.duration)}
        </span>
      </ViewerToolbar>
      {kind === 'video' ? (
        <div className="flex h-full items-center justify-center bg-black">
          <video ref={setMedia} src={url} controls autoPlay playsInline className="max-h-full max-w-full">
            この形式の動画はブラウザで再生できません。「保存」から開いてください。
          </video>
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-6 px-8">
          <p className="text-sm font-bold">{name}</p>
          <div className="w-full max-w-4xl">
            {size <= MAX_WAVEFORM_BYTES ? (
              <Waveform url={url} onSeek={seek} current={time.current} duration={time.duration} />
            ) : (
              <p className="text-center text-xs text-muted">大きい音声のため波形は表示していません</p>
            )}
          </div>
          <audio ref={setMedia} src={url} controls className="w-full max-w-4xl" />
        </div>
      )}
    </>
  );
}
