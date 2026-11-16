// The host a module gets: the core's host, made for that one module. The core
// creates the modules, so it knows each one's name and gives it a host that
// knows it too: what the module does through it is the module's (its data in
// tables, the API it offers), without the module saying who it is.
//
// Everything else is the core's: each member forwards to it (methods bound
// once, values and accessors read live), so the module sees the core's state
// as it is, and nothing is kept here. The forwarding is made once per core and
// shared: each module's host is an object over it holding the module's own
// members alone (some thirty modules over a core of hundreds of members: made
// for each, it was a quarter of a page's first scan).

// Each core's forwarding, made with its first module's host
const forwardings = new WeakMap<object, object>();

/**
 * A host forwarding every member `core` has (its own and its classes'), with
 * `own` (the module's) in place of the core's of the same names
 */
export function moduleHost<H extends object>(core: H, own: object = {}): H {
  let forwarding = forwardings.get(core);
  if (!forwarding) forwardings.set(core, (forwarding = forwardingOf(core)));
  return Object.create(forwarding, Object.getOwnPropertyDescriptors(own)) as H;
}

/** Every member of `core` forwarded to it: its methods bound once, its fields and accessors read live */
function forwardingOf(core: object): object {
  const forwarding = {};
  const taken = new Set<PropertyKey>(["constructor"]);
  // A function read from a field, bound to the core once per function
  const boundOnce = new WeakMap<object, unknown>();
  const live = (key: PropertyKey) => () => {
    const value: unknown = Reflect.get(core, key, core);
    if (typeof value !== "function") return value;
    let bound = boundOnce.get(value);
    if (!bound) boundOnce.set(value, (bound = value.bind(core)));
    return bound;
  };
  const forward = (key: PropertyKey, descriptor: PropertyDescriptor, field: boolean) => {
    if (taken.has(key)) return;
    taken.add(key);
    // (A field is read live, a function in it too: it may be set anew)
    if (!field && typeof descriptor.value === "function") {
      const bound = (descriptor.value as (...args: unknown[]) => unknown).bind(core);
      Object.defineProperty(forwarding, key, { value: bound });
    } else {
      Object.defineProperty(forwarding, key, { get: live(key) });
    }
  };
  // The core's own members first (its fields), then its classes' (methods, accessors), nearest first
  for (let at: object | null = core; at && at !== Object.prototype; at = Object.getPrototypeOf(at)) {
    for (const key of Reflect.ownKeys(at)) forward(key, Object.getOwnPropertyDescriptor(at, key)!, at === core);
  }
  return forwarding;
}
