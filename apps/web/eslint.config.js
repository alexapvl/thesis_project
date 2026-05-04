import config from '@stl/eslint-config';

export default [
  ...config,
  { ignores: ['dist', 'node_modules'] },
];
