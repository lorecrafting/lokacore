// Metro reads page-curl.sksl as its text, so web and device run the one shader source.
const upstream = require(
  require.resolve('@expo/metro-config/babel-transformer', {
    paths: [require.resolve('expo/package.json')],
  }),
);

module.exports = {
  ...upstream,
  transform: (p) =>
    upstream.transform(
      p.filename.endsWith('.sksl')
        ? { ...p, src: `module.exports = ${JSON.stringify(p.src)};` }
        : p,
    ),
};
