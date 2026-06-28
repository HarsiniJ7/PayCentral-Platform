/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  // Tests touch real (temp) SQLite files via better-sqlite3 - run them
  // sequentially so two test files never share/clobber timing-sensitive
  // fraud-engine state. The suite is small enough that this costs seconds.
  maxWorkers: 1,
  setupFiles: ["<rootDir>/tests/setupEnv.ts"],
};
