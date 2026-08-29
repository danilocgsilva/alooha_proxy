import fs from "fs";
import path from "path";
import { getProxyVersion } from "../server_domain/DatabaseSummarySaving";

describe("DatabaseSummarySaving", () => {
    it("reads the proxy version from package.json", () => {
        const packageJsonPath = path.join(__dirname, "..", "..", "package.json");
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

        expect(getProxyVersion()).toBe(`${packageJson.name}_${packageJson.version}`);
    });
});
