/**
 * Generate face embedding from an image file using MobileFaceNet TFLite model.
 * Uses the same pipeline as the Android app: face crop → 112x112 → normalize [-1,1] → embed.
 */

const INPUT_SIZE = 112;
const FACE_CROP_MARGIN = 0.2;
/** Max dimension for face detection (large images are downscaled for speed). */
const MAX_DETECTION_SIZE = 512;
/** Timeout for face detection; fall back to center crop if exceeded. */
const DETECTION_TIMEOUT_MS = 12000;

let tfliteModel = null;
let faceDetectionLoaded = false;

const FACE_API_WEIGHTS = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

async function loadFaceDetection() {
    if (faceDetectionLoaded && window.faceapi) return;
    if (!window.faceapi) throw new Error('face-api.js not loaded. Check script tag.');
    await window.faceapi.nets.tinyFaceDetector.loadFromUri(FACE_API_WEIGHTS);
    faceDetectionLoaded = true;
}

async function loadModel() {
    if (tfliteModel) return tfliteModel;
    const modelUrl = new URL('models/MobileFaceNet.tflite', window.location.href).href;
    const tfliteLib = window.tflite;
    if (!tfliteLib) throw new Error('TensorFlow Lite not loaded. Ensure tfjs-tflite script is included.');
    tfliteModel = await tfliteLib.loadTFLiteModel(modelUrl);
    return tfliteModel;
}

/**
 * Preload face detection and TFLite models in the background (e.g. when modal opens).
 * Call this when the user opens Add/Edit Employee so Save is fast.
 */
export function preloadFaceEmbeddingModels() {
    if ((tfliteModel && faceDetectionLoaded) || !window.tf || !window.tflite) return;
    window.tf.ready().then(() => {
        loadFaceDetection().catch(() => {});
        loadModel().catch(() => {});
    });
}

/**
 * Resize image to max side MAX_DETECTION_SIZE for fast face detection; returns canvas and scale to original.
 */
function resizeForDetection(img) {
    const w = img.width;
    const h = img.height;
    if (w <= MAX_DETECTION_SIZE && h <= MAX_DETECTION_SIZE) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d').drawImage(img, 0, 0);
        return { canvas: c, scaleX: 1, scaleY: 1 };
    }
    const scale = Math.min(MAX_DETECTION_SIZE / w, MAX_DETECTION_SIZE / h);
    const sw = Math.round(w * scale);
    const sh = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h, 0, 0, sw, sh);
    return { canvas, scaleX: w / sw, scaleY: h / sh };
}

function runFaceDetection(input) {
    return window.faceapi.detectAllFaces(input, new window.faceapi.TinyFaceDetectorOptions({
        inputSize: 224,
        scoreThreshold: 0.3
    }));
}

/**
 * Load image file, detect face on a downscaled copy for speed, crop from original, resize to 112x112.
 * If detection hangs or finds no face, falls back to center crop so upload still succeeds.
 */
async function prepareImage(imageFile, onProgress) {
    const img = await new Promise((resolve, reject) => {
        const image = new Image();
        const blobUrl = URL.createObjectURL(imageFile);
        image.onload = () => {
            URL.revokeObjectURL(blobUrl);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            reject(new Error('Failed to load image'));
        };
        image.src = blobUrl;
    });

    if (onProgress) onProgress('Detecting face...');
    await loadFaceDetection();

    const { canvas: detectCanvas, scaleX, scaleY } = resizeForDetection(img);
    let detections = [];
    let useScaleX = scaleX;
    let useScaleY = scaleY;

    try {
    detections = await Promise.race([
        runFaceDetection(detectCanvas),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), DETECTION_TIMEOUT_MS)
        )
    ]);

    if (!Array.isArray(detections)) detections = [];

    if (detections.length === 0 && detectCanvas.width !== img.width) {
        try {
            const fullImgDetections = await Promise.race([
                runFaceDetection(img),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('timeout')), 8000)
                )
            ]);

            if (Array.isArray(fullImgDetections) && fullImgDetections.length > 0) {
                detections = fullImgDetections;
                useScaleX = 1;
                useScaleY = 1;
            }
        } catch (_) {
            // ignore errors for full image detection
        }
    }
} catch (e) {
    if (e && e.message === 'timeout') {
        console.warn('Face detection timed out. Using center crop.');
    } else {
        console.warn('Face detection failed:', e);
    }
}


    let sx, sy, srcW, srcH;
    if (detections.length > 0) {
        const det = detections.reduce((best, d) => {
            const area = d.box.width * d.box.height;
            return !best || area > best.box.width * best.box.height ? d : best;
        });
        const b = det.box;
        const left = Math.max(0, (b.x - b.width * FACE_CROP_MARGIN) * useScaleX);
        const top = Math.max(0, (b.y - b.height * FACE_CROP_MARGIN) * useScaleY);
        const right = Math.min(img.width, (b.x + b.width * (1 + FACE_CROP_MARGIN)) * useScaleX);
        const bottom = Math.min(img.height, (b.y + b.height * (1 + FACE_CROP_MARGIN)) * useScaleY);
        let w = right - left;
        let h = bottom - top;
        if (w > h) {
            bottom = Math.min(top + w, img.height);
        } else {
            right = Math.min(left + h, img.width);
        }
        sx = left;
        sy = top;
        srcW = right - left;
        srcH = bottom - top;
    } else {
        console.warn('No face detected. Using center crop.');
        srcW = srcH = Math.min(img.width, img.height);
        sx = (img.width - srcW) / 2;
        sy = (img.height - srcH) / 2;
    }

    const canvas = document.createElement('canvas');
    canvas.width = INPUT_SIZE;
    canvas.height = INPUT_SIZE;
    canvas.getContext('2d').drawImage(img, sx, sy, srcW, srcH, 0, 0, INPUT_SIZE, INPUT_SIZE);
    return canvas;
}

/**
 * Generate face embedding from an image file (dimension must match TFLite model output, e.g. 192).
 * @param {File} imageFile - JPEG or PNG (clear front-facing face)
 * @param {function(string)=} onProgress - Optional callback for status messages
 * @returns {Promise<number[]>} Array of embedding floats (e.g. 192)
 */
export async function generateFaceEmbedding(imageFile, onProgress) {
    const tfLib = window.tf;
    if (!tfLib) throw new Error('TensorFlow.js not loaded.');

    if (onProgress) onProgress('Loading models...');
    await tfLib.ready();
    await Promise.all([loadFaceDetection(), loadModel()]);

    const canvas = await prepareImage(imageFile, onProgress);

    if (onProgress) onProgress('Generating embedding...');
    const model = await loadModel();
    const imgTensor = tfLib.browser.fromPixels(canvas);
    const floatTensor = tfLib.cast(imgTensor, 'float32');
    const normalized = tfLib.sub(tfLib.div(floatTensor, 127.5), 1);
    const batched = tfLib.expandDims(normalized, 0);

    let output;
    try {
        output = model.predict(batched);
    } catch (e) {
        const batch2 = tfLib.concat([batched, batched], 0);
        output = model.predict(batch2);
        tfLib.dispose([batch2]);
    }
    const outputData = output.dataSync();
    const EMBEDDING_DIM = 192;
    const embedding = Array.from(outputData).slice(0, EMBEDDING_DIM);

    tfLib.dispose([imgTensor, floatTensor, normalized, batched, output]);
    return embedding;
}
