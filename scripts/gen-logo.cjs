const fs = require('fs');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="32" fill="#6366f1"/>
  <g transform="translate(48, 38) scale(6.67)" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="6" height="18" rx="1" />
    <rect x="9" y="3" width="6" height="13" rx="1" />
    <rect x="16" y="3" width="6" height="8" rx="1" />
    <line x1="4" y1="6" x2="6" y2="6" />
    <line x1="4" y1="9" x2="6" y2="9" />
    <line x1="4" y1="12" x2="6" y2="12" />
    <line x1="4" y1="15" x2="6" y2="15" />
    <line x1="11" y1="6" x2="13" y2="6" />
    <line x1="11" y1="9" x2="13" y2="9" />
    <line x1="11" y1="12" x2="13" y2="12" />
    <line x1="18" y1="6" x2="22" y2="6" />
    <line x1="18" y1="9" x2="22" y2="9" />
  </g>
</svg>`;

fs.writeFileSync('media/koban-logo.svg', svg);
console.log('Created media/koban-logo.svg');
