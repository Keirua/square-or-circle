// app.js — Logique principale de l'application

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

// État global
let state = {
  modelsLoaded: false,
  webcamActive: false,
  capturedImage: null,   // ImageData
  rawLandmarks: null,    // Array<{x, y}> — landmarks bruts de face-api.js
  landmarks: null,       // Array<{x, y}> — landmarks utilisés (avec ou sans front)
  hull: null,            // Array<{x, y}>
  activeShape: null,     // { type, cx, cy, radius } ou { type, x, y, width, height }
  bestFitResults: null,  // [{ shape, color, score }]
  interaction: null,     // { type: 'drag'|'resize', handleId, startX, startY }
};

// Éléments DOM
let video, canvas, ctx;
let btnCapture, btnRetake, btnCircle, btnRect, btnBestFit, btnClear;
let shapeSection, scoreValue, statusBar, bestFitInfo, chkForehead;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  video = document.getElementById('webcam');
  canvas = document.getElementById('snapshot');
  ctx = canvas.getContext('2d', { willReadFrequently: true });
  btnCapture = document.getElementById('btn-capture');
  btnRetake = document.getElementById('btn-retake');
  btnCircle = document.getElementById('btn-circle');
  btnRect = document.getElementById('btn-rectangle');
  btnBestFit = document.getElementById('btn-best-fit');
  btnClear = document.getElementById('btn-clear');
  shapeSection = document.getElementById('shape-section');
  scoreValue = document.getElementById('score-value');
  statusBar = document.getElementById('status');
  bestFitInfo = document.getElementById('best-fit-info');
  chkForehead = document.getElementById('chk-forehead');

  // Event listeners — boutons
  btnCapture.addEventListener('click', capturePhoto);
  btnRetake.addEventListener('click', retake);
  btnCircle.addEventListener('click', () => activateShape('circle'));
  btnRect.addEventListener('click', () => activateShape('rectangle'));
  btnBestFit.addEventListener('click', showBestFit);
  btnClear.addEventListener('click', clearShapes);
  chkForehead.addEventListener('change', onForeheadToggle);

  // Event listeners — canvas (souris)
  canvas.addEventListener('mousedown', onPointerDown);
  canvas.addEventListener('mousemove', onPointerMove);
  canvas.addEventListener('mouseup', onPointerUp);
  canvas.addEventListener('mouseleave', onPointerUp);

  // Event listeners — canvas (touch)
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onPointerUp);

  // Charger les modèles
  setStatus('Chargement des modèles de détection...');
  try {
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    state.modelsLoaded = true;
    setStatus('Modèles chargés. Activez votre caméra.');
    await startWebcam();
  } catch (e) {
    setStatus('Erreur lors du chargement des modèles : ' + e.message);
  }
}

async function startWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
    });
    video.srcObject = stream;
    video.style.display = 'block';
    canvas.style.display = 'none';
    state.webcamActive = true;
    btnCapture.disabled = false;
    setStatus('Caméra active. Prenez une photo !');
  } catch (e) {
    setStatus('Impossible d\'accéder à la caméra : ' + e.message);
  }
}

async function capturePhoto() {
  if (!state.webcamActive) return;

  // Dessiner la frame vidéo sur le canvas
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);

  // Cacher la vidéo, afficher le canvas
  video.style.display = 'none';
  canvas.style.display = 'block';
  state.webcamActive = false;
  btnCapture.style.display = 'none';
  btnRetake.style.display = 'inline-block';

  setStatus('Détection du visage en cours...');

  // Détection du visage
  const detection = await faceapi.detectSingleFace(canvas).withFaceLandmarks();
  if (!detection) {
    setStatus('Aucun visage détecté. Veuillez reprendre la photo.');
    return;
  }

  // Extraire les landmarks
  state.rawLandmarks = detection.landmarks.positions.map(p => ({ x: p.x, y: p.y }));
  state.capturedImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
  recomputeLandmarks();

  // Dessiner les landmarks
  drawLandmarks();

  // Activer les contrôles
  shapeSection.style.display = 'flex';
  setStatus('Visage détecté ! Dessinez une forme sur le visage.');
}

function recomputeLandmarks() {
  if (!state.rawLandmarks) return;
  if (chkForehead.checked) {
    state.landmarks = addForeheadPoints(state.rawLandmarks);
  } else {
    state.landmarks = state.rawLandmarks.slice();
  }
  state.hull = convexHull(state.landmarks);
}

function onForeheadToggle() {
  recomputeLandmarks();
  // Recalculer le best-fit si affiché
  if (state.bestFitResults) {
    showBestFit();
    return;
  }
  updateDisplay();
}

function drawLandmarks() {
  if (!state.landmarks) return;
  ctx.fillStyle = 'rgba(0, 255, 128, 0.5)';
  for (const p of state.landmarks) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function retake() {
  state.activeShape = null;
  state.rawLandmarks = null;
  state.landmarks = null;
  state.hull = null;
  state.capturedImage = null;
  state.bestFitResults = null;
  state.interaction = null;
  shapeSection.style.display = 'none';
  scoreValue.textContent = '--';
  bestFitInfo.textContent = '';
  btnCapture.style.display = 'inline-block';
  btnRetake.style.display = 'none';
  startWebcam();
}

function activateShape(type) {
  if (!state.landmarks) return;
  state.bestFitResults = null;
  bestFitInfo.textContent = '';

  if (type === 'circle') {
    state.activeShape = createCircle(state.landmarks);
  } else {
    state.activeShape = createRectangle(state.landmarks);
  }
  updateDisplay();
}

function showBestFit() {
  if (!state.hull || !state.landmarks) return;

  setStatus('Calcul du meilleur ajustement...');

  const bestCircle = bestFitCircle(state.landmarks, state.hull);
  const bestRect = bestFitRect(state.landmarks, state.hull);

  state.bestFitResults = [
    { shape: { type: 'circle', cx: bestCircle.cx, cy: bestCircle.cy, radius: bestCircle.radius }, color: 'rgba(0, 200, 255, 1)', score: bestCircle.score },
    { shape: { type: 'rectangle', x: bestRect.x, y: bestRect.y, width: bestRect.width, height: bestRect.height }, color: 'rgba(50, 220, 100, 1)', score: bestRect.score },
  ];

  state.activeShape = null;

  // Afficher les résultats
  bestFitInfo.innerHTML =
    `<span class="best-circle">⬤ Meilleur cercle : ${bestCircle.score}%</span>` +
    `<span class="best-rect">▬ Meilleur rectangle : ${bestRect.score}%</span>`;
  scoreValue.textContent = '--';

  redraw();
  setStatus('Meilleur ajustement calculé.');
}

function clearShapes() {
  state.activeShape = null;
  state.bestFitResults = null;
  bestFitInfo.textContent = '';
  scoreValue.textContent = '--';
  redraw();
}

function updateDisplay() {
  redraw();
  if (state.activeShape && state.hull) {
    const score = computeScore(state.activeShape, state.hull);
    scoreValue.textContent = score + '%';
  } else {
    scoreValue.textContent = '--';
  }
}

function redraw() {
  if (!state.capturedImage) return;
  drawOverlay(ctx, state.capturedImage, state.hull, state.activeShape, state.bestFitResults);
}

// ——— Interactions souris / touch ———

function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function onPointerDown(e) {
  if (!state.activeShape) return;
  const { x, y } = getCanvasCoords(e);

  // Test poignées d'abord
  const handle = hitTestHandles(x, y, state.activeShape);
  if (handle) {
    state.interaction = { type: 'resize', handleId: handle.id, startX: x, startY: y };
    return;
  }

  // Test corps de la forme
  if (hitTestShape(x, y, state.activeShape)) {
    state.interaction = { type: 'drag', startX: x, startY: y };
  }
}

function onPointerMove(e) {
  if (!state.activeShape) {
    canvas.style.cursor = 'default';
    return;
  }

  const { x, y } = getCanvasCoords(e);

  if (state.interaction) {
    const dx = x - state.interaction.startX;
    const dy = y - state.interaction.startY;

    if (state.interaction.type === 'drag') {
      moveShape(state.activeShape, dx, dy);
    } else {
      resizeShape(state.activeShape, state.interaction.handleId, dx, dy);
    }

    state.interaction.startX = x;
    state.interaction.startY = y;
    updateDisplay();
  } else {
    // Changer le curseur
    const handle = hitTestHandles(x, y, state.activeShape);
    if (handle) {
      canvas.style.cursor = handle.cursor;
    } else if (hitTestShape(x, y, state.activeShape)) {
      canvas.style.cursor = 'grab';
    } else {
      canvas.style.cursor = 'default';
    }
  }
}

function onPointerUp() {
  if (state.interaction && state.interaction.type === 'drag') {
    canvas.style.cursor = 'grab';
  }
  state.interaction = null;
}

function onTouchStart(e) {
  e.preventDefault();
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    onPointerDown({ clientX: touch.clientX, clientY: touch.clientY });
  }
}

function onTouchMove(e) {
  e.preventDefault();
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    onPointerMove({ clientX: touch.clientX, clientY: touch.clientY });
  }
}

function setStatus(msg) {
  statusBar.textContent = msg;
}
