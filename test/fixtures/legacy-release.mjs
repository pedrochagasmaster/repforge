import { execFileSync } from "node:child_process";

// A historical release's files, read from git for suites that serve an installed
// older app. CI checks out with `filter: blob:none`, so an old blob read on demand
// is a network fetch; made inside a request handler it blocks the event loop and
// the fetches run serially inside page and worker deadlines. `legacyRelease`
// fetches the release's cache inventory (its sw.js ASSETS) in one batch and holds
// it in memory before any page opens; `file` falls back to `git show` for the rest
// and records each such read in `onDemand`.
export function legacyRelease(sha, { cwd, extra = [] } = {}) {
  const git = (args, input) => execFileSync("git", args, { cwd, input, maxBuffer: 1 << 28, stdio: ["pipe", "pipe", "ignore"] });
  const files = new Map();
  const onDemand = [];
  const assets = [...git(["show", `${sha}:sw.js`]).toString().match(/const ASSETS = \[([\s\S]*?)\];/)[1]
    .matchAll(/"\.\/([^"?]+)/g)].map(([, path]) => path);
  const paths = new Set(["index.html", "sw.js", ...extra, ...assets]);
  const blobs = git(["ls-tree", "-r", "-z", sha]).toString().split("\0")
    .map((line) => line.match(/^\d+ blob ([0-9a-f]+)\t(.*)$/s)).filter((match) => match && paths.has(match[2]))
    .map(([, oid, path]) => ({ oid, path }));
  const wanted = new Set(blobs.map(({ oid }) => oid));
  const missing = git(["rev-list", "--objects", "--no-walk", "--missing=print", sha]).toString()
    .split("\n").filter((line) => line.startsWith("?") && wanted.has(line.slice(1))).map((line) => line.slice(1));
  if (missing.length) {
    git(["-c", "fetch.negotiationAlgorithm=noop", "fetch", "--quiet", "origin", "--no-tags", "--no-write-fetch-head",
      "--recurse-submodules=no", "--filter=blob:none", "--stdin"], `${missing.join("\n")}\n`);
  }
  // cat-file answers in input order: "<oid> blob <size>\n<bytes>\n" per blob.
  const out = git(["cat-file", "--batch"], `${blobs.map(({ oid }) => oid).join("\n")}\n`);
  let at = 0;
  for (const { path } of blobs) {
    const end = out.indexOf(10, at);
    const size = Number(out.subarray(at, end).toString().split(" ")[2]);
    files.set(path, out.subarray(end + 1, end + 1 + size));
    at = end + 2 + size;
  }
  function file(path) {
    if (!files.has(path)) {
      let bytes = null;
      try { bytes = git(["show", `${sha}:${path}`]); }
      catch {}
      if (bytes) onDemand.push(path);
      files.set(path, bytes);
    }
    return files.get(path);
  }
  return { file, onDemand };
}
