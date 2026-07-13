/** GPS track generator shared by the /location/track endpoints. */
const { store, iso, todayStr } = require("./data");

function trackFor(userId, dateStr) {
  const base = store.repGeo[userId] ?? { lat: 17.4, lng: 78.45 };
  const points = Array.from({ length: 8 }, (_, i) => ({
    t: iso(new Date(Date.now() - (8 - i) * 900000)),
    lat: base.lat + i * 0.002,
    lng: base.lng + i * 0.0015,
    acc: 10,
  }));
  return {
    user_id: userId,
    date: dateStr ?? todayStr(),
    session_count: 1,
    total_meters: 5200,
    tracks: [
      {
        session_id: `sess-track-${userId}`,
        started_at: points[0].t,
        ended_at: null,
        meters: 5200,
        date: dateStr ?? todayStr(),
        points,
      },
    ],
  };
}

module.exports = { trackFor };
