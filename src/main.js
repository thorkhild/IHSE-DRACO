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

    this.config = {}
    this.isConnected = false
    this.cpus = new Map()
    this.cons = new Map()
    this.routes = new Map()
    this.radioGroups = new Map()
    this.cpuExtStatus = new Map()
    this.conExtStatus = new Map()
    this.activeConSet = new Set()
    this.buffer = Buffer.alloc(0)
    this.socket = null
    this.keepAliveTimer = null
    this.reconnectTimer = null
    this.discoveryTimer = null
    this.discoveryPhase = null
    this.discoveryStrategyIndex = 0
    this.discoveryInProgress = false
    this.switchQueue = []
    this.switchQueueTimer = null
    this.switchQueueBusy = false
    this.actions = null
    this.feedbacks = null

    this.discoveryStrategies = [
      { name: 'legacy7', cpu: buildGetCpuListLegacy, con: buildGetConListLegacy },
      { name: 'generic5', cpu: buildGetCpuListGeneric, con: buildGetConListGeneric },
    ]
  }

  getConfigFields() {
    return getConfigFields()
  }

  async init(config) {
    this.config = config || {}
    this.setVariableDefinitions(getVariableDefinitions())
    this.actions = getActionDefinitions(this)
    this.feedbacks = getFeedbackDefinitions(this)
    this.setActionDefinitions(this.actions)
    this.setFeedbackDefinitions(this.feedbacks)
    this._setCoreVariables()
    this._initTcp()
  }

  async destroy() {
    this._stopKeepAlive()
    this._stopDiscoveryTimer()
    this._stopReconnectTimer()
    this._clearSwitchQueue()
    this._destroySocket()
  }

  async configUpdated(config) {
    this.config = config || {}
    this._stopKeepAlive()
    this._stopDiscoveryTimer()
    this._stopReconnectTimer()
    this._clearSwitchQueue()
    this._destroySocket()
    this._initTcp()
  }

  _setCoreVariables(extra = {}) {
    this.setVariableValues({
      connected: this.isConnected ? 1 : 0,
      cpu_count: this.cpus.size,
      con_count: this.cons.size,
      poll_mode_active: this.config.enable_experimental_status_query ? 'MANUAL_EXPERIMENTAL' : 'OFF',
      ...extra,
    })
  }

  _refreshVariableDefinitions() {
    this.setVariableDefinitions(getVariableDefinitions([...this.cons.keys()]))
  }

  _setRouteState(con, cpu, mode) {
    const conId = Number(con)
    const cpuId = Number(cpu)
    const routeMode = Number(mode)
    if (!Number.isFinite(conId) || !Number.isFinite(cpuId)) return

    this.routes.set(conId, { cpuId, mode: routeMode })
    const cpuName = cpuId > 0 ? this.cpus.get(cpuId) || `CPU ${cpuId}` : ''
    let modeName = 'Disconnected'

    if (cpuId > 0) {
      if (routeMode === MODES.VIDEO_ONLY) modeName = 'Video Only'
      else if (routeMode === MODES.PRIVATE) modeName = 'Private Mode'
      else if (routeMode === MODES.USB_HID_CONTROL) modeName = 'USB HID Control'
      else modeName = 'Full'
    }

    this.setVariableValues({
      last_cpu_id: cpuId,
      last_con_id: conId,
      [`con_${conId}_active_cpu_name`]: cpuName,
      [`con_${conId}_mode_name`]: modeName,
    })

    this.checkFeedbacks('route_status', 'route_status_by_name', 'con_status_by_name')
  }

  _queueWrite(buffer, routeState = null) {
    if (!Buffer.isBuffer(buffer)) return
    this.switchQueue.push({ buffer, routeState })
    this._processSwitchQueue()
  }

  _processSwitchQueue() {
    if (this.switchQueueBusy || this.switchQueue.length === 0) return

    if (!this.socket || !this.socket.writable) {
      this.log('warn', 'Switch queue cleared: socket not writable')
      this.switchQueue = []
      return
    }

    this.switchQueueBusy = true
    const item = this.switchQueue.shift()

    try {
      this.socket.write(item.buffer)
      if (item.routeState) {
        this.log('info', `Sent route command: CPU=${item.routeState.cpu}, CON=${item.routeState.con}, MODE=${item.routeState.mode}`)
        this._setRouteState(item.routeState.con, item.routeState.cpu, item.routeState.mode)
      }
    } catch (error) {
      this.log('warn', `Switch write failed: ${error.message}`)
    }

    const delay = Math.max(0, Number(this.config.switch_delay_ms) || 0)
    this.switchQueueTimer = setTimeout(() => {
      this.switchQueueBusy = false
      this.switchQueueTimer = null
      this._processSwitchQueue()
    }, delay)
  }

  _clearSwitchQueue() {
    this.switchQueue = []
    this.switchQueueBusy = false
    if (this.switchQueueTimer) clearTimeout(this.switchQueueTimer)
    this.switchQueueTimer = null
  }

  _setCpuExtStatus(id, status) {
    const cpuId = Number(id)
    if (!Number.isFinite(cpuId)) return
    this.cpuExtStatus.set(cpuId, status)
    this.checkFeedbacks('cpu_ext_status', 'cpu_ext_status_by_name')
  }

  _setConExtStatus(id, status) {
    const conId = Number(id)
    if (!Number.isFinite(conId)) return
    this.conExtStatus.set(conId, status)
    this.checkFeedbacks('con_ext_status', 'con_ext_status_by_name')
  }

  _getCpuExtStatus(id) {
    const cpuId = Number(id)
    if (!this.cpus.has(cpuId)) return 'not_assigned'
    return this.cpuExtStatus.get(cpuId) || 'not_assigned'
  }

  _getConExtStatus(id) {
    const conId = Number(id)
    if (!this.cons.has(conId)) return 'not_assigned'
    return this.conExtStatus.get(conId) || 'not_assigned'
  }

  _pollActiveConsNow() {
    if (!this.config.enable_experimental_status_query) {
      this.log('warn', 'Manual status query is disabled. Enable the experimental setting only after verifying firmware support.')
      this.checkFeedbacks('route_status', 'route_status_by_name', 'con_status_by_name')
      return
    }

    if (!this.socket || !this.socket.writable) {
      this.log('warn', 'Manual status query skipped: socket not writable')
      return
    }

    const conIds = this.activeConSet.size > 0 ? [...this.activeConSet] : [...this.cons.keys()]
    if (conIds.length === 0) {
      this.log('warn', 'Manual status query skipped: no active or discovered CONs')
      return
    }

    for (const conId of conIds) this.socket.write(buildGetConsole(conId))
    this.log('info', `Requested status for ${conIds.length} CON(s)`)
  }

  _initTcp() {
    if (!this.config.host) {
      this.updateStatus(InstanceStatus.BadConfig, 'Missing Draco IP')
      return
    }

    const port = Number(this.config.port) || 5555
    this.updateStatus(InstanceStatus.Connecting)
    this.socket = new net.Socket()
    this.socket.setNoDelay(true)

    this.socket.on('connect', () => {
      this.isConnected = true
      this.updateStatus(InstanceStatus.Ok)
      this._setCoreVariables()
      this.checkFeedbacks('connection_status')
      this._startKeepAlive()
      this.startAdaptiveDiscovery(false)
      this.log('info', `Connected to ${this.config.host}:${port}`)
    })

    this.socket.on('data', (data) => this._onData(data))

    this.socket.on('error', (error) => {
      this.isConnected = false
      this.updateStatus(InstanceStatus.ConnectionFailure, error.message)
      this._setCoreVariables()
      this.checkFeedbacks('connection_status')
    })

    this.socket.on('close', () => {
      this.isConnected = false
      this.updateStatus(InstanceStatus.Disconnected)
      this._setCoreVariables()
      this.checkFeedbacks('connection_status')
      this._stopKeepAlive()
      this._scheduleReconnect()
    })

    this.socket.connect(port, this.config.host)
  }

  _destroySocket() {
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.destroy()
      this.socket = null
    }
    this.isConnected = false
    this._setCoreVariables()
  }

  _scheduleReconnect() {
    if (!this.config.autoreconnect || this.reconnectTimer) return
    const delay = Math.max(1, Number(this.config.reconnect_delay) || 5) * 1000
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this._destroySocket()
      this._initTcp()
    }, delay)
  }

  _stopReconnectTimer() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }

  _startKeepAlive() {
    this._stopKeepAlive()
    const interval = Math.max(1, Number(this.config.keepalive) || 5) * 1000
    this.keepAliveTimer = setInterval(() => {
      if (this.socket && this.socket.writable) this.socket.write(buildTelegram('z'))
    }, interval)
  }

  _stopKeepAlive() {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer)
    this.keepAliveTimer = null
  }

  startAdaptiveDiscovery(isManual) {
    if (!this.socket || !this.socket.writable) {
      this.log('warn', 'Discovery skipped: socket not writable')
      return
    }

    this.discoveryInProgress = true
    this.discoveryPhase = 'cpu'
    this.discoveryStrategyIndex = 0
    this.log('info', `Starting adaptive discovery (${isManual ? 'manual' : 'startup'})`)
    this._sendDiscoveryRequest()
  }

  _sendDiscoveryRequest() {
    if (!this.discoveryInProgress || !this.discoveryPhase) return

    const strategy = this.discoveryStrategies[this.discoveryStrategyIndex]
    if (!strategy) {
      this._advanceDiscoveryPhaseOrFail()
      return
    }

    const packet = this.discoveryPhase === 'cpu' ? strategy.cpu() : strategy.con()

    try {
      this.socket.write(packet)
      this.log('info', `Discovery request: ${this.discoveryPhase}/${strategy.name}`)
    } catch (error) {
      this.log('warn', `Discovery write failed: ${error.message}`)
      this._advanceDiscoveryStrategy()
      return
    }

    this._startDiscoveryTimer()
  }

  _startDiscoveryTimer() {
    this._stopDiscoveryTimer()
    const timeout = Math.max(500, Number(this.config.discovery_timeout) || 1500)
    this.discoveryTimer = setTimeout(() => this._advanceDiscoveryStrategy(), timeout)
  }

  _stopDiscoveryTimer() {
    if (this.discoveryTimer) clearTimeout(this.discoveryTimer)
    this.discoveryTimer = null
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
      this.discoveryPhase = 'con'
      this.discoveryStrategyIndex = 0
      this._sendDiscoveryRequest()
      return
    }

    this.discoveryPhase = null
    this.discoveryInProgress = false
    this.log('warn', 'Adaptive discovery completed without a supported response for the current phase')
  }

  _discoveryPhaseSucceeded() {
    this._stopDiscoveryTimer()

    if (this.discoveryPhase === 'cpu') {
      this.discoveryPhase = 'con'
      this.discoveryStrategyIndex = 0
      this._sendDiscoveryRequest()
      return
    }

    this.discoveryPhase = null
    this.discoveryInProgress = false
    this.log('info', 'Adaptive discovery completed')
  }

  _onData(data) {
    if (data.length === 1 && data[0] === 0x15) {
      if (this.discoveryInProgress) this._advanceDiscoveryStrategy()
      return
    }

    this.buffer = Buffer.concat([this.buffer, data])

    while (this.buffer.length >= 5) {
      const hasHeader = this.buffer[0] === 0x1b && (this.buffer[1] === 0x5b || this.buffer[1] === 0x5d)

      if (!hasHeader) {
        this.buffer = this.buffer.subarray(1)
        continue
      }

      const length = this.buffer.readUInt16LE(3)
      if (length < 5) {
        this.buffer = this.buffer.subarray(1)
        continue
      }

      if (this.buffer.length < length) break

      const packet = this.buffer.subarray(0, length)
      this.buffer = this.buffer.subarray(length)
      this._parsePacket(packet)
    }
  }

  _parsePacket(packet) {
    const command = String.fromCharCode(packet[2])

    if (command === 'g') {
      const devices = parseDiscoveryPacket(packet)
      this.cpus.clear()
      const values = { cpu_count: devices.length }

      for (const device of devices) {
        this.cpus.set(device.id, device.name)
        if (device.id >= 1 && device.id <= 50) values[`cpu_${device.id}_name`] = device.name
      }

      this.setVariableValues(values)
      this._setCoreVariables({ cpu_count: devices.length })
      this._updateUiChoices()
      this._discoveryPhaseSucceeded()
      return
    }

    if (command === 'h') {
      const devices = parseDiscoveryPacket(packet)
      this.cons.clear()
      for (const device of devices) this.cons.set(device.id, device.name)

      this._refreshVariableDefinitions()
      const values = { con_count: devices.length }

      for (const device of devices) {
        values[`con_${device.id}_name`] = device.name
        values[`con_${device.id}_active_cpu_name`] = ''
        values[`con_${device.id}_mode_name`] = 'Disconnected'
      }

      this.setVariableValues(values)
      this._setCoreVariables({ con_count: devices.length })
      this._updateUiChoices()
      this._discoveryPhaseSucceeded()
      return
    }

    if (command === 'b' && packet.length >= 11) {
      const cpu = packet.readUInt16LE(5)
      const con = packet.readUInt16LE(7)
      const mode = packet.readUInt16LE(9)
      this._setRouteState(con, cpu, mode)
    }
  }

  _updateUiChoices() {
    const cpuChoices = [...this.cpus.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([id, name]) => ({ id, label: `${id} - ${name}` }))

    const conChoices = [...this.cons.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([id, name]) => ({ id, label: `${id} - ${name}` }))

    if (this.actions && this.actions.route_by_name) {
      this.actions.route_by_name.options[0].choices = cpuChoices
      this.actions.route_by_name.options[1].choices = conChoices
      this.setActionDefinitions(this.actions)
    }

    if (!this.feedbacks) return

    if (this.feedbacks.route_status_by_name) {
      this.feedbacks.route_status_by_name.options[0].choices = cpuChoices
      this.feedbacks.route_status_by_name.options[1].choices = conChoices
    }

    if (this.feedbacks.con_status_by_name) this.feedbacks.con_status_by_name.options[0].choices = conChoices
    if (this.feedbacks.cpu_ext_status_by_name) this.feedbacks.cpu_ext_status_by_name.options[0].choices = cpuChoices
    if (this.feedbacks.con_ext_status_by_name) this.feedbacks.con_ext_status_by_name.options[0].choices = conChoices

    this.setFeedbackDefinitions(this.feedbacks)
  }
}

module.exports = { DracoGInstance }
