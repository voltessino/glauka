  function preferences(raw) {
    return {
      pattern: ["none", "dots", "grid"].includes(raw?.pattern)
        ? raw.pattern
        : "dots",
      intensity: Math.max(
        0,
        Math.min(30, Number.isFinite(raw?.intensity) ? raw.intensity : 13),
      ),
      // Retired navigation effects must stay off even for previously saved opt-ins.
      path: false,
      guides: false,
      travel: false,
    };
  }
  function alignment(moving, targets, tolerance) {
    const axes = {
        x: [moving.x - moving.w / 2, moving.x, moving.x + moving.w / 2],
        y: [moving.y - moving.h / 2, moving.y, moving.y + moving.h / 2],
      },
      result = [];
    for (const axis of ["x", "y"]) {
      let best = null;
      for (const t of targets) {
        const half = (axis === "x" ? t.w : t.h) / 2;
        for (const value of [t[axis] - half, t[axis], t[axis] + half])
          for (const point of axes[axis]) {
            const distance = Math.abs(value - point);
            if (distance <= tolerance && (!best || distance < best.distance))
              best = { axis, value, distance };
          }
      }
      if (best) result.push(best);
    }
    return result;
  }
  function pathIds(tree, id) {
    const stack = [{ node: tree, parent: null }];
    let scanned = 0;
    const seen = new Set();
    while (stack.length && scanned++ < 20000) {
      const link = stack.pop();
      if (seen.has(link.node)) continue;
      seen.add(link.node);
      if (link.node.id === id) {
        const result = [];
        let p = link;
        while (p && result.length < 256) {
          result.push(p.node.id);
          p = p.parent;
        }
        return result.reverse();
      }
      for (const n of link.node.children || [])
        stack.push({ node: n, parent: link });
    }
    return [];
  }
