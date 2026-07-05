module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: ["**/*.test.ts"],
    slowTestThreshold: 30,
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1"
    }
};
