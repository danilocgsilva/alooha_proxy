module.exports = {
    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
            useESM: true,
        }],
        '^.+\\.(js|jsx)$': 'babel-jest',
    },
    preset: "ts-jest",
    extensionsToTreatAsEsm: ['.ts'],
    testEnvironment: "node",
    testMatch: ["**/*.test.ts"],
    slowTestThreshold: 30,
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1"
    },
    transformIgnorePatterns: [
        'node_modules/(?!(uuid|winston|winston-daily-rotate-file)/)'
    ],
    testTimeout: 30000
};