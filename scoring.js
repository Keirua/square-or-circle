// scoring.js — Calcul de similarité et best-fit

/**
 * Calcule le score IoU entre un cercle et un polygone convexe (par échantillonnage).
 */
function circlePolygonIoU(cx, cy, radius, hull) {
  const bb = boundingBox(hull);
  const minX = Math.min(cx - radius, bb.x);
  const minY = Math.min(cy - radius, bb.y);
  const maxX = Math.max(cx + radius, bb.x + bb.width);
  const maxY = Math.max(cy + radius, bb.y + bb.height);

  const steps = 100;
  const dx = (maxX - minX) / steps;
  const dy = (maxY - minY) / steps;

  let inBoth = 0, inEither = 0;

  for (let i = 0; i <= steps; i++) {
    const px = minX + i * dx;
    for (let j = 0; j <= steps; j++) {
      const py = minY + j * dy;
      const inC = pointInCircle(px, py, cx, cy, radius);
      const inH = pointInPolygon(px, py, hull);
      if (inC && inH) inBoth++;
      if (inC || inH) inEither++;
    }
  }

  return inEither === 0 ? 0 : inBoth / inEither;
}

/**
 * Calcule le score IoU entre un rectangle et un polygone convexe (analytique via clipping).
 */
function rectPolygonIoU(rx, ry, rw, rh, hull) {
  const hullArea = polygonArea(hull);
  const rectArea = rw * rh;
  if (hullArea === 0 || rectArea === 0) return 0;

  const intersection = clipPolygonByRect(hull, rx, ry, rw, rh);
  const interArea = intersection.length >= 3 ? polygonArea(intersection) : 0;
  const unionArea = hullArea + rectArea - interArea;

  return unionArea === 0 ? 0 : interArea / unionArea;
}

/**
 * Calcule le score de similarité pour la forme courante.
 * @returns {number} score entre 0 et 100
 */
function computeScore(shape, hull) {
  if (!hull || hull.length < 3) return 0;

  let iou;
  if (shape.type === 'circle') {
    iou = circlePolygonIoU(shape.cx, shape.cy, shape.radius, hull);
  } else {
    iou = rectPolygonIoU(shape.x, shape.y, shape.width, shape.height, hull);
  }
  return Math.round(iou * 100);
}

/**
 * Trouve le meilleur cercle qui épouse l'enveloppe convexe du visage.
 */
function bestFitCircle(landmarks, hull) {
  const center = centroid(landmarks);

  // Distance moyenne des points du hull au centre
  let sumDist = 0;
  for (const p of hull) {
    sumDist += Math.sqrt((p.x - center.x) ** 2 + (p.y - center.y) ** 2);
  }
  const meanRadius = sumDist / hull.length;

  // Optimiser le rayon autour de la moyenne pour maximiser IoU
  let bestScore = -1, bestRadius = meanRadius;
  for (let factor = 0.7; factor <= 1.3; factor += 0.02) {
    const r = meanRadius * factor;
    const score = circlePolygonIoU(center.x, center.y, r, hull);
    if (score > bestScore) {
      bestScore = score;
      bestRadius = r;
    }
  }

  return {
    type: 'circle',
    cx: center.x,
    cy: center.y,
    radius: bestRadius,
    score: Math.round(bestScore * 100)
  };
}

/**
 * Trouve le meilleur rectangle qui épouse l'enveloppe convexe du visage.
 */
function bestFitRect(landmarks, hull) {
  const bb = boundingBox(hull);

  // Tester des rétrécissements pour maximiser l'IoU
  let bestScore = -1, bestRect = { x: bb.x, y: bb.y, width: bb.width, height: bb.height };

  for (let sx = 0; sx <= 0.2; sx += 0.02) {
    for (let sy = 0; sy <= 0.2; sy += 0.02) {
      const rx = bb.x + bb.width * sx / 2;
      const ry = bb.y + bb.height * sy / 2;
      const rw = bb.width * (1 - sx);
      const rh = bb.height * (1 - sy);
      const score = rectPolygonIoU(rx, ry, rw, rh, hull);
      if (score > bestScore) {
        bestScore = score;
        bestRect = { x: rx, y: ry, width: rw, height: rh };
      }
    }
  }

  return {
    type: 'rectangle',
    ...bestRect,
    score: Math.round(bestScore * 100)
  };
}
