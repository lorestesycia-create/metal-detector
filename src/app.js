import {
  Capacitor,
  registerPlugin
} from '@capacitor/core';

import {
  AdMob,
  AdmobConsentStatus,
  BannerAdSize,
  BannerAdPosition
} from '@capacitor-community/admob';

const MagneticSensor = registerPlugin('MagneticSensor');

const TEST_BANNER =
  'ca-app-pub-8854680295966508/1373673215';

const TEST_INTERSTITIAL =
  'ca-app-pub-8854680295966508/7552813613';

/*
PRODUCCIÓN - NO USADOS DURANTE LAS PRUEBAS

APP:
ca-app-pub-8854680295966508~9040410248

BANNER:
ca-app-pub-8854680295966508/1373673215

INTERSTICIAL:
ca-app-pub-8854680295966508/7552813613
*/

const valueEl = document.getElementById('value');
const needleEl = document.getElementById('needle');
const statusEl = document.getElementById('status');
const modeEl = document.getElementById('mode');
const soundBtn = document.getElementById('sound');
const calibrateBtn = document.getElementById('calibrate');
const privacyBtn = document.getElementById('privacy');

let rawMagnitude = 0;
let smoothedMagnitude = null;

let basicBaseline = null;
let calibratedBaseline = null;

let calibrated = false;
let calibrating = false;

let calibrationSamples = [];

let soundEnabled = true;
let audioContext = null;
let lastBeep = 0;

let adsReady = false;
let interstitialReady = false;

function currentBaseline() {
  if (calibrated && calibratedBaseline !== null)
    return calibratedBaseline;

  if (basicBaseline !== null)
    return basicBaseline;

  return rawMagnitude || 50;
}

function updateDisplay() {

  if (smoothedMagnitude === null) return;

  const baseline = currentBaseline();

  const difference =
    Math.abs(smoothedMagnitude - baseline);

  const strength =
    Math.min(1, difference / 70);

  valueEl.textContent =
    smoothedMagnitude.toFixed(1);

  const angle =
    -80 + strength * 160;

  needleEl.style.transform =
    `rotate(${angle}deg)`;

  if (strength < 0.25) {

    statusEl.textContent = 'NORMAL';
    statusEl.style.color = '#4ddd91';

  } else if (strength < 0.60) {

    statusEl.textContent = 'SEÑAL MEDIA';
    statusEl.style.color = '#f1c84b';

  } else {

    statusEl.textContent = 'SEÑAL FUERTE';
    statusEl.style.color = '#ef6464';

  }

  if (
    soundEnabled &&
    !calibrating &&
    strength > 0.20
  ) {
    detectorBeep(strength);
  }
}

function detectorBeep(strength) {

  const now = performance.now();

  const interval =
    750 - (strength * 600);

  if (now - lastBeep < interval)
    return;

  lastBeep = now;

  try {

    audioContext ||= new (
      window.AudioContext ||
      window.webkitAudioContext
    )();

    const oscillator =
      audioContext.createOscillator();

    const gain =
      audioContext.createGain();

    oscillator.type = 'sine';

    oscillator.frequency.value =
      480 + (strength * 720);

    gain.gain.value =
      0.025 + (strength * 0.11);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();

    oscillator.stop(
      audioContext.currentTime + 0.07
    );

  } catch {}
}

soundBtn.addEventListener(
  'click',
  async () => {

    soundEnabled = !soundEnabled;

    soundBtn.textContent =
      soundEnabled
      ? '🔊 SONIDO ACTIVADO'
      : '🔇 SONIDO DESACTIVADO';

    if (soundEnabled) {

      try {

        audioContext ||= new (
          window.AudioContext ||
          window.webkitAudioContext
        )();

        await audioContext.resume();

      } catch {}
    }
  }
);

async function performCalibration() {

  if (calibrating) return;

  calibrating = true;
  calibrationSamples = [];

  modeEl.textContent = 'CALIBRANDO';
  statusEl.textContent = 'MANTÉN EL TELÉFONO QUIETO';

  calibrateBtn.disabled = true;
  calibrateBtn.textContent = 'CALIBRANDO…';

  await new Promise(
    resolve => setTimeout(resolve, 2500)
  );

  if (calibrationSamples.length >= 10) {

    calibratedBaseline =
      calibrationSamples.reduce(
        (sum, value) => sum + value,
        0
      ) / calibrationSamples.length;

    calibrated = true;

    modeEl.textContent = 'CALIBRADO';

    statusEl.textContent = 'NORMAL';
    statusEl.style.color = '#4ddd91';

    calibrateBtn.textContent =
      'RECALIBRAR DETECTOR';

  } else {

    modeEl.textContent = 'MODO BÁSICO';

    statusEl.textContent =
      'NO SE PUDO CALIBRAR';

    calibrateBtn.textContent =
      'CALIBRAR DETECTOR';
  }

  calibrateBtn.disabled = false;
  calibrating = false;
}

async function prepareInterstitial() {

  if (!adsReady) return;

  try {

    await AdMob.prepareInterstitial({
      adId: TEST_INTERSTITIAL
    });

    interstitialReady = true;

  } catch {

    interstitialReady = false;
  }
}

calibrateBtn.addEventListener(
  'click',
  async () => {

    if (interstitialReady) {

      try {

        await AdMob.showInterstitial({
          adId: TEST_INTERSTITIAL
        });

      } catch {}

      interstitialReady = false;

      await prepareInterstitial();
    }

    await performCalibration();
  }
);

privacyBtn.addEventListener(
  'click',
  async () => {

    try {
      await AdMob.showPrivacyOptionsForm();
    } catch {}
  }
);

async function startAds() {

  if (!Capacitor.isNativePlatform())
    return;

  try {

    let consent =
      await AdMob.requestConsentInfo();

    if (
      consent.isConsentFormAvailable &&
      consent.status ===
        AdmobConsentStatus.REQUIRED
    ) {

      consent =
        await AdMob.showConsentForm();
    }

    if (
      consent.privacyOptionsRequirementStatus ===
      'REQUIRED'
    ) {
      privacyBtn.classList.remove('hidden');
    }

    if (!consent.canRequestAds)
      return;

    await AdMob.initialize();

    adsReady = true;

    await AdMob.showBanner({
      adId: TEST_BANNER,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0
    });

    await prepareInterstitial();

  } catch (error) {

    console.log(
      'Ads unavailable:',
      error
    );
  }
}

async function startSensor() {

  if (!Capacitor.isNativePlatform()) {

    statusEl.textContent =
      'SENSOR DISPONIBLE EN ANDROID';

    return;
  }

  try {

    const availability =
      await MagneticSensor.isAvailable();

    if (!availability.available)
      throw new Error('NO_SENSOR');

    await MagneticSensor.addListener(
      'magneticField',
      data => {

        rawMagnitude =
          Math.sqrt(
            data.x * data.x +
            data.y * data.y +
            data.z * data.z
          );

        if (smoothedMagnitude === null) {

          smoothedMagnitude =
            rawMagnitude;

          basicBaseline =
            rawMagnitude;

        } else {

          smoothedMagnitude =
            smoothedMagnitude * 0.78 +
            rawMagnitude * 0.22;

          /*
          En modo básico el fondo se adapta
          lentamente al campo ambiental.
          */

          if (!calibrated && !calibrating) {

            basicBaseline =
              basicBaseline * 0.995 +
              smoothedMagnitude * 0.005;
          }
        }

        if (calibrating) {

          calibrationSamples.push(
            rawMagnitude
          );
        }

        updateDisplay();
      }
    );

    await MagneticSensor.start();

  } catch {

    valueEl.textContent = '--';

    statusEl.textContent =
      'SENSOR MAGNÉTICO NO DISPONIBLE';

    statusEl.style.color = '#ef6464';

    calibrateBtn.disabled = true;
  }
}

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    await startSensor();

    /*
    La publicidad se inicia después
    de que la interfaz nativa esté lista.
    */

    setTimeout(
      startAds,
      500
    );
  }
);
