const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true, trim: true, uppercase: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true, sparse: true },
  phone: { type: String, trim: true, default: '' },
  department: { type: String, required: true, trim: true, index: true },
  position: { type: String, required: true, trim: true },
  gender: { type: String, trim: true, default: '' },
  dateOfBirth: { type: Date, default: null },
  address: { type: String, trim: true, default: '' },
  photo: { type: String, default: '' },
  faceEncoding: {
    type: [Number],
    select: false,
    default: [],
    validate: {
      validator: (encoding) => encoding.length === 0 || encoding.length === 128,
      message: 'Face encoding must contain 128 numbers.',
    },
  },
  status: { type: String, enum: ['Active', 'Inactive', 'On Leave'], default: 'Active', index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
}, { timestamps: true });

employeeSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

employeeSchema.index({ firstName: 1, lastName: 1 });
employeeSchema.index({ department: 1, status: 1 });
employeeSchema.set('toJSON', {
  virtuals: true,
  transform: (_document, value) => {
    delete value.faceEncoding;
    return value;
  },
});
employeeSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Employee', employeeSchema);
