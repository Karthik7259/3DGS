const paths = {
  cube: 'M12 3 21 8v9l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v9',
  compare: 'M3 5h18v14H3z M12 5v14',
  sliders: 'M3 7h5m4 0h9M3 17h10m4 0h4 M8 4v6h4V4z M13 14v6h4v-6z',
  panel: 'M3 5h18v14H3z M15 5v14',
  orbit: 'M21 9c1 3-2 7-7 10S4 22 3 19s2-7 7-10 10-3 11 0z M6 7c2-3 6-3 9 0s5 8 2 11 M12 12h.01',
  hand: 'M7 13V7a1.5 1.5 0 0 1 3 0v4-7a1.5 1.5 0 0 1 3 0v7-6a1.5 1.5 0 0 1 3 0v6-4a1.5 1.5 0 0 1 3 0v7c0 5-2 7-6 7-3 0-5-2-7-5l-2-3c-1-2 1-3 3 0z',
  plus: 'M12 5v14 M5 12h14', minus: 'M5 12h14',
  reset: 'M3 10a9 9 0 1 1 1 8 M3 4v6h6',
  expand: 'M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5',
  shrink: 'M9 4v5H4m11-5v5h5m0 6h-5v5m-6 0v-5H4',
  camera: 'M3 7h4l2-3h6l2 3h4v13H3z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  layers: 'm12 3 10 5-10 5L2 8z M2 12l10 5 10-5 M2 16l10 5 10-5',
  chip: 'M6 6h12v12H6z M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4',
  screen: 'M3 5h18v13H3z M12 18v3m-4 0h8',
  chevron: 'm8 10 4 4 4-4', check: 'm5 12 4 4L19 6',
  focus: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  mouse: 'M5 10c0-9 14-9 14 0v5c0 9-14 9-14 0z M12 3v6',
  info: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0z M12 11v5m0-9v1',
  path: 'M4 18c0-8 6 2 9-7 1-3 3-5 7-5 M6 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z M22 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  play: 'M7 4l13 8-13 8z', pause: 'M8 5v14m8-14v14',
  prev: 'M7 5v14m11-14L8 12l10 7z', next: 'M17 5v14M6 5l10 7-10 7z',
  loop: 'M4 11V8a3 3 0 0 1 3-3h12l-3-3m3 3-3 3 M20 13v3a3 3 0 0 1-3 3H5l3 3m-3-3 3-3',
} as const;

export function Icon({ name, size = 18 }: { name: keyof typeof paths; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export function Mark() {
  return <span className="brand-mark" aria-hidden="true">{Array.from({length: 25}, (_, i) => <i key={i} style={{ opacity: 0.23 + 0.77 * Math.exp(-Math.abs(i % 5 - Math.floor(i / 5)) / 1.8) }} />)}</span>;
}
