const paths = {
  shield: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z M9 12l2 2 4-4',
  grid: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
  close: 'M6 6l12 12 M18 6 6 18',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  lock: 'M7 11V7a5 5 0 0 1 10 0v4 M5 11h14v10H5z M12 15v2',
  logout: 'M10 4H4v16h6 M9 12h12 M17 8l4 4-4 4',
  file: 'M14 3H5v18h14V8l-5-5Z M14 3v5h5 M8 12h8 M8 16h6',
  plus: 'M12 5v14 M5 12h14',
  arrow: 'M5 12h14 M14 7l5 5-5 5',
};

export function Icon({ name }: { name: keyof typeof paths }) {
  return <svg className="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
