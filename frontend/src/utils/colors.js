/**
 * Module themes — colors per route. `color` is the brand accent, `gradient`
 * is a Tailwind className applied to each module's page wrapper.
 *
 * Light theme: gradients begin in a tinted-but-still-pale module hue and end
 * in the global paper background so pages feel like sunlit installations.
 */
export const MODULE_THEMES = {
  pollution: {
    label: 'Pollution Cleaner',
    color: '#7ed957',                      // a green that reads on light bg
    glow: 'shadow-glow-toxic',
    text: 'text-mod-pollution',
    gradient: 'from-[#e7f7d4] via-[#eaf5ff] to-[#f4fbff]',
  },
  forest: {
    label: 'Plant vs. Carbon Monster',
    color: '#3fc290',
    glow: 'shadow-glow',
    text: 'text-mod-forest',
    gradient: 'from-[#d7f5e6] via-[#eaf6ff] to-[#f4fbff]',
  },
  ocean: {
    label: 'Ocean Cleanup',
    color: '#0a78b8',
    glow: 'shadow-glow-cyan',
    text: 'text-mod-ocean',
    gradient: 'from-[#cfe9fb] via-[#dff4ff] to-[#f4fbff]',
  },
  energy: {
    label: 'Human Energy Generator',
    color: '#e09b16',                      // amber that reads on light bg
    glow: 'shadow-glow-yellow',
    text: 'text-mod-energy',
    gradient: 'from-[#fff4cf] via-[#e7f6ff] to-[#f4fbff]',
  },
  rhythm: {
    label: 'Eco Rhythm Experience',
    color: '#9a6bff',
    glow: 'shadow-glow-purple',
    text: 'text-mod-rhythm',
    gradient: 'from-[#ece3ff] via-[#eaf3ff] to-[#f4fbff]',
  },
  monster: {
    label: 'Carbon Monster Battle',
    color: '#e84a4a',
    glow: 'shadow-glow-red',
    text: 'text-mod-monster',
    gradient: 'from-[#ffd9d9] via-[#eaf3ff] to-[#f4fbff]',
  },
};

export const hexToRgba = (hex, a = 1) => {
  const h = hex.replace('#', '');
  const v = h.length === 3
    ? h.split('').map(c => parseInt(c + c, 16))
    : [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  return `rgba(${v[0]},${v[1]},${v[2]},${a})`;
};
