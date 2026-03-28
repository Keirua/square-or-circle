// geometry.js — Algorithmes géométriques

/**
 * Enveloppe convexe via Andrew's monotone chain.
 * @param {Array<{x: number, y: number}>} points
 * @returns {Array<{x: number, y: number}>} sommets de l'enveloppe convexe (sens anti-horaire)
 */
function convexHull(points) {
  const pts = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length <= 1) return pts;

  const cross = (O, A, B) => (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);

  // Lower hull
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }

  // Upper hull
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }

  // Remove last point of each half because it's repeated
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Aire d'un polygone (shoelace formula). Retourne la valeur absolue.
 */
function polygonArea(vertices) {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Test point-in-polygon (ray casting).
 */
function pointInPolygon(px, py, polygon) {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Test point-in-circle.
 */
function pointInCircle(px, py, cx, cy, r) {
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

/**
 * Test point-in-rectangle.
 */
function pointInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

/**
 * Clipping Sutherland-Hodgman : découpe un polygone par un demi-plan.
 * L'arête de découpe va de edgeA à edgeB ; les points à gauche sont gardés.
 */
function clipPolygonByEdge(polygon, edgeA, edgeB) {
  if (polygon.length === 0) return [];

  const output = [];
  const inside = (p) =>
    (edgeB.x - edgeA.x) * (p.y - edgeA.y) - (edgeB.y - edgeA.y) * (p.x - edgeA.x) >= 0;

  const intersection = (p1, p2) => {
    const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
    const x3 = edgeA.x, y3 = edgeA.y, x4 = edgeB.x, y4 = edgeB.y;
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return p1;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
  };

  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % n];
    const curInside = inside(current);
    const nextInside = inside(next);

    if (curInside) {
      output.push(current);
      if (!nextInside) output.push(intersection(current, next));
    } else if (nextInside) {
      output.push(intersection(current, next));
    }
  }
  return output;
}

/**
 * Clipping Sutherland-Hodgman complet : intersection d'un polygone avec un rectangle.
 * @returns {Array<{x: number, y: number}>} polygone résultant
 */
function clipPolygonByRect(polygon, rx, ry, rw, rh) {
  // Les 4 arêtes du rectangle (sens anti-horaire)
  const edges = [
    [{ x: rx, y: ry }, { x: rx + rw, y: ry }],         // top
    [{ x: rx + rw, y: ry }, { x: rx + rw, y: ry + rh }], // right
    [{ x: rx + rw, y: ry + rh }, { x: rx, y: ry + rh }], // bottom
    [{ x: rx, y: ry + rh }, { x: rx, y: ry }],           // left
  ];

  let result = polygon.slice();
  for (const [a, b] of edges) {
    result = clipPolygonByEdge(result, a, b);
    if (result.length === 0) return [];
  }
  return result;
}

/**
 * Centroïde d'un ensemble de points.
 */
function centroid(points) {
  let sx = 0, sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}

/**
 * Bounding box d'un ensemble de points.
 */
function boundingBox(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Extrapole des points de front à partir des landmarks.
 * Les landmarks 17-21 (sourcil gauche) et 22-26 (sourcil droit) sont les plus hauts.
 * On les projette vers le haut en utilisant la distance nez-sourcils comme estimation
 * de la hauteur du front.
 *
 * @param {Array<{x: number, y: number}>} landmarks - Les 68 landmarks du visage
 * @returns {Array<{x: number, y: number}>} Landmarks originaux + points de front extrapolés
 */
function addForeheadPoints(landmarks) {
  // Sourcils : indices 17-26
  const eyebrowPoints = landmarks.slice(17, 27);

  // Menton : indice 8 (point le plus bas du contour)
  const chin = landmarks[8];
  const eyebrowCenter = centroid(eyebrowPoints);

  // Le front fait environ 40% de la hauteur sourcils → menton
  const faceHeight = Math.abs(chin.y - eyebrowCenter.y);
  const foreheadHeight = faceHeight * 0.4;

  // Créer des points extrapolés au-dessus de chaque point de sourcil
  const foreheadPoints = eyebrowPoints.map(p => ({
    x: p.x,
    y: p.y - foreheadHeight
  }));

  // Point au sommet du crâne (légèrement plus haut que les autres)
  foreheadPoints.push({
    x: eyebrowCenter.x,
    y: eyebrowCenter.y - foreheadHeight * 1.15
  });

  // Relier le contour du visage (landmarks 0-16) au front avec des points
  // intermédiaires le long des tempes.
  // Côté gauche : du contour (landmarks 0→1→2) vers le sourcil gauche (17)
  // Côté droit : du contour (landmarks 16→15→14) vers le sourcil droit (26)
  const leftSide = [landmarks[0], landmarks[1], landmarks[2]];
  const rightSide = [landmarks[16], landmarks[15], landmarks[14]];
  const leftEyebrow = eyebrowPoints[0];   // landmark 17
  const rightEyebrow = eyebrowPoints[9];  // landmark 26
  const leftTop = foreheadPoints[0];      // au-dessus du landmark 17
  const rightTop = foreheadPoints[9];     // au-dessus du landmark 26

  // Interpoler des points le long de la tempe gauche (contour → front)
  for (const p of leftSide) {
    // Point intermédiaire entre le contour et le haut du front
    const t = 0.5;
    foreheadPoints.push({
      x: p.x + (leftTop.x - p.x) * t,
      y: p.y + (leftTop.y - p.y) * t
    });
    // Point plus haut, proche du front
    foreheadPoints.push({
      x: p.x + (leftTop.x - p.x) * 0.8,
      y: p.y + (leftTop.y - p.y) * 0.8
    });
  }

  // Interpoler des points le long de la tempe droite (contour → front)
  for (const p of rightSide) {
    const t = 0.5;
    foreheadPoints.push({
      x: p.x + (rightTop.x - p.x) * t,
      y: p.y + (rightTop.y - p.y) * t
    });
    foreheadPoints.push({
      x: p.x + (rightTop.x - p.x) * 0.8,
      y: p.y + (rightTop.y - p.y) * 0.8
    });
  }

  return landmarks.concat(foreheadPoints);
}
