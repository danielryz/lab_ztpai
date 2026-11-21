function toBuildingResponse(building) {
  return {
    id: building.id,
    name: building.name,
    address: building.address,
    roomsCount: building.roomsCount,
    createdAt: building.createdAt ? new Date(building.createdAt).toISOString() : null
  };
}

module.exports = { toBuildingResponse };
