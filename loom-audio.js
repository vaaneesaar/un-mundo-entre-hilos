'use strict';

const LoomAudio = (() => {
  const presets = {
    neutral:     { decay: .47, cutoff: 1850, shade: .38, space: 1, bend: 0, pair: false },
    nostalgia:   { decay: .91, cutoff: 950,  shade: .23, space: 1.65, bend: -3, pair: false },
    joy:    { decay: .53, cutoff: 2800, shade: .63, space: .82, bend: 4, pair: false },
    anticipation: { decay: .37, cutoff: 2200, shade: .47, space: 1.08, bend: 13, pair: false },
    reunion:     { decay: .74, cutoff: 1650, shade: .41, space: 1.18, bend: -8, pair: true }
  };
  const limit = 5;
  const ceiling = .16;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function hash(text) {
    let value = 2166136261;
    for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
    return value >>> 0;
  }

  function describe(routes) {
    let flights = 0, squares = 0, count = 0;
    for (const route of routes) {
      const volume = route.flightCount;
      if (!(volume > 0)) continue;
      flights += volume;
      squares += volume * volume;
      count++;
    }
    // Shared logarithmic scales, across every filter and time interval.
    return {
      flights,
      density: clamp(Math.log1p(flights / 60) / Math.log1p(1000000 / 60), 0, 1),
      layers: 1 + Math.round(3 * clamp(Math.log1p(count) / Math.log1p(20000), 0, 1)),
      concentration: flights ? Math.sqrt(squares) / flights : 0
    };
  }

  function mount(button, volume, status, control) {
    let audio, master, enabled = false, visible = false, generation = 0;
    let ambientTimer, cueTimer, suspendTimer, lastGesture = -Infinity, lastTension = -Infinity;
    let viewKey = '', profile = describe([]), pendingRoutes, emotion = 'neutral', tension;
    let weaving = false, lastStage = -1;
    const voices = new Set();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const allowed = () => enabled && visible && !document.hidden;
    const ready = () => allowed() && audio?.state === 'running';

    function updateProfile() {
      if (!pendingRoutes) return;
      profile = describe(pendingRoutes);
      pendingRoutes = undefined;
    }

    function syncControl() {
      button.setAttribute('aria-pressed', String(enabled));
      button.textContent = enabled ? 'Silenciar sonido' : 'Activar sonido';
      status.textContent = enabled ? 'Sonido activado' : 'Sonido silenciado';
      control?.toggleAttribute('data-enabled', enabled);
      control?.setAttribute('aria-label', 'Sonido del Telar, ' + (enabled ? 'activado' : 'silenciado'));
    }

    function updateVolume() {
      if (!master) return;
      const amount = clamp(Number(volume.value) / 100, 0, 1);
      master.gain.setTargetAtTime(allowed() ? ceiling * amount : 0, audio.currentTime, .012);
    }

    function stopVoice(voice, immediate = false) {
      if (voice.stopped) return;
      voice.stopped = true;
      const now = audio.currentTime;
      voice.gain.gain.setTargetAtTime(.00001, now, .009);
      for (const oscillator of voice.oscillators) oscillator.stop(now + (immediate ? .035 : .05));
    }

    function stopTension() {
      if (tension) stopVoice(tension);
      tension = undefined;
      lastTension = -Infinity;
    }

    function silence() {
      clearTimeout(ambientTimer);
      clearTimeout(cueTimer);
      stopTension();
      for (const voice of voices) stopVoice(voice, true);
    }

    async function reconcile(preview = false) {
      const id = ++generation;
      clearTimeout(suspendTimer);
      updateVolume();
      if (!allowed()) {
        weaving = false;
        if (!audio) return;
        silence();
        suspendTimer = setTimeout(() => {
          if (id === generation && !allowed()) audio.suspend().catch(() => {});
        }, 55);
        return;
      }
      if (!audio) return;
      updateProfile();
      try {
        await audio.resume();
        if (id === generation && ready()) {
          if (preview === true) note('resonancia', .15, 'preview');
          planAmbient();
        }
      } catch {
        if (id !== generation) return;
        enabled = false;
        syncControl();
        status.textContent = 'Safari no pudo iniciar el sonido.';
      }
    }

    function newVoice(frequency, strength, duration, kind, shade = 1, pan = 0) {
      if (!ready() || voices.size >= limit) return;
      const preset = presets[emotion];
      const now = audio.currentTime;
      const gain = audio.createGain();
      const filter = audio.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = preset.cutoff * (.79 + profile.concentration * .36);
      filter.Q.value = .32;
      filter.connect(gain);
      const panner = audio.createStereoPanner?.();
      if (panner) {
        panner.pan.value = pan;
        gain.connect(panner);
        panner.connect(master);
      } else gain.connect(master);
      const sustained = kind === 'tension';
      const partials = sustained ? [1, 2.008] : [1, 2.006, 3.013, 4.16].slice(0, Math.max(profile.layers, preset.pair ? 2 : 1));
      const voice = { oscillators: [], gain, filter, kind, stopped: false };
      voices.add(voice);
      const level = strength * (.85 + .15 * profile.concentration);
      gain.gain.setValueAtTime(.00001, now);
      gain.gain.exponentialRampToValueAtTime(level, now + (sustained ? .075 : .023));
      if (emotion === 'anticipation' && !sustained) {
        gain.gain.exponentialRampToValueAtTime(level * .26, now + .10);
        gain.gain.exponentialRampToValueAtTime(level * .64, now + .143);
      }
      if (!sustained) gain.gain.exponentialRampToValueAtTime(.00001, now + duration);
      let remaining = partials.length;
      for (const [index, ratio] of partials.entries()) {
        const oscillator = audio.createOscillator();
        const partial = audio.createGain();
        const centre = frequency * ratio;
        oscillator.type = 'sine';
        oscillator.frequency.value = centre * (preset.pair && index === 1 ? .977 : 1);
        oscillator.detune.setValueAtTime(preset.bend, now);
        oscillator.detune.linearRampToValueAtTime(0, now + Math.min(duration, .23));
        if (preset.pair && index === 1)
          oscillator.frequency.exponentialRampToValueAtTime(centre, now + .28);
        partial.gain.value = index === 0 ? .68 : preset.shade * shade / (index * 2.6);
        oscillator.connect(partial);
        partial.connect(filter);
        oscillator.onended = () => {
          oscillator.disconnect();
          partial.disconnect();
          if (--remaining === 0) {
            filter.disconnect();
            gain.disconnect();
            panner?.disconnect();
            voices.delete(voice);
          }
        };
        voice.oscillators.push(oscillator);
        oscillator.start(now);
        oscillator.stop(now + (sustained ? 15 : duration + .03));
      }
      return voice;
    }

    function note(key, strength, kind, { shift = 1, shade = 1, pan = 0 } = {}) {
      const root = 142 * 2 ** ((hash(String(key)) % 15) / 12);
      const decay = presets[emotion].decay * (kind === 'ambient' ? 1.22 : 1);
      newVoice(root * shift, strength, decay, kind, shade, pan);
    }

    function planAmbient() {
      clearTimeout(ambientTimer);
      if (!ready() || !profile.flights || weaving) return;
      const delay = (4900 - 2700 * profile.density) * presets[emotion].space *
        (reduced.matches ? 1.35 : 1) * (.88 + Math.random() * .56);
      ambientTimer = setTimeout(() => {
        if (!ready() || weaving) return;
        note(viewKey + Math.floor(Math.random() * 31), .062, 'ambient', { pan: Math.random() * .64 - .32 });
        planAmbient();
      }, delay);
    }

    function cue(kind) {
      if (!ready()) return;
      clearTimeout(cueTimer);
      cueTimer = setTimeout(() => {
        if (!weaving && profile.flights)
          note(viewKey + emotion + kind, .14, kind, { shift: kind === 'emotion' ? 1.12 : 1 });
      }, 125);
    }

    button.addEventListener('click', () => {
      if (!enabled && !audio) {
        const Context = window.AudioContext ?? window.webkitAudioContext;
        if (!Context) { status.textContent = 'Audio interactivo no disponible.'; return; }
        try {
          audio = new Context();
          master = audio.createGain();
          master.gain.value = 0;
          master.connect(audio.destination);
        } catch {
          status.textContent = 'Safari no pudo iniciar el sonido.';
          return;
        }
      }
      enabled = !enabled;
      syncControl();
      reconcile(enabled);
    });
    volume.addEventListener('input', updateVolume);
    document.addEventListener('visibilitychange', reconcile);
    window.addEventListener('pagehide', () => {
      visible = false;
      reconcile();
    });
    window.addEventListener('pageshow', () => {
      visible = location.hash === '#telar';
      reconcile();
    });

    return {
      setVisible(value) { visible = value; reconcile(); },
      setScene(routes, key) {
        if (key === viewKey) return;
        const previous = viewKey;
        viewKey = key;
        pendingRoutes = routes;
        if (!enabled) return;
        updateProfile();
        for (const voice of voices) if (voice.kind === 'ambient') stopVoice(voice);
        if (previous) cue('date');
        planAmbient();
      },
      setEmotion(id) {
        if (id === emotion) return;
        emotion = Object.hasOwn(presets, id) ? id : 'neutral';
        for (const voice of voices) if (voice.kind === 'ambient') stopVoice(voice);
        cue('emotion');
        planAmbient();
      },
      build(progress, outcome) {
        if (outcome) {
          if (weaving && outcome === 'complete' && profile.flights)
            note(viewKey + 'resolución', .18, 'resolve', { shift: 1.5, shade: .65 });
          else for (const voice of voices) if (voice.kind === 'weaving') stopVoice(voice);
          weaving = false;
          lastStage = -1;
          planAmbient();
          return;
        }
        if (!ready() || !profile.flights) return;
        if (progress === 0 || !weaving) {
          for (const voice of voices) if (voice.kind === 'weaving' || voice.kind === 'ambient') stopVoice(voice);
          clearTimeout(ambientTimer);
          weaving = true;
          lastStage = -1;
        }
        if (progress < .18) return;
        const groups = Math.max(2, Math.round((2 + 5 * profile.density) / presets[emotion].space));
        const stage = Math.min(groups - 1, Math.floor((progress - .18) / .82 * groups));
        if (stage <= lastStage) return;
        lastStage = stage;
        note(viewKey + 'trama' + stage, .10 + progress * .075, 'weaving',
          { pan: stage % 2 ? .35 : -.35, shade: .38 + progress * .7 });
      },
      gesture(kind, fiber, amount = 0) {
        if (kind === 'cancel') { stopTension(); return; }
        if (!ready()) return;
        const key = fiber?.flightInfo?.routeId ?? fiber?.id ?? viewKey;
        if (kind === 'tension') {
          if (audio.currentTime - lastTension < .055) return;
          lastTension = audio.currentTime;
          const stretch = clamp(amount * 2.6, 0, 1);
          if (tension && !voices.has(tension)) tension = undefined;
          tension ??= newVoice(145 + hash(key) % 70, .12, .7, 'tension', .65);
          if (!tension) return;
          const f = (145 + hash(key) % 70) * (1 + stretch * .21);
          for (const [index, oscillator] of tension.oscillators.entries())
            oscillator.frequency.setTargetAtTime(f * (index ? 2.008 : 1), audio.currentTime, .045);
          tension.filter.frequency.setTargetAtTime(620 + 700 * stretch, audio.currentTime, .06);
          return;
        }
        if (kind === 'release') {
          stopTension();
          note(key, .19, 'release', { shift: .75, shade: .55 });
        } else if (audio.currentTime - lastGesture >= .09) {
          lastGesture = audio.currentTime;
          const crossing = kind === 'cross';
          const flightWeight = Math.min(.07, Math.log1p(fiber?.flightInfo?.represented ?? 0) * .014);
          note(key, .22 + flightWeight, kind, { shade: crossing ? 1.2 : .8 });
        }
      }
    };
  }

  return { mount, describe };
})();

if (typeof module !== 'undefined') module.exports = LoomAudio;
