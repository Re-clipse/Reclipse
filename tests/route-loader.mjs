import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Execute the actual route with isolated service adapters: no network, keys or emails.
export async function loadRoute(path, dependencies, env = {}) {
  const context = vm.createContext({
    Response, Request, Headers, Buffer, Date,
    process: { env },
    console: { error() {}, warn() {} },
    fetch() { throw new Error('Unexpected network call'); },
  });
  const url = new URL(`../${path}`, import.meta.url);
  const cache = new Map();
  async function readModule(location) {
    if (cache.has(location.href)) return cache.get(location.href);
    const result = new vm.SourceTextModule(await readFile(location, 'utf8'), {
      context, identifier: location.href,
    });
    cache.set(location.href, result);
    return result;
  }
  const module = await readModule(url);
  await module.link(async (name, parent) => {
    if (Object.hasOwn(dependencies, name)) {
      const exports = dependencies[name];
      return new vm.SyntheticModule(Object.keys(exports), function () {
        for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
      }, { context });
    }
    if (name.startsWith('@/lib/')) {
      return readModule(new URL(`../${name.slice(2)}${/\.(m?js)$/.test(name) ? '' : '.js'}`, import.meta.url));
    }
    if (name.startsWith('./')) return readModule(new URL(name, parent.identifier));
    throw new Error(`Unmocked import: ${name}`);
  });
  await module.evaluate();
  return module.namespace;
}
