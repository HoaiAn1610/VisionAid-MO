/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/services/**/*.{ts,tsx}',
    'src/stores/**/*.{ts,tsx}',
    'src/utils/**/*.{ts,tsx}',
    'src/features/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    global: { lines: 70 },
  },
};
