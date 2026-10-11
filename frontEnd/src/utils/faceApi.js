/**
 * face-api.js helpers
 *
 * Model weights must be in /public/models:
 *   tiny_face_detector_model
 *   face_landmark_68_model
 *   face_recognition_model
 *
 * Download from:
 *   https://github.com/justadudewhohacks/face-api.js/tree/master/weights
 */
import * as faceapi from 'face-api.js';

const MODEL_URL = '/models';
const DETECTOR_OPTIONS = { inputSize: 224, scoreThreshold: 0.18 };
let loaded = false;

const detectFaces = async (input) => {
  return faceapi
    .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions(DETECTOR_OPTIONS))
    .withFaceLandmarks()
    .withFaceDescriptors();
};

export const loadModels = async () => {
  if (loaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  loaded = true;
};

const pointDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const eyeAspectRatio = (eye) => {
  if (!Array.isArray(eye) || eye.length < 6) return null;
  const horizontal = pointDistance(eye[0], eye[3]);
  if (!horizontal) return null;
  return (pointDistance(eye[1], eye[5]) + pointDistance(eye[2], eye[4])) / (2 * horizontal);
};

/** Detects all faces and returns liveness observations only for a single face. */
export const getFaceObservationDetails = async (videoEl) => {
  if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth || !videoEl.videoHeight) {
    return { faceCount: 0, observation: null };
  }
  const detections = await detectFaces(videoEl);

  if (detections.length !== 1) return { faceCount: detections.length, observation: null };
  const detection = detections[0];
  const landmarks = detection.landmarks;
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const nose = landmarks.getNose();
  if (!leftEye?.length || !rightEye?.length || !nose?.length) {
    return { faceCount: 1, observation: null };
  }
  const leftRatio = eyeAspectRatio(leftEye);
  const rightRatio = eyeAspectRatio(rightEye);
  const leftCenter = leftEye.reduce((sum, point) => sum + point.x, 0) / leftEye.length;
  const rightCenter = rightEye.reduce((sum, point) => sum + point.x, 0) / rightEye.length;
  const eyeCenter = (leftCenter + rightCenter) / 2;
  const eyeSpan = Math.abs(rightCenter - leftCenter);
  const noseCenter = nose.slice(4).reduce((sum, point) => sum + point.x, 0) / Math.max(1, nose.length - 4);

  if (leftRatio == null || rightRatio == null || !eyeSpan) {
    return { faceCount: 1, observation: null };
  }
  return {
    faceCount: 1,
    observation: {
    descriptor: Array.from(detection.descriptor),
    eyeAspectRatio: (leftRatio + rightRatio) / 2,
    headTurnOffset: (noseCenter - eyeCenter) / eyeSpan,
    },
  };
};

/** Returns a descriptor and coarse landmark signals from one live camera frame. */
export const getFaceObservation = async (videoEl) => {
  const { observation } = await getFaceObservationDetails(videoEl);
  return observation;
};

export const getDescriptorFromImage = async (file) => {
  const imageUrl = URL.createObjectURL(file);
  const image = new Image();
  image.src = imageUrl;
  try {
    await image.decode();
    const detections = await detectFaces(image);
    return detections.length === 1 ? Array.from(detections[0].descriptor) : null;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};

/** Returns a 128-element plain Array or null if no single face is detected. */
export const getDescriptor = async (videoEl) => {
  const observation = await getFaceObservation(videoEl);
  return observation?.descriptor || null;
};

/** Draw face box + landmarks onto an overlay canvas */
export const drawDetections = async (videoEl, canvasEl) => {
  if (!canvasEl) return;
  const dets = await detectFaces(videoEl);
  const dims = faceapi.matchDimensions(canvasEl, videoEl, true);
  const resized = faceapi.resizeResults(dets, dims);
  const ctx = canvasEl.getContext('2d');
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  faceapi.draw.drawDetections(canvasEl, resized);
  faceapi.draw.drawFaceLandmarks(canvasEl, resized);
};

export { faceapi };
