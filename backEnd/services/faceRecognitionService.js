const Employee = require('../models/Employee');
const User = require('../models/User');
const { findBestMatch } = require('../utils/faceMatcher');

const CACHE_TTL_MS = 5 * 60 * 1000;
let candidateCache = null;
let cacheExpiresAt = 0;
let refreshInProgress = null;

const loadCandidates = async () => {
  const [accounts, unlinkedProfiles] = await Promise.all([
    User.find({ isActive: true, 'faceDescriptor.0': { $exists: true } })
      .select('fullName employeeId department position faceDescriptor employeeRef avatar')
      .lean(),
    Employee.find({ status: 'Active', user: null, 'faceEncoding.0': { $exists: true } })
      .select('firstName lastName employeeId department position photo +faceEncoding')
      .lean(),
  ]);

  return [
    ...accounts,
    ...unlinkedProfiles.map((profile) => ({
      _id: null,
      employeeRef: profile._id,
      fullName: `${profile.firstName} ${profile.lastName}`.trim(),
      employeeId: profile.employeeId,
      department: profile.department,
      position: profile.position,
      avatar: profile.photo,
      faceDescriptor: profile.faceEncoding,
    })),
  ];
};

const getFaceCandidates = async () => {
  if (candidateCache && Date.now() < cacheExpiresAt) return candidateCache;
  if (!refreshInProgress) {
    refreshInProgress = loadCandidates()
      .then((candidates) => {
        candidateCache = candidates;
        cacheExpiresAt = Date.now() + CACHE_TTL_MS;
        return candidates;
      })
      .finally(() => {
        refreshInProgress = null;
      });
  }
  return refreshInProgress;
};

const invalidateFaceCandidates = () => {
  candidateCache = null;
  cacheExpiresAt = 0;
};

const recognizeFace = async (descriptor) => {
  const candidates = await getFaceCandidates();
  if (!candidates.length) return { matched: false, employee: null, distance: Infinity, hasCandidates: false };
  return { ...findBestMatch(descriptor, candidates), hasCandidates: true };
};

module.exports = { getFaceCandidates, recognizeFace, invalidateFaceCandidates };
