const nextEslintConfig = require('eslint-config-next/core-web-vitals');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  ...nextEslintConfig,
  {
    ignores: [
      "/.next/**",
      "/out/**",
      "/build/**",
      "/next-env.d.ts",
      "/node_modules/**",
      "/.claude/**",
    ],
  },
  {
    rules: {
      // I can add custom rules here if needed later
    },
  },
];
