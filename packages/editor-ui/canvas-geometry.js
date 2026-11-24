/* Pure geometry for area selection, selection hulls and relationship curves.
 * No document access and no persisted fields. */
(function (root) {
  "use strict";

  function finitePoint(point) {
    return !!point && Number.isFinite(point.x) && Number.isFinite(point.y);
  }

  function normalizeRect(a, b) {
    if (!finitePoint(a) || !finitePoint(b)) return null;
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return { x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
  }

  function rectIntersectsRect(a, b) {
    if (!a || !b) return false;
    return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
  }

  function pointInRect(point, rect) {
    return finitePoint(point) && !!rect &&
      point.x >= rect.x && point.x <= rect.x + rect.w &&
      point.y >= rect.y && point.y <= rect.y + rect.h;
  }

  function orient(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  function segmentsIntersect(a, b, c, d) {
    if (!finitePoint(a) || !finitePoint(b) || !finitePoint(c) || !finitePoint(d)) return false;
    if (a.x === b.x && a.y === b.y) return false;
    if (c.x === d.x && c.y === d.y) return false;
    const o1 = orient(a, b, c);
    const o2 = orient(a, b, d);
    const o3 = orient(c, d, a);
    const o4 = orient(c, d, b);
    if (o1 === 0 && o2 === 0 && o3 === 0 && o4 === 0) {
      const min = (p, q) => ({ x: Math.min(p.x, q.x), y: Math.min(p.y, q.y) });
      const max = (p, q) => ({ x: Math.max(p.x, q.x), y: Math.max(p.y, q.y) });
      const ab0 = min(a, b), ab1 = max(a, b), cd0 = min(c, d), cd1 = max(c, d);
      return ab0.x <= cd1.x && cd0.x <= ab1.x && ab0.y <= cd1.y && cd0.y <= ab1.y;
    }
    return o1 * o2 <= 0 && o3 * o4 <= 0;
  }

  function pointInPolygon(point, polygon) {
    if (!finitePoint(point) || !Array.isArray(polygon) || polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if (!finitePoint(a) || !finitePoint(b) || a.x === b.x && a.y === b.y) continue;
      const hit = ((a.y > point.y) !== (b.y > point.y)) &&
        (point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || 1e-12) + a.x);
      if (hit) inside = !inside;
    }
    return inside;
  }

  function rectCorners(rect) {
    return [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x + rect.w, y: rect.y + rect.h },
      { x: rect.x, y: rect.y + rect.h },
    ];
  }

  function polygonIntersectsRect(polygon, rect) {
    if (!rect || !Array.isArray(polygon) || polygon.length < 3) return false;
    const clean = polygon.filter(finitePoint);
    if (clean.length < 3) return false;
    if (rectCorners(rect).some((point) => pointInPolygon(point, clean))) return true;
    if (pointInPolygon({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }, clean)) return true;
    if (clean.some((point) => pointInRect(point, rect))) return true;
    const edges = rectCorners(rect);
    for (let i = 0; i < clean.length; i++) {
      const a = clean[i], b = clean[(i + 1) % clean.length];
      for (let k = 0; k < 4; k++) {
        if (segmentsIntersect(a, b, edges[k], edges[(k + 1) % 4])) return true;
      }
    }
    return false;
  }

  function simplifyPolyline(points, tolerance) {
    const source = (points || []).filter(finitePoint);
    if (source.length <= 2) return source.map((point) => ({ x: point.x, y: point.y }));
    const keep = new Uint8Array(source.length);
    keep[0] = 1;
    keep[source.length - 1] = 1;
    const stack = [[0, source.length - 1]];
    const tol = Number.isFinite(tolerance) && tolerance > 0 ? tolerance : 2;
    while (stack.length) {
      const pair = stack.pop();
      const a = pair[0], b = pair[1];
      const ax = source[a].x, ay = source[a].y, bx = source[b].x, by = source[b].y;
      const dx = bx - ax, dy = by - ay;
      const len = dx * dx + dy * dy || 1;
      let max = 0, idx = -1;
      for (let i = a + 1; i < b; i++) {
        const px = source[i].x, py = source[i].y;
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
        const dist = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
        if (dist > max) { max = dist; idx = i; }
      }
      if (idx >= 0 && max > tol) {
        keep[idx] = 1;
        stack.push([a, idx], [idx, b]);
      }
    }
    const out = [];
    for (let i = 0; i < source.length; i++) if (keep[i]) out.push({ x: source[i].x, y: source[i].y });
    return out;
  }

  function convexHull(points) {
    const unique = [];
    const seen = new Set();
    for (const point of points || []) {
      if (!finitePoint(point)) continue;
      const key = point.x.toFixed(3) + "," + point.y.toFixed(3);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push({ x: point.x, y: point.y });
    }
    unique.sort((a, b) => a.x - b.x || a.y - b.y);
    if (unique.length <= 2) return unique;
    const lower = [];
    const upper = [];
    for (const point of unique) {
      while (lower.length >= 2 && orient(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
      lower.push(point);
    }
    for (let i = unique.length - 1; i >= 0; i--) {
      const point = unique[i];
      while (upper.length >= 2 && orient(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
      upper.push(point);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper);
  }

  function expandHull(hull, pad) {
    if (!hull || hull.length < 3 || !(pad > 0)) return (hull || []).map((point) => ({ x: point.x, y: point.y }));
    let cx = 0, cy = 0;
    for (const point of hull) { cx += point.x; cy += point.y; }
    cx /= hull.length;
    cy /= hull.length;
    return hull.map((point) => {
      const dx = point.x - cx, dy = point.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      return { x: point.x + dx / len * pad, y: point.y + dy / len * pad };
    });
  }

  function selectCandidates(geometry, candidates) {
    const picked = [];
    const seen = new Set();
    const list = Array.isArray(candidates) ? candidates : [];
    for (const item of list) {
      if (!item || seen.has(item.id) || !item.rect) continue;
      const hit = geometry && geometry.kind === "lasso"
        ? polygonIntersectsRect(geometry.points, item.rect)
        : rectIntersectsRect(geometry && geometry.rect, item.rect);
      if (!hit) continue;
      seen.add(item.id);
      picked.push(item.id);
    }
    return picked;
  }

  function bezierPoint(curve, t) {
    const u = 1 - t;
    return {
      x: u * u * u * curve.x1 + 3 * u * u * t * curve.cp1x + 3 * u * t * t * curve.cp2x + t * t * t * curve.x2,
      y: u * u * u * curve.y1 + 3 * u * u * t * curve.cp1y + 3 * u * t * t * curve.cp2y + t * t * t * curve.y2,
    };
  }

  function bezierTangent(curve, t) {
    const u = 1 - t;
    const dx = 3 * u * u * (curve.cp1x - curve.x1) + 6 * u * t * (curve.cp2x - curve.cp1x) + 3 * t * t * (curve.x2 - curve.cp2x);
    const dy = 3 * u * u * (curve.cp1y - curve.y1) + 6 * u * t * (curve.cp2y - curve.cp1y) + 3 * t * t * (curve.y2 - curve.cp2y);
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  function opposite(side) {
    return { left: "right", right: "left", top: "bottom", bottom: "top" }[side] || "left";
  }

  function anchor(rect, side, margin) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const m = margin || 0;
    if (side === "left") return { x: rect.x - m, y: cy };
    if (side === "right") return { x: rect.x + rect.w + m, y: cy };
    if (side === "top") return { x: cx, y: rect.y - m };
    return { x: cx, y: rect.y + rect.h + m };
  }

  function computeSmartSpline(fromRect, toRect) {
    const from = fromRect || { x: 0, y: 0, w: 1, h: 1 };
    const to = toRect || { x: 40, y: 0, w: 1, h: 1 };
    const fx = from.x + from.w / 2, fy = from.y + from.h / 2;
    const tx = to.x + to.w / 2, ty = to.y + to.h / 2;
    const dx = tx - fx, dy = ty - fy;
    const dist = Math.hypot(dx, dy);
    const sourceSide = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "right" : "left") : (dy >= 0 ? "bottom" : "top");
    const targetSide = opposite(sourceSide);
    const start = anchor(from, sourceSide, 6);
    const end = anchor(to, targetSide, 6);
    const span = Math.max(18, Math.min(160, dist * 0.35));
    const dir = {
      left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 },
    }[sourceSide];
    const back = { x: -dir.x, y: -dir.y };
    const bow = Math.min(36, dist * 0.08) * (dy >= 0 ? 1 : -1);
    const curve = {
      x1: start.x,
      y1: start.y,
      cp1x: start.x + dir.x * span + (dir.y === 0 ? 0 : bow),
      cp1y: start.y + dir.y * span + (dir.x === 0 ? bow : 0),
      cp2x: end.x + back.x * span,
      cp2y: end.y + back.y * span,
      x2: end.x,
      y2: end.y,
      sourceSide,
      targetSide,
    };
    if (!(dist > 8)) {
      curve.cp1x = start.x + dir.x * 16;
      curve.cp1y = start.y + dir.y * 16;
      curve.cp2x = end.x + back.x * 16;
      curve.cp2y = end.y + back.y * 16;
    }
    const mid = bezierPoint(curve, 0.5);
    const arrow = bezierPoint(curve, 0.78);
    const tangent = bezierTangent(curve, 0.78);
    curve.labelX = mid.x;
    curve.labelY = mid.y;
    curve.tangentX = tangent.x;
    curve.tangentY = tangent.y;
    curve.arrowX = arrow.x;
    curve.arrowY = arrow.y;
    const xs = [curve.x1, curve.cp1x, curve.cp2x, curve.x2];
    const ys = [curve.y1, curve.cp1y, curve.cp2y, curve.y2];
    curve.bounds = {
      minX: Math.min(...xs), minY: Math.min(...ys),
      maxX: Math.max(...xs), maxY: Math.max(...ys),
    };
    return curve;
  }

  function rectFromLayout(layout) {
    const w = Math.max(1, Number(layout && layout.width) || 1);
    const h = Math.max(1, Number(layout && layout.height) || 1);
    return {
      x: Number(layout && layout.x) - w / 2,
      y: Number(layout && layout.y) - h / 2,
      w, h,
    };
  }

  function paintDirection(ctx, curve, options) {
    if (!ctx || !curve || !Number.isFinite(curve.arrowX) || !Number.isFinite(curve.tangentX)) return;
    const zoom = Math.max(0.05, Number(options && options.zoom) || 1);
    const len = (options && options.emphasize ? 10 : 8) / zoom;
    const tx = curve.tangentX, ty = curve.tangentY;
    const px = -ty, py = tx;
    ctx.save();
    ctx.setLineDash([]);
    ctx.lineWidth = (options && options.emphasize ? 2 : 1.5) / zoom;
    ctx.strokeStyle = curve.color || ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(curve.arrowX - tx * len + px * len * 0.45, curve.arrowY - ty * len + py * len * 0.45);
    ctx.lineTo(curve.arrowX, curve.arrowY);
    ctx.lineTo(curve.arrowX - tx * len - px * len * 0.45, curve.arrowY - ty * len - py * len * 0.45);
    ctx.stroke();
    ctx.restore();
  }

  const api = {
    normalizeRect, rectIntersectsRect, pointInRect, pointInPolygon, segmentsIntersect,
    polygonIntersectsRect, simplifyPolyline, convexHull, expandHull, selectCandidates,
    bezierPoint, bezierTangent, computeSmartSpline, rectFromLayout, paintDirection,
  };
  root.NeuroMapCanvasGeometry = api;
})(typeof globalThis === "object" ? globalThis : this);
