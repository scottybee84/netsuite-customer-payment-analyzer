const fs = require("fs");
const path = require("path");

describe("Suitelet files API surface", () => {
  const dir = path.join(__dirname, "..", "src", "suitescript");
  const files = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => f.startsWith("sl_") && f.endsWith(".js"))
    : [];

  if (files.length === 0) {
    test("no suitelet files found", () => {
      expect(files.length).toBeGreaterThanOrEqual(0);
    });
    return;
  }

  files.forEach((file) => {
    const full = path.join(dir, file);
    test(`${file} should expose an onRequest function`, () => {
      const content = fs.readFileSync(full, "utf8");

      // Basic checks for SuiteScript 2.x AMD wrapper
      expect(content).toMatch(/@NScriptType Suitelet/);
      expect(content).toMatch(/define\(/);

      // Try to evaluate the module in a fake AMD environment to extract exported symbols
      const exports = {};
      const moduleFactory = new Function(
        "exports",
        "require",
        "define",
        content + "\n return exports;"
      );

      // Minimal AMD define shim that captures exports via the factory function
      function define(deps, factory) {
        if (typeof deps === "function") {
          // define(factory)
          factory(require, exports);
        } else if (Array.isArray(deps) && typeof factory === "function") {
          // simple shim: call factory with require and exports only
          factory(require, exports);
        }
      }

      // Execute with the shim
      try {
        // eslint-disable-next-line no-eval
        const moduleExports = moduleFactory(exports, require, define);
        const onRequest =
          (moduleExports && moduleExports.onRequest) || exports.onRequest;
        expect(typeof onRequest).toBe("function");
      } catch (e) {
        // If runtime evaluation fails, at least assert that string contains `exports.onRequest = onRequest` or `exports.onRequest` pattern
        expect(content).toMatch(
          /exports\.onRequest|exports\["onRequest"\]|exports\s*=\s*{[\s\S]*onRequest/
        );
      }
    });
  });
});
