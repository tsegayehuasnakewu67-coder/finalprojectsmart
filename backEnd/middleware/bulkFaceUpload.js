const multer = require('multer');

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_REQUEST_SIZE = 100 * 1024 * 1024;
const MAX_ROWS = 1000;

const storage = {
  _handleFile(req, file, callback) {
    let size = 0;
    let completed = false;
    const chunks = [];

    const finish = (error, result) => {
      if (completed) return;
      completed = true;
      callback(error, result);
    };

    file.stream.on('data', (chunk) => {
      size += chunk.length;
      req.uploadedBytes = (req.uploadedBytes || 0) + chunk.length;
      if (req.uploadedBytes > MAX_REQUEST_SIZE) {
        const error = new Error('Combined upload size must not exceed 100 MB.');
        error.code = 'LIMIT_TOTAL_SIZE';
        error.status = 413;
        file.stream.destroy(error);
        finish(error);
        return;
      }
      chunks.push(chunk);
    });

    file.stream.once('error', (error) => finish(error));
    file.stream.once('end', () => {
      finish(null, { buffer: Buffer.concat(chunks), size });
    });
  },

  _removeFile(_req, file, callback) {
    delete file.buffer;
    callback(null);
  },
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_ROWS + 1 },
  fileFilter(_req, file, callback) {
    const extension = file.originalname.toLowerCase().split('.').pop();
    const isCsv = file.fieldname === 'csv'
      && extension === 'csv'
      && ['text/csv', 'application/vnd.ms-excel', 'application/csv'].includes(file.mimetype);
    const isPhoto = file.fieldname === 'photos'
      && ['jpg', 'jpeg', 'png'].includes(extension)
      && ['image/jpeg', 'image/png'].includes(file.mimetype);

    if (!isCsv && !isPhoto) {
      const error = new Error('Upload one CSV file and JPG/PNG photos only.');
      error.status = 400;
      error.code = 'INVALID_UPLOAD_TYPE';
      return callback(error);
    }
    return callback(null, true);
  },
}).fields([
  { name: 'csv', maxCount: 1 },
  { name: 'photos', maxCount: MAX_ROWS },
]);

const parseBulkFaceUpload = (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) return next();
    if (!error.status) error.status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    next(error);
  });
};

module.exports = { parseBulkFaceUpload, MAX_ROWS };
