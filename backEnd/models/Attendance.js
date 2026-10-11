const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  employee:   { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  employeeId: { type: String, required: true, uppercase: true },
  fullName:   { type: String, default: '' },
  department: { type: String, default: '' },
  position:   { type: String, default: '' },
  // YYYY-MM-DD string — used for daily uniqueness check
  date:       { type: String, required: true },
  timestamp:  { type: Date, default: Date.now, index: true },
  lastScanAt: { type: Date, default: null },

  // ── Morning session ─────────────────────────────────────────────────────────
  checkInTime:  { type: Date, default: Date.now },
  checkOutTime: { type: Date, default: null },
  checkIn:      { type: Date, default: null },
  checkOut:     { type: Date, default: null },

  // ── After-lunch session ──────────────────────────────────────────────────────
  afterLunchCheckIn:  { type: Date, default: null },  // check-in after lunch break
  afterLunchCheckOut: { type: Date, default: null },  // final end-of-day check-out

  status: {
    type: String, enum: ['Present', 'Late', 'Absent', 'Leave'], default: 'Present',
  },
  matchConfidence: { type: Number, default: null },
  confidence: { type: Number, min: 0, max: 1, default: null },
  livenessScore: { type: Number, min: 0, max: 1, default: null },
  ipAddress: { type: String, default: '' },
  deviceInfo: { type: String, maxlength: 300, default: '' },
  recognitionMethod: {
    type: String, enum: ['Face Recognition', 'Manual'], default: 'Manual',
  },
  notes: { type: String, trim: true, default: '' },
  lateMinutes:     { type: Number, default: 0 },   // 0 = on-time, >0 = minutes late
}, { timestamps: true });

// One record per employee per day
attendanceSchema.index(
  { userId: 1, date: 1 },
  {
    name: 'unique_user_date',
    unique: true,
    partialFilterExpression: { userId: { $type: 'objectId' } },
  },
);
attendanceSchema.index({ userId: 1, timestamp: -1 });
attendanceSchema.index(
  { employee: 1, date: 1 },
  { unique: true, partialFilterExpression: { employee: { $type: 'objectId' } } },
);
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ date: 1, status: 1 });
attendanceSchema.index({ department: 1 });
attendanceSchema.index({ employeeId: 1 });

attendanceSchema.pre('validate', function () {
  if (this.checkIn) this.checkInTime = this.checkIn;
  else if (this.checkInTime && ['Present', 'Late'].includes(this.status)) this.checkIn = this.checkInTime;
  else {
    this.checkIn = null;
    this.checkInTime = null;
  }

  if (this.checkOut) this.checkOutTime = this.checkOut;
  else if (this.checkOutTime) this.checkOut = this.checkOutTime;
});

module.exports = mongoose.model('Attendance', attendanceSchema);
