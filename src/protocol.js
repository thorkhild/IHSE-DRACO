const MODES = {
  FULL: 0x0000,
  VIDEO_ONLY: 0x0001,
  PRIVATE: 0x0002,
  USB_HID_CONTROL: 0x0003,
}

function buildTelegram(cmd, payload = Buffer.alloc(0)) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload)
  const size = 5 + data.length
  const packet = Buffer.alloc(size)
  packet[0] = 0x1b
  packet[1] = 0x5b
  packet[2] = cmd.charCodeAt(0)
  packet.writeUInt16LE(size, 3)
  data.copy(packet, 5)
  return packet
}

function buildGetCpuListLegacy() {
  return Buffer.from([0x1b, 0x5b, 0x67, 0x07, 0x00, 0x00, 0x00])
}

function buildGetConListLegacy() {
  return Buffer.from([0x1b, 0x5b, 0x68, 0x07, 0x00, 0x00, 0x00])
}

function buildGetCpuListGeneric() {
  return buildTelegram('g')
}

function buildGetConListGeneric() {
  return buildTelegram('h')
}

function buildRoute(cpu, con, mode) {
  const payload = Buffer.alloc(6)
  payload.writeUInt16LE(cpu, 0)
  payload.writeUInt16LE(con, 2)
  payload.writeUInt16LE(mode, 4)
  return buildTelegram('b', payload)
}

// Experimental. Disabled by default in connection settings.
function buildGetConsole(conId) {
  const payload = Buffer.alloc(2)
  payload.writeUInt16LE(conId, 0)
  return buildTelegram('c', payload)
}

function parseDiscoveryPacket(packet) {
  const devices = []
  if (!Buffer.isBuffer(packet) || packet.length < 9) return devices

  const declaredLength = packet.readUInt16LE(3)
  const usableLength = Math.min(packet.length, declaredLength)
  const recordStart = 9
  const recordLength = 24

  for (let offset = recordStart; offset + recordLength <= usableLength; offset += recordLength) {
    const id = packet.readUInt16LE(offset)
    const name = packet
      .subarray(offset + 4, offset + 21)
      .toString('ascii')
      .replace(/\0/g, '')
      .trim()

    if (id > 0) devices.push({ id, name: name || `ID ${id}` })
  }

  return devices
}

module.exports = {
  MODES,
  buildTelegram,
  buildGetCpuListLegacy,
  buildGetConListLegacy,
  buildGetCpuListGeneric,
  buildGetConListGeneric,
  buildGetConsole,
  buildRoute,
  parseDiscoveryPacket,
}
