import { useCallback, useEffect, useRef, useState } from 'react';
import { getFaceObservationDetails } from '../utils/faceApi';

const SCAN_INTERVAL_MS = 200;
const CHALLENGE_LIFETIME_MS = 60_000;
const DUPLICATE_SCAN_COOLDOWN_MS = 30_000;

const createLivenessState = () => ({
  startedAt: Date.now(),
  observedFrames: 0,
  closedEyes: false,
  baselineSamples: [],
  baselineTurn: null,
  turnFrames: 0,
});

const hasCompletedChallenge = (action, observation, state) => {
  if (action === 'blink') {
    if (observation.eyeAspectRatio < 0.2) state.closedEyes = true;
    return state.closedEyes && observation.eyeAspectRatio > 0.24;
  }

  if (state.baselineTurn === null) {
    state.baselineSamples.push(observation.headTurnOffset);
    if (state.baselineSamples.length >= 4) {
      state.baselineTurn = state.baselineSamples.reduce((sum, sample) => sum + sample, 0)
        / state.baselineSamples.length;
    }
    return false;
  }

  if (Math.abs(observation.headTurnOffset - state.baselineTurn) >= 0.12) {
    state.turnFrames += 1;
    return state.turnFrames >= 2;
  }
  state.turnFrames = 0;
  return false;
};

export default function useFaceScan() {
  const [faceStatus, setFaceStatus] = useState('Position one face inside the frame.');
  const timerRef = useRef(null);
  const sessionRef = useRef(0);
  const cooldownUntilRef = useRef(0);

  const stopScan = useCallback(() => {
    sessionRef.current += 1;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const startScan = useCallback((videoElement, challenge, { onComplete, onError }) => {
    stopScan();
    const remainingCooldown = cooldownUntilRef.current - Date.now();
    if (remainingCooldown > 0) {
      onError(`Please wait ${Math.ceil(remainingCooldown / 1000)} seconds before scanning again.`);
      return;
    }

    const sessionId = sessionRef.current;
    const livenessState = createLivenessState();
    setFaceStatus('Position one face inside the frame.');

    const scanFrame = async () => {
      if (sessionRef.current !== sessionId) return;
      if (Date.now() - livenessState.startedAt >= CHALLENGE_LIFETIME_MS) {
        stopScan();
        setFaceStatus('Verification challenge expired. Please start again.');
        onError('Camera verification expired. Please choose an attendance action again.', 'expired');
        return;
      }

      try {
        const { faceCount, observation } = await getFaceObservationDetails(videoElement);
        if (sessionRef.current !== sessionId) return;
        if (faceCount === 0) {
          setFaceStatus('No face detected. Move into the camera frame.');
        } else if (faceCount > 1) {
          setFaceStatus('Multiple faces detected. Ensure only one person is in view.');
        } else if (!observation) {
          setFaceStatus('Hold still and face the camera.');
        } else {
          setFaceStatus(challenge.action === 'blink'
            ? 'Blink your eyes, then look at the camera.'
            : 'Turn your head slowly to one side.');
          livenessState.observedFrames += 1;
          const challengeCompleted = hasCompletedChallenge(
            challenge.action,
            observation,
            livenessState,
          );
          if (livenessState.observedFrames >= 3 && challengeCompleted) {
            stopScan();
            setFaceStatus('Liveness verified. Recording attendance…');
            const completed = await onComplete(observation.descriptor, {
              challengeId: challenge.challengeId,
              action: challenge.action,
              durationMs: Date.now() - livenessState.startedAt,
              observedFrames: livenessState.observedFrames,
            });
            if (completed) cooldownUntilRef.current = Date.now() + DUPLICATE_SCAN_COOLDOWN_MS;
            return;
          }
        }
      } catch (error) {
        console.error('Face observation failed:', error);
        setFaceStatus('Camera detection failed temporarily. Retrying…');
      }

      if (sessionRef.current === sessionId) {
        timerRef.current = setTimeout(scanFrame, SCAN_INTERVAL_MS);
      }
    };

    timerRef.current = setTimeout(scanFrame, 0);
  }, [stopScan]);

  useEffect(() => stopScan, [stopScan]);

  return { faceStatus, startScan, stopScan };
}
