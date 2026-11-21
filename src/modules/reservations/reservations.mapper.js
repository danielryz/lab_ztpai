function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function toReservationResponse(reservation) {
  const { room } = reservation;
  return {
    id: reservation.id,
    room: {
      id: room.id,
      name: room.name,
      building: room.building ? { id: room.building.id, name: room.building.name } : null
    },
    user: { id: reservation.user.id, email: reservation.user.email },
    participants: reservation.participants,
    startTime: toIso(reservation.startTime),
    endTime: toIso(reservation.endTime),
    status: reservation.status,
    createdAt: toIso(reservation.createdAt),
    cancelledAt: toIso(reservation.cancelledAt)
  };
}

module.exports = { toReservationResponse };
