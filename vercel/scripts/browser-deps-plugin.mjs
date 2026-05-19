import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Resolve Node built-ins / CJS deps to static browser-friendly paths. */
export function browserDepsPlugin() {
  const aliases = new Map([
    ["buffer", require.resolve("buffer/")],
    ["buffer/", require.resolve("buffer/")],
    ["safe-buffer", require.resolve("safe-buffer")],
    ["process", require.resolve("process/browser")],
    ["stream", require.resolve("stream-browserify")],
    ["util", require.resolve("util/")],
    ["events", require.resolve("events/")],
  ]);

  return {
    name: "browser-deps",
    setup(build) {
      for (const [name, path] of aliases) {
        const filter = new RegExp(`^${name.replace("/", "\\/")}$`);
        build.onResolve({ filter }, () => ({ path }));
      }
    },
  };
}
