/**
 * ENTITIES: Mentor, Slot, Session
 * ---------------------------------------------------------------
 * A mentor publishes concrete slots rather than vague availability,
 * because "message me and we'll find a time" is where most campus
 * mentorship schemes quietly die. A slot is either open or taken.
 */

function newSlot({ startsAt, durationMins = 30 }) {
  return {
    id: 'slot_' + Math.random().toString(36).slice(2, 10),
    startsAt,
    durationMins,
    bookedBy: null, // FK -> User.id once taken
  };
}

function newMentor({
  name, title, org, expertise = [], bio = '',
  languages = ['English'], avatar = '🌱', rating = 4.8, ratingCount = 12,
  slots = [],
}) {
  return {
    id: 'mn_' + Math.random().toString(36).slice(2, 10),
    name, title, org, expertise, bio, languages, avatar,
    rating, ratingCount,
    slots,
    createdAt: new Date().toISOString(),
  };
}

/**
 * A booked conversation. `joinUrl` is the single field every consumer
 * reads for the video link, so the provider can be swapped (Jitsi ->
 * Meet -> Zoom) by changing one function and nothing else.
 */
function newSession({ mentorId, mentorName, studentId, studentName, startsAt, durationMins, topic = '', question = '' }) {
  return {
    id: 'ses_' + Math.random().toString(36).slice(2, 10),
    mentorId, mentorName, studentId, studentName,
    startsAt, durationMins,
    topic, question,
    status: 'confirmed', // confirmed | completed | cancelled | missed
    joinUrl: null,
    notes: '',
    actionItems: [],
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
}

module.exports = { newMentor, newSlot, newSession };
