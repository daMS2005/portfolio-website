import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const serverDirectory = resolve("dist/server");
const workerPath = resolve(serverDirectory, "index.js");

const workerSource = `function withPath(request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url, request);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return env.ASSETS.fetch(withPath(request, "/robot-demos.html"));
    }
    return env.ASSETS.fetch(request);
  },
};
`;

await mkdir(serverDirectory, { recursive: true });
await writeFile(workerPath, workerSource, "utf8");
