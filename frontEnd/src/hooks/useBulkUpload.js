import { useCallback, useRef, useState } from 'react';
import api from '../services/api';
import { getDescriptorFromImage, loadModels } from '../utils/faceApi';

const REQUEST_DELAY_MS = 500;
const MAX_ATTEMPTS = 3;

const wait = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(new DOMException('Upload cancelled.', 'AbortError'));
    return;
  }
  const timer = window.setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => {
    window.clearTimeout(timer);
    reject(new DOMException('Upload cancelled.', 'AbortError'));
  }, { once: true });
});

const getErrorCode = (error) => error.response?.data?.code;

const formatError = (error) => error.response?.data?.message || error.message || 'Registration failed.';

export default function useBulkUpload() {
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState({ processed: 0, total: 0, current: '' });
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const abortRef = useRef(null);
  const runningRef = useRef(false);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    if (runningRef.current) return;
    setResults([]);
    setProgress({ processed: 0, total: 0, current: '' });
    setComplete(false);
  }, []);

  const run = useCallback(async (allRows) => {
    if (runningRef.current) return;
    runningRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;
    const validRows = allRows.filter((row) => row.valid);
    const nextResults = allRows.map((row) => ({
      rowNumber: row.rowNumber,
      fileName: row.photoFileName,
      name: row.name,
      status: row.valid ? 'Queued' : 'Failed',
      error: row.errors.join(' '),
      timestamp: new Date().toISOString(),
    }));
    setResults(nextResults);
    setProgress({ processed: 0, total: validRows.length, current: '' });
    setComplete(false);
    setRunning(true);

    try {
      await loadModels();
      let processed = 0;
      for (let index = 0; index < allRows.length; index += 1) {
        const row = allRows[index];
        if (!row.valid) continue;
        if (signal.aborted) break;

        const resultIndex = index;
        const updateResult = (patch) => {
          nextResults[resultIndex] = { ...nextResults[resultIndex], ...patch, timestamp: new Date().toISOString() };
          setResults([...nextResults]);
        };
        setProgress({ processed, total: validRows.length, current: row.name });
        updateResult({ status: 'Processing', error: '' });

        try {
          const faceDescriptor = await getDescriptorFromImage(row.photo);
          if (!faceDescriptor) {
            updateResult({ status: 'Failed', error: 'Photo must contain exactly one clearly visible face.' });
          } else {
            let response;
            let lastRequestAt = 0;
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
              if (signal.aborted) throw new DOMException('Upload cancelled.', 'AbortError');
              const waitMs = Math.max(0, REQUEST_DELAY_MS - (Date.now() - lastRequestAt));
              if (waitMs) await wait(waitMs, signal);
              lastRequestAt = Date.now();
              try {
                response = await api.post('/face/bulk-register', {
                  employeeId: row.employeeId,
                  name: row.name,
                  firstName: row.firstName,
                  lastName: row.lastName,
                  department: row.department,
                  position: row.position,
                  email: row.email,
                  phone: row.phone,
                  photoFileName: row.photoFileName,
                  faceDescriptor,
                }, { signal, timeout: 30000 });
                break;
              } catch (error) {
                if (getErrorCode(error) === 'DUPLICATE_FACE') {
                  updateResult({ status: 'Skipped', error: formatError(error) });
                  break;
                }
                if (getErrorCode(error) === 'DUPLICATE_EMPLOYEE') {
                  updateResult({ status: 'Skipped', error: formatError(error) });
                  break;
                }
                const retryable = !error.response || error.response.status >= 500 || error.response.status === 429;
                if (!retryable || attempt === MAX_ATTEMPTS || signal.aborted) {
                  throw error;
                }
              }
            }
            if (response) {
              updateResult({ status: 'Success', error: '' });
            } else if (nextResults[resultIndex].status === 'Processing') {
              updateResult({ status: 'Failed', error: 'No response was received from the registration API.' });
            }
          }
        } catch (error) {
          if (error.name === 'AbortError' || signal.aborted) {
            updateResult({
              status: 'Cancelled',
              error: 'Stopped by administrator. The server may have completed a request already in progress.',
            });
            break;
          }
          updateResult({ status: 'Failed', error: formatError(error) });
        }

        processed += 1;
        setProgress({ processed, total: validRows.length, current: row.name });
      }

      if (signal.aborted) {
        nextResults.forEach((result) => {
          if (result.status === 'Queued') {
            result.status = 'Cancelled';
            result.error = 'Not sent because the batch was cancelled.';
            result.timestamp = new Date().toISOString();
          }
        });
        setResults([...nextResults]);
      }
      setComplete(true);
    } catch (error) {
      if (error.name !== 'AbortError') {
        setResults((current) => current.map((result) => (
          result.status === 'Queued'
            ? { ...result, status: 'Failed', error: formatError(error), timestamp: new Date().toISOString() }
            : result
        )));
        setComplete(true);
      }
    } finally {
      abortRef.current = null;
      runningRef.current = false;
      setRunning(false);
    }
  }, []);

  return { results, progress, running, complete, run, cancel, reset };
}
