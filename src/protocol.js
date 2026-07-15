const MODES = {
  FULL: 0x0000,
  VIDEO_ONLY: 0x0001,
  PRIVATE: 0x0002,
  USB_HID_CONTROL: 0x0003,
}

/**
 * Generic telegram builder:
 * ESC [ CMD LEN_LE PAYLOAD
 */
function buildTelegram(cmd, payload = Buffer.alloc(0)) {
  const payloadBuf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload)
  const size = 5 + payloadBuf.length

  const buf = Buffer.alloc(size)
  buf[0] = 0x1b // ESC
  buf[1] = 0x5b // [
  buf[2] = cmd.charCodeAt(0)
  buf.writeUInt16LE(size, 3)

  if (payloadBuf.length > 0) {
    payloadBuf.copy(buf, 5)
  }

  return buf
}

/**
 * Legacy Draco discovery telegrams:
 * ESC [ g 07 00 00 00
 * ESC [ h 07 00 00 00
 */
function buildGetCpuListLegacy() {
  return Buffer.from([0x1b, 0x5b, 0x67, 0x07, 0x00, 0x00, 0x00])
}

function buildGetConListLegacy() {
  return Buffer.from([0x1b, 0x5b, 0x68, 0x07, 0x00, 0x00, 0x00])
}

/**
 * Generic 5-byte variants.
 */
function buildGetCpuListGeneric() {
  return buildTelegram('g')
}

function buildGetConListGeneric() {
  return buildTelegram('h')
}

/**
 * Route CPU to CON.
 */
function buildRoute(cpu, con, mode) {
  const payload = Buffer.alloc(6)
  payload.writeUInt16LE(cpu, 0)
  payload.writeUInt16LE(con, 2)
  payload.writeUInt16LE(mode, 4)
  return buildTelegram('b', payload)
}

/**
 * Per-CON route/status query.
 * Expected to request current route state for a CON.
 */
function buildGetConsole(conId) {
  const payload = Buffer.alloc(2)
  payload.writeUInt16LE(conId, 0)
  return buildTelegram('c', payload)
}

/**
 * Optional bulk route/status query.
 */
function buildGetConsoleBulk() {
  return buildTelegram('d')
}

/**
 * Parse discovery packet into [{ id, name }]
 */
function parseDiscoveryPacket(packet) {
  const devices = []

  if (!packet || packet.length < 9) return devices

  const hex = packet.toString('hex')
  const totalHexLen = packet.readUInt16LE(3) * 2

  for (let i = 18; i + 48 <= totalHexLen; i += 48) {
    const id = parseInt(hex.substr(i + 2, 2) + hex.substr(i, 2), 16)

    const nameHex = hex.substr(i + 8, 34)
    const name = Buffer.from(nameHex, 'hex')
      .toString('ascii')
      .replace(/\0/g, '')
      .trim()

    if (!Number.isNaN(id)) {
      devices.push({ id, name })
    }
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
  buildGetConsoleBulk,
  buildRoute,
  parseDiscoveryPacket,
}