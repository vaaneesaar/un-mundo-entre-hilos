const handVisionURL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32';
const handModelURL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

function createHandSequence() {
  let previous, consecutive = 0, fistAt = -Infinity, fired = false;
  return function detect(category, timestamp) {
    const minimumScore = category?.categoryName === 'Open_Palm' ? 0.58 : 0.7;
    const pose = category?.score >= minimumScore ? category.categoryName : '';
    consecutive = pose === previous ? consecutive + 1 : 1;
    previous = pose;
    if (consecutive >= 4 && pose === 'Closed_Fist') fistAt = timestamp;
    if (!fired && consecutive >= 4 && pose === 'Open_Palm' && timestamp - fistAt <= 2800) {
      fired = true;
      return true;
    }
    return false;
  };
}

function initHandGesture(screen, begin) {
  const trigger = screen.querySelector('.hand-start');
  const panel = screen.querySelector('.hand-camera');
  const video = panel.querySelector('video');
  const status = panel.querySelector('[role="status"]');
  const cancel = panel.querySelector('button');
  let session;

  function stopCapture() {
    const current = session;
    session = undefined;
    if (current) {
      cancelAnimationFrame(current.frame);
      current.stream?.getTracks().forEach(track => track.stop());
      current.recognizer?.close();
    }
    video.srcObject = null;
    video.hidden = true;
  }

  function stop() {
    stopCapture();
    if (panel.matches(':popover-open')) panel.hidePopover();
  }

  panel.addEventListener('beforetoggle', event => {
    trigger.setAttribute('aria-expanded', String(event.newState === 'open'));
    if (event.newState === 'closed') stopCapture();
  });
  cancel.addEventListener('click', () => {
    stop();
    trigger.focus({ preventScroll: true });
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);

  trigger.addEventListener('click', async () => {
    if (panel.matches(':popover-open')) return;
    panel.showPopover();
    cancel.focus({ preventScroll: true });
    status.textContent = 'Solicitando acceso a la cámara…';
    const current = session = {};
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        status.textContent = 'La cámara no está disponible. Puedes comenzar con el botón habitual.';
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 } }
      });
      if (session !== current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      current.stream = stream;
      video.srcObject = stream;
      video.hidden = false;
      await video.play();
      if (session !== current) return;
      status.textContent = 'Preparando el reconocimiento local…';
      const { FilesetResolver, GestureRecognizer } = await import(handVisionURL + '/vision_bundle.mjs');
      if (session !== current) return;
      const files = await FilesetResolver.forVisionTasks(handVisionURL + '/wasm');
      if (session !== current) return;
      const recognizer = await GestureRecognizer.createFromOptions(files, {
        baseOptions: { modelAssetPath: handModelURL, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numHands: 1
      });
      if (session !== current) {
        recognizer.close();
        return;
      }
      current.recognizer = recognizer;
      const detect = createHandSequence();
      const prompt = 'Cierra la mano y después ábrela frente a la cámara.';
      status.textContent = prompt;
      let lastSample = -Infinity, lastVideoTime = -1, lastHand = performance.now();

      function scan(now) {
        if (session !== current) return;
        try {
          if (now - lastSample >= 80 && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
            lastSample = now;
            lastVideoTime = video.currentTime;
            const result = recognizer.recognizeForVideo(video, now);
            if (result.landmarks.length) lastHand = now;
            const message = now - lastHand > 2500 ? 'Acerca la mano al centro de la cámara.' : prompt;
            if (status.textContent !== message) status.textContent = message;
            if (detect(result.gestures[0]?.[0], now)) {
              stop();
              begin();
              return;
            }
          }
          current.frame = requestAnimationFrame(scan);
        } catch {
          stopCapture();
          status.textContent = 'El reconocimiento se interrumpió. Puedes comenzar con el botón habitual.';
        }
      }

      current.frame = requestAnimationFrame(scan);
    } catch (error) {
      if (session !== current) return;
      stopCapture();
      status.textContent = error.name === 'NotAllowedError'
        ? 'Acceso a la cámara no concedido. Puedes comenzar con el botón habitual.'
        : 'No se pudo iniciar el gesto. Puedes comenzar con el botón habitual.';
    }
  });

  return stop;
}

if (typeof module !== 'undefined') module.exports = { createHandSequence };
