import React from 'react';

const paths = {
  arrow: '<path d="m9 18 6-6-6-6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>',
  headphones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M18 19h1a1 1 0 0 0 1-1v-4h-3v5h1ZM6 19H5a1 1 0 0 1-1-1v-4h3v5H6Z"/>',
  external: '<path d="M15 4h5v5M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  grid: '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/>',
  wave: '<path d="M4 12h2m2-4v8m3-11v14m3-9v4m3-7v10m3-5h1"/>',
  cc: '<rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 9.5a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2M16 9.5a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
};

export default function Icon({ name, className = '', ...props }) {
  const pathHtml = paths[name] || '';
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      dangerouslySetInnerHTML={{ __html: pathHtml }}
      {...props}
    />
  );
}
