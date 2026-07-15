process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err)
})

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err)
})

const { InstanceBase, InstanceStatus } = require('@companion-module/base')
const net = require('net')

const { getConfigFields } = require('./config')
const { getActionDefinitions } = require('./actions')
const { getFeedbackDefinitions } = require('./feedbacks')
const { getVariableDefinitions } = require('./variables')

const {
  MODES,
  buildTelegram,
  buildGetCpuListLegacy,
  buildGetConListLegacy,
  buildGetCpuListGeneric,
  buildGetConListGeneric,
  buildGetConsole,
  parseDiscoveryPacket,
} = require('./protocol')

class DracoGInstance extends InstanceBase {
  constructor(internal) {
    super(internal)

    this.isConnected = false
    this.cpus = new Map()
    this.cons = new Map()
    this.routes = new Map()
    this.radioGroups = new Map()

    // EXT status state:
    // values: connected | disconnected | not_assigned
    this.cpuExtStatus = new Map()
    this.conExtStatus = new Map()

    this.buffer = Buffer.alloc(0)
    this.keepAliveTimer = null
    this.socket = null

    this.actions = null
    this.feedbacks = null

    // Active CON list used by manual route-status update
    this.activeConSet = new Set()

    // Global switching command queue
    this.switchQueue = []
    this.switchQueueTimer = null
    this.switchQueueBusy = false

    // Adaptive discovery
    this.discoveryStrategies = [
      {
        name: 'legacy7',
        cpu: buildGetCpuListLegacy,
        con: buildGetConListLegacy,
      },
      {
        name: 'generic5',
        cpu: buildGetCpuListGeneric,
        con: buildGetConListGeneric,
      },
    ]

    this.discoveryPhase = null
    this.discoveryStrategyIndex = 0
    this.discoveryTimer = null
    this.discoveryInProgress = false
  }

  getConfigFields() {
    return getConfigFields()
  }

  async init(config) {
    this.log('info', 'INIT START')

    try {
      this.config = config

      this.log('info', 'INIT step 1')
      this.setVariableDefinitions(getVariableDefinitions())

      this.log('info', 'INIT step 2')
      this.actions = getActionDefinitions(this)
      this.setActionDefinitions(this.actions)

      this.log('info', 'INIT step 3')
      this.feedbacks = getFeedbackDefinitions(this)
      this.setFeedbackDefinitions(this.feedbacks)

      this.log('info', 'INIT step 4')
      this._setCoreVariables()

      this.log('info', 'INIT step 5')
      this._updatePollModeVariable()

      this.log('info', 'INIT step 6')
      this._initTcp()

      this.log('info', 'INIT COMPLETE')
    } catch (e) {
      this.log('error', 'INIT CRASH: ' + e.message)
      this.log('error', e.stack)
      throw e
    }
  }

  async destroy() {
    this._stopKeepAlive()
    this._stopDiscoveryTimer()
    this._clearSwitchQueue()
    this._destroySocket()
  }

  async configUpdated(config) {
    this.config = config
    this._stopKeepAlive()
    this._stopDiscoveryTimer()
    this._clearSwitchQueue()
    this._destroySocket()
    this._updatePollModeVariable()
    this._initTcp()
  }

  _setCoreVariables(extra = {}) {
    this.setVariableValues({
      connected: this.isConnected ? 1 : 0,
      cpu_count: this.cpus.size,
      con_count: this.cons.size,
      ...extra,
    })
  }

  _updatePollModeVariable() {
    const mode = this.config && this.config.poll_mode ? this.config.poll_mode : 'off'

    this.setVariableValues({
      poll_mode_active: String(mode).toUpperCase(),
    })
  }

  _refreshVariableDefinitions() {
    this.setVariableDefinitions(
      getVariableDefinitions([...this.cons.keys()])
    )
  }

  _setRouteState(con, cpu, mode) {
    this.routes.set(con, { cpuId: cpu, mode })

    let cpuName = ''
    let modeName = 'Disconnected'

    if (cpu && cpu !== 0) {
      cpuName = this.cpus.get(cpu) || `CPU ${cpu}`

      switch (mode) {
        case MODES.VIDEO_ONLY:
          modeName = 'Video Only'
          break
        case MODES.PRIVATE:
          modeName = 'Private Mode'
          break
        case MODES.USB_HID_CONTROL:
          modeName = 'USB HID Control'
          break
        case MODES.FULL:
        default:
          modeName = 'Full'
          break
      }
    }

    this._setCoreVariables({
      last_cpu_id: cpu,
      last_con_id: con,
    })

    // Always update variable immediately, without requiring the CON to be in discovery map.
    this.setVariableValues({
      [`con_${con}_active_cpu_name`]: cpuName,
      [`con_${con}_mode_name`]: modeName,
    })

    this.checkFeedbacks('route_status')
    this.checkFeedbacks('route_status_by_name')
    this.checkFeedbacks('con_status_by_name')
  }

  // --------------------------------------------------
  // Global switching command queue
  // --------------------------------------------------

  _queueWrite(buffer) {
    if (!buffer) return

    this.switchQueue.push(buffer)
    this._processSwitchQueue()
  }

  _processSwitchQueue() {
    if (this.switchQueueBusy) return
    if (!this.switchQueue.length) return

    if (!this.socket || !this.socket.writable) {
      this.log('warn', 'Switch queue skipped: socket not writable')
      this.switchQueue = []
      return
    }

    this.switchQueueBusy = true

    const buffer = this.switchQueue.shift()

    try {
      this.socket.write(buffer)
    } catch (e) {
      this.log('warn', `Switch queue write failed: ${e.message}`)
    }

    const delay = Number(this.config && this.config.switch_delay_ms) || 0

    this.switchQueueTimer = setTimeout(() => {
      this.switchQueueBusy = false
      this._processSwitchQueue()
    }, delay)
  }

  _clearSwitchQueue() {
    this.switchQueue = []
    this.switchQueueBusy = false

    if (this.switchQueueTimer) {
      clearTimeout(this.switchQueueTimer)
      this.switchQueueTimer = null
    }
  }

  // --------------------------------------------------
  // EXT status helpers
  // --------------------------------------------------

  _setCpuExtStatus(cpuId, status) {
    const id = Number(cpuId)
    if (!Number.isFinite(id)) return

    this.cpuExtStatus.set(id, status)

    this.checkFeedbacks('cpu_ext_status')
    this.checkFeedbacks('cpu_ext_status_by_name')
  }

  _setConExtStatus(conId, status) {
    const id = Number(conId)
    if (!Number.isFinite(id)) return

    this.conExtStatus.set(id, status)

    this.checkFeedbacks('con_ext_status')
    this.checkFeedbacks('con_ext_status_by_name')
  }

  _getCpuExtStatus(cpuId) {
    const id = Number(cpuId)

    if (!Number.isFinite(id)) return 'not_assigned'
    if (!this.cpus.has(id)) return 'not_assigned'

    return this.cpuExtStatus.get(id) || 'not_assigned'
  }

  _getConExtStatus(conId) {
    const id = Number(conId)

    if (!Number.isFinite(id)) return 'not_assigned'
    if (!this.cons.has(id)) return 'not_assigned'

    return this.conExtStatus.get(id) || 'not_assigned'
  }

  // --------------------------------------------------
  // Manual route-status update
  // --------------------------------------------------

  _getActiveConIdsForManualUpdate() {
    if (this.activeConSet && this.activeConSet.size > 0) {
      return [...this.activeConSet]
    }

    return [...this.cons.keys()]
  }

  _pollActiveConsNow() {
    if (!this.socket || !this.socket.writable) {
      this.log('warn', 'Manual route status update skipped: socket not writable')
      return
    }

    const conIds = this._getActiveConIdsForManualUpdate()

    if (!conIds.length) {
      this.log('warn', 'Manual route status update skipped: no active/discovered CONs')
      return
    }

    this.log(
      'info',
      `Manual route status update: polling ${conIds.length} CON(s): ${conIds.join(', ')}`
    )

    for (const conId of conIds) {
      try {
        this.socket.write(buildGetConsole(conId))
      } catch (e) {
        this.log('warn', `Manual route status update failed for CON ${conId}: ${e.message}`)
      }
    }
  }

  _destroySocket() {
    if (this.socket) {
      try {
        this.socket.removeAllListeners()
        this.socket.destroy()
      } catch (e) {}

      this.socket = null
    }

    this.isConnected = false
    this._setCoreVariables()
  }

  _initTcp() {
    if (!this.config || !this.config.host) {
      this.updateStatus(InstanceStatus.BadConfig, 'Missing Draco IP')
      return
    }

    const port = Number(this.config.port) || 5555

    this.updateStatus(InstanceStatus.Connecting)
    this.socket = new net.Socket()
    this.socket.connect(port, this.config.host)

    this.socket.on('connect', () => {
      this.isConnected = true
      this.updateStatus(InstanceStatus.Ok)
      this._setCoreVariables()
      this.checkFeedbacks('connection_status')

      this._startKeepAlive()
      this.log('info', `DRACO-KVM-EJN connected to ${this.config.host}:${port}`)

      this.startAdaptiveDiscovery(false)
    })

    this.socket.on('data', (data) => this._onData(data))

    this.socket.on('error', (err) => {
      this.isConnected = false
      this.updateStatus(
        InstanceStatus.ConnectionFailure,
        (err && err.message) || String(err)
      )
      this._setCoreVariables()
      this.checkFeedbacks('connection_status')
    })

    this.socket.on('close', () => {
      this.isConnected = false
      this.updateStatus(InstanceStatus.Disconnected)
      this._setCoreVariables()
      this.checkFeedbacks('connection_status')
    })
  }

  _startKeepAlive() {
    this._stopKeepAlive()
    const intervalSec = Number(this.config.keepalive) || 5

    this.keepAliveTimer = setInterval(() => {
      if (this.socket && this.socket.writable) {
        try {
          this.socket.write(buildTelegram('z'))
        } catch (e) {}
      }
    }, intervalSec * 1000)
  }

  _stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = null
    }
  }

  // --------------------------------------------------
  // Adaptive discovery
  // --------------------------------------------------

  startAdaptiveDiscovery(isManual) {
    if (!this.socket || !this.socket.writable) {
      this.log('warn', 'Adaptive discovery skipped: socket not writable')
      return
    }

    this.discoveryInProgress = true
    this.discoveryPhase = 'cpu'
    this.discoveryStrategyIndex = 0

    if (isManual) {
      this.log('info', 'Starting adaptive discovery (manual)')
    } else {
      this.log('info', 'Starting adaptive discovery (startup)')
    }

    this._sendDiscoveryRequest()
  }

  _sendDiscoveryRequest() {
    if (!this.discoveryInProgress || !this.discoveryPhase) return

    const strategy = this.discoveryStrategies[this.discoveryStrategyIndex]
    if (!strategy) {
      this._advanceDiscoveryPhaseOrFail()
      return
    }

    let packet
    if (this.discoveryPhase === 'cpu') {
      packet = strategy.cpu()
    } else {
      packet = strategy.con()
    }

    try {
      this.socket.write(packet)
      this.log(
        'info',
        `Discovery request: phase=${this.discoveryPhase} strategy=${strategy.name}`
      )
    } catch (e) {
      this.log('warn', `Discovery write failed: ${e.message}`)
      this._advanceDiscoveryStrategy()
      return
    }

    this._startDiscoveryTimer()
  }

  _startDiscoveryTimer() {
    this._stopDiscoveryTimer()

    const timeout = Number(this.config && this.config.discovery_timeout) || 1500

    this.discoveryTimer = setTimeout(() => {
      const strategy = this.discoveryStrategies[this.discoveryStrategyIndex]
      this.log(
        'warn',
        `Discovery timeout: phase=${this.discoveryPhase} strategy=${strategy ? strategy.name : 'none'}`
      )
      this._advanceDiscoveryStrategy()
    }, timeout)
  }

  _stopDiscoveryTimer() {
    if (this.discoveryTimer) {
      clearTimeout(this.discoveryTimer)
      this.discoveryTimer = null
    }
  }

  _advanceDiscoveryStrategy() {
    this._stopDiscoveryTimer()
    this.discoveryStrategyIndex += 1

    if (this.discoveryStrategyIndex >= this.discoveryStrategies.length) {
      this._advanceDiscoveryPhaseOrFail()
      return
    }

    this._sendDiscoveryRequest()
  }

  _advanceDiscoveryPhaseOrFail() {
    this._stopDiscoveryTimer()

    if (this.discoveryPhase === 'cpu') {
      this.log('warn', 'CPU discovery unsupported for all known request formats')
      this.discoveryPhase = 'con'
      this.discoveryStrategyIndex = 0
      this._sendDiscoveryRequest()
      return
    }

    if (this.discoveryPhase === 'con') {
      this.log('warn', 'CON discovery unsupported for all known request formats')
      this.discoveryPhase = null
      this.discoveryInProgress = false
      this.log('warn', 'Adaptive discovery finished with fallback to ID-only mode')
    }
  }

  _discoveryPhaseSucceeded() {
    this._stopDiscoveryTimer()

    if (this.discoveryPhase === 'cpu') {
      this.discoveryPhase = 'con'
      this.discoveryStrategyIndex = 0
      this._sendDiscoveryRequest()
      return
    }

    if (this.discoveryPhase === 'con') {
      this.discoveryPhase = null
      this.discoveryInProgress = false
      this.log('info', 'Adaptive discovery completed successfully')
    }
  }

  // --------------------------------------------------
  // RX
  // --------------------------------------------------

  _onData(data) {
    if (data.length === 1 && data[0] === 0x15) {
      this.log('warn', `RX NAK (0x15) for phase=${this.discoveryPhase || 'none'}`)

      if (this.discoveryInProgress && this.discoveryPhase) {
        this._advanceDiscoveryStrategy()
      }
      return
    }

    this.buffer = Buffer.concat([this.buffer, data])

    while (this.buffer.length >= 5) {
      if (
        this.buffer[0] === 0x1b &&
        (this.buffer[1] === 0x5b || this.buffer[1] === 0x5d)
      ) {
        const len = this.buffer.readUInt16LE(3)

        if (this.buffer.length >= len) {
          const pkt = this.buffer.subarray(0, len)
          this.buffer = this.buffer.subarray(len)
          this._parsePacket(pkt)
        } else {
          break
        }
      } else {
        this.buffer = this.buffer.subarray(1)
      }
    }
  }

  _parsePacket(packet) {
    const cmd = String.fromCharCode(packet[2])

    if (cmd === 'g') {
      const devices = parseDiscoveryPacket(packet)

      this.cpus.clear()

      const vars = {
        cpu_count: devices.length,
      }

      for (const dev of devices) {
        this.cpus.set(dev.id, dev.name)

        if (dev.id >= 1 && dev.id <= 50) {
          vars[`cpu_${dev.id}_name`] = dev.name
        }
      }

      this.setVariableValues(vars)
      this._setCoreVariables({ cpu_count: devices.length })
      this._updateUiChoices()

      this.log('info', `Discovery: Found ${devices.length} CPUs`)
      this._discoveryPhaseSucceeded()
      return
    }

    if (cmd === 'h') {
      const devices = parseDiscoveryPacket(packet)

      this.cons.clear()

      for (const dev of devices) {
        this.cons.set(dev.id, dev.name)
      }

      this._refreshVariableDefinitions()

      const vars = {
        con_count: devices.length,
      }

      for (const dev of devices) {
        vars[`con_${dev.id}_name`] = dev.name
        vars[`con_${dev.id}_active_cpu_name`] = ''
        vars[`con_${dev.id}_mode_name`] = 'Disconnected'
      }

      this.setVariableValues(vars)
      this._setCoreVariables({ con_count: devices.length })
      this._updateUiChoices()

      this.log('info', `Discovery: Found ${devices.length} CONs`)
      this._discoveryPhaseSucceeded()
      return
    }

    if (cmd === 'z') {
      return
    }

    if (cmd === 'b') {
      const cpu = packet.readUInt16LE(5)
      const con = packet.readUInt16LE(7)
      const mode = packet.readUInt16LE(9)

      this._setRouteState(con, cpu, mode)
      return
    }
  }

  _updateUiChoices() {
    const cpuChoices = [...this.cpus.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([id, name]) => ({
        id,
        label: `${id} - ${name}`,
      }))

    const conChoices = [...this.cons.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([id, name]) => ({
        id,
        label: `${id} - ${name}`,
      }))

    if (this.actions && this.actions.route_by_name) {
      this.actions.route_by_name.options[0].choices = cpuChoices
      this.actions.route_by_name.options[1].choices = conChoices
      this.setActionDefinitions(this.actions)
    }

    if (this.feedbacks) {
      if (this.feedbacks.route_status_by_name) {
        this.feedbacks.route_status_by_name.options[0].choices = cpuChoices
        this.feedbacks.route_status_by_name.options[1].choices = conChoices
      }

      if (this.feedbacks.con_status_by_name) {
        this.feedbacks.con_status_by_name.options[0].choices = conChoices
      }

      if (this.feedbacks.cpu_ext_status_by_name) {
        this.feedbacks.cpu_ext_status_by_name.options[0].choices = cpuChoices
      }

      if (this.feedbacks.con_ext_status_by_name) {
        this.feedbacks.con_ext_status_by_name.options[0].choices = conChoices
      }

      this.setFeedbackDefinitions(this.feedbacks)
    }
  }
}

module.exports = { DracoGInstance }