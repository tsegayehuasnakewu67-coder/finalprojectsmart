const User = require('../models/User');
const Employee = require('../models/Employee');
const { findBestMatch } = require('./faceMatcher');

const findDuplicateFace = async (
  faceDescriptor,
  { excludeUserId, excludeEmployeeId, excludeEmployeeCode } = {},
) => {
  const userQuery = { 'faceDescriptor.0': { $exists: true } };
  const employeeQuery = { 'faceEncoding.0': { $exists: true } };
  if (excludeUserId) {
    userQuery._id = { $ne: excludeUserId };
    employeeQuery.user = { $ne: excludeUserId };
  }
  if (excludeEmployeeId) employeeQuery._id = { $ne: excludeEmployeeId };
  if (excludeEmployeeCode) employeeQuery.employeeId = { $ne: String(excludeEmployeeCode).toUpperCase() };

  const [users, employeeProfiles] = await Promise.all([
    User.find(userQuery).select('fullName employeeId faceDescriptor').lean(),
    Employee.find(employeeQuery).select('+faceEncoding firstName lastName employeeId').lean(),
  ]);
  const candidates = [
    ...users,
    ...employeeProfiles.map((profile) => ({
      fullName: `${profile.firstName} ${profile.lastName}`.trim(),
      employeeId: profile.employeeId,
      faceDescriptor: profile.faceEncoding,
    })),
  ];
  const { matched, employee } = findBestMatch(faceDescriptor, candidates, 0.5);
  return matched ? employee : null;
};

module.exports = { findDuplicateFace };
