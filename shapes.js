// shapes.js — Gestion des formes interactives sur le canvas

const HANDLE_SIZE = 8;
const HANDLE_HIT = 12;

/**
 * Crée une forme cercle centrée sur le visage détecté.
 */
function createCircle(landmarks) {
  const c = centroid(landmarks);
  const bb = boundingBox(landmarks);
  const radius = Math.min(bb.width, bb.height) / 2;
  return { type: 'circle', cx: c.x, cy: c.y, radius };
}

/**
 * Crée une forme rectangle centrée sur le visage détecté.
 */
function createRectangle(landmarks) {
  const bb = boundingBox(landmarks);
  const margin = 0.05;
  return {
    type: 'rectangle',
    x: bb.x - bb.width * margin,
    y: bb.y - bb.height * margin,
    width: bb.width * (1 + 2 * margin),
    height: bb.height * (1 + 2 * margin)
  };
}

/**
 * Retourne les poignées de redimensionnement pour la forme.
 * Chaque poignée : { x, y, cursor, id }
 */
function getHandles(shape) {
  if (shape.type === 'circle') {
    const { cx, cy, radius: r } = shape;
    return [
      { id: 'n', x: cx, y: cy - r, cursor: 'ns-resize' },
      { id: 's', x: cx, y: cy + r, cursor: 'ns-resize' },
      { id: 'e', x: cx + r, y: cy, cursor: 'ew-resize' },
      { id: 'w', x: cx - r, y: cy, cursor: 'ew-resize' },
    ];
  } else {
    const { x, y, width: w, height: h } = shape;
    return [
      { id: 'nw', x: x, y: y, cursor: 'nwse-resize' },
      { id: 'ne', x: x + w, y: y, cursor: 'nesw-resize' },
      { id: 'se', x: x + w, y: y + h, cursor: 'nwse-resize' },
      { id: 'sw', x: x, y: y + h, cursor: 'nesw-resize' },
      { id: 'n', x: x + w / 2, y: y, cursor: 'ns-resize' },
      { id: 's', x: x + w / 2, y: y + h, cursor: 'ns-resize' },
      { id: 'e', x: x + w, y: y + h / 2, cursor: 'ew-resize' },
      { id: 'w', x: x, y: y + h / 2, cursor: 'ew-resize' },
    ];
  }
}

/**
 * Hit-test des poignées. Retourne l'id de la poignée touchée ou null.
 */
function hitTestHandles(mx, my, shape) {
  const handles = getHandles(shape);
  for (const h of handles) {
    if (Math.abs(mx - h.x) <= HANDLE_HIT && Math.abs(my - h.y) <= HANDLE_HIT) {
      return h;
    }
  }
  return null;
}

/**
 * Hit-test du corps de la forme. Retourne true si le point est dans la forme.
 */
function hitTestShape(mx, my, shape) {
  if (shape.type === 'circle') {
    return pointInCircle(mx, my, shape.cx, shape.cy, shape.radius);
  } else {
    return pointInRect(mx, my, shape.x, shape.y, shape.width, shape.height);
  }
}

/**
 * Applique un déplacement à la forme.
 */
function moveShape(shape, dx, dy) {
  if (shape.type === 'circle') {
    shape.cx += dx;
    shape.cy += dy;
  } else {
    shape.x += dx;
    shape.y += dy;
  }
}

/**
 * Applique un redimensionnement à la forme à partir d'une poignée.
 */
function resizeShape(shape, handleId, dx, dy) {
  if (shape.type === 'circle') {
    // Toute poignée change le rayon
    switch (handleId) {
      case 'n': shape.radius = Math.max(20, shape.radius - dy); break;
      case 's': shape.radius = Math.max(20, shape.radius + dy); break;
      case 'e': shape.radius = Math.max(20, shape.radius + dx); break;
      case 'w': shape.radius = Math.max(20, shape.radius - dx); break;
    }
  } else {
    const minSize = 30;
    switch (handleId) {
      case 'nw':
        shape.x += dx; shape.y += dy;
        shape.width = Math.max(minSize, shape.width - dx);
        shape.height = Math.max(minSize, shape.height - dy);
        break;
      case 'ne':
        shape.y += dy;
        shape.width = Math.max(minSize, shape.width + dx);
        shape.height = Math.max(minSize, shape.height - dy);
        break;
      case 'se':
        shape.width = Math.max(minSize, shape.width + dx);
        shape.height = Math.max(minSize, shape.height + dy);
        break;
      case 'sw':
        shape.x += dx;
        shape.width = Math.max(minSize, shape.width - dx);
        shape.height = Math.max(minSize, shape.height + dy);
        break;
      case 'n':
        shape.y += dy;
        shape.height = Math.max(minSize, shape.height - dy);
        break;
      case 's':
        shape.height = Math.max(minSize, shape.height + dy);
        break;
      case 'e':
        shape.width = Math.max(minSize, shape.width + dx);
        break;
      case 'w':
        shape.x += dx;
        shape.width = Math.max(minSize, shape.width - dx);
        break;
    }
  }
}

/**
 * Dessine la forme, ses poignées et l'enveloppe convexe sur le canvas.
 */
function drawOverlay(ctx, capturedImage, hull, shape, bestFitShapes) {
  // Redessiner l'image capturée
  ctx.putImageData(capturedImage, 0, 0);

  // Dessiner l'enveloppe convexe (pointillés)
  if (hull && hull.length >= 3) {
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hull[0].x, hull[0].y);
    for (let i = 1; i < hull.length; i++) {
      ctx.lineTo(hull[i].x, hull[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // Dessiner les best-fit shapes
  if (bestFitShapes) {
    for (const bf of bestFitShapes) {
      drawShape(ctx, bf.shape, bf.color, true);
    }
  }

  // Dessiner la forme active
  if (shape) {
    drawShape(ctx, shape, 'rgba(0, 150, 255, 1)', false);
    // Poignées
    const handles = getHandles(shape);
    for (const h of handles) {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#0096ff';
      ctx.lineWidth = 2;
      ctx.fillRect(h.x - HANDLE_SIZE / 2, h.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
      ctx.strokeRect(h.x - HANDLE_SIZE / 2, h.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    }
  }
}

function drawShape(ctx, shape, color, dashed) {
  ctx.save();
  if (dashed) ctx.setLineDash([6, 4]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;

  if (dashed) {
    ctx.fillStyle = color.replace('1)', '0.15)').replace('rgb', 'rgba');
  } else {
    ctx.fillStyle = 'transparent';
  }

  if (shape.type === 'circle') {
    ctx.beginPath();
    ctx.arc(shape.cx, shape.cy, shape.radius, 0, Math.PI * 2);
  } else {
    ctx.beginPath();
    ctx.rect(shape.x, shape.y, shape.width, shape.height);
  }

  if (dashed) ctx.fill();
  ctx.stroke();
  ctx.restore();
}
