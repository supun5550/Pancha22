/** Tailwind CSS config: scans the page and script for class names. */
module.exports = {
  content: ['./public/index.html', './public/app.js'],
  theme: { extend: { colors: { agro: { pink: '#e8175d', violet: '#7b4bff' }, mut: '#a3a3d4' } } },
  plugins: [],
};
