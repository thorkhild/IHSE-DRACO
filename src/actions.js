const {
  buildRoute,
  MODES,
} = require('./protocol')

function safeLog(instance, level, message, data) {
  if (typeof instance._log === 'function') {
    if (data !== undefined) {
      instance._log(level, message, data)
    } else {
      instance._log(level, message)
    }
    return
  }

  if (typeof instance.log === 'function') {
    if (data !== undefined) {
      instance.log(level, `${message} ${JSON.stringify(data)}`)
    } else {
      instance.log(level, message)
    }
  }
}

function safeWrite(instance, buffer) {
  if (typeof instance._queueWrite === 'function') {
    instance._queueWrite(buffer)
    return true
  }

  if (instance.socket && instance.socket.writable) {
    instance.socket.write(buffer)
    return true
  }

  return false
}

function resolveIdFromMap(input, map) {
  const value = String(input ?? '').trim()

  if (value.length === 0) {
    return NaN
  }

  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    return numeric
  }

  const exactMatch = [...map.entries()].find(([, name]) => name === value)
  if (exactMatch) {
    return exactMatch[0]
  }

  const lowerValue = value.toLowerCase()
  const caseMatch = [...map.entries()].find(([, name]) => {
    return String(name).toLowerCase() === lowerValue
  })

  if (caseMatch) {
    return caseMatch[0]
  }

  return NaN
}

function isValidEndpointId(value) {
  return Number.isFinite(value) && value > 0
}

function isValidMode(value) {
  return (
    value === MODES.FULL ||
    value === MODES.VIDEO_ONLY ||
    value === MODES.PRIVATE ||
    value === MODES.USB_HID_CONTROL
  )
}

function getActionDefinitions(instance) {
  return {
    route: {
      name: 'Route CPU to CON',
      options: [
        {
          type: 'textinput',
          id: 'cpu',
          label: 'CPU (ID/Var or exact name)',
          useVariables: true,
        },
        {
          type: 'textinput',
          id: 'con',
          label: 'CON (ID/Var or exact name)',
          useVariables: true,
        },
        {
          type: 'dropdown',
          id: 'mode',
          label: 'Mode',
          default: MODES.FULL,
          choices: [
            { id: MODES.FULL, label: 'Full' },
            { id: MODES.VIDEO_ONLY, label: 'Video Only' },
            { id: MODES.PRIVATE, label: 'Private Mode' },
            { id: MODES.USB_HID_CONTROL, label: 'USB HID Control' },
          ],
        },
      ],
      callback: async (action) => {
        const cpuInput = (await instance.parseVariablesInString(action.options.cpu)).trim()
        const conInput = (await instance.parseVariablesInString(action.options.con)).trim()
        const mode = Number(action.options.mode)

        const cpu = resolveIdFromMap(cpuInput, instance.cpus)
        const con = resolveIdFromMap(conInput, instance.cons)

        if (!isValidEndpointId(cpu) || !isValidEndpointId(con)) {
          safeLog(instance, 'warn', 'Route rejected before send: invalid CPU/CON', {
            cpuInput,
            cpuResolved: cpu,
            conInput,
            conResolved: con,
          })
          return
        }

        if (!isValidMode(mode)) {
          safeLog(instance, 'warn', 'Route rejected before send: invalid mode', {
            modeInput: action.options.mode,
            modeResolved: mode,
          })
          return
        }

        const existing = instance.routes.get(con)
        if (existing && existing.cpuId === cpu && existing.mode === mode) {
          safeLog(instance, 'debug', `Route skipped: CON ${con} is already on CPU ${cpu} mode ${mode}`)
          return
        }

        if (!instance.socket || !instance.socket.writable) {
          safeLog(instance, 'warn', 'Route skipped: socket not writable')
          return
        }

        safeLog(instance, 'info', `Sending route command: CPU=${cpu}, CON=${con}, MODE=${mode}`)

        const wrote = safeWrite(instance, buildRoute(cpu, con, mode))
        if (!wrote) {
          safeLog(instance, 'warn', 'Route skipped: write failed')
          return
        }

        instance._setRouteState(con, cpu, mode)
      },
    },

    route_by_name: {
      name: 'Route CPU to CON (by name)',
      options: [
        {
          type: 'dropdown',
          id: 'cpu',
          label: 'CPU',
          choices: [],
        },
        {
          type: 'dropdown',
          id: 'con',
          label: 'CON',
          choices: [],
        },
        {
          type: 'dropdown',
          id: 'mode',
          label: 'Mode',
          default: MODES.FULL,
          choices: [
            { id: MODES.FULL, label: 'Full' },
            { id: MODES.VIDEO_ONLY, label: 'Video Only' },
            { id: MODES.PRIVATE, label: 'Private Mode' },
            { id: MODES.USB_HID_CONTROL, label: 'USB HID Control' },
          ],
        },
      ],
      callback: async (action) => {
        const cpu = Number(action.options.cpu)
        const con = Number(action.options.con)
        const mode = Number(action.options.mode)

        if (!isValidEndpointId(cpu) || !isValidEndpointId(con)) {
          safeLog(instance, 'warn', 'Route CPU to CON (by name) rejected before send: invalid CPU/CON', {
            cpu,
            con,
          })
          return
        }

        if (!isValidMode(mode)) {
          safeLog(instance, 'warn', 'Route CPU to CON (by name) rejected before send: invalid mode', {
            modeInput: action.options.mode,
            modeResolved: mode,
          })
          return
        }

        const existing = instance.routes.get(con)
        if (existing && existing.cpuId === cpu && existing.mode === mode) {
          safeLog(instance, 'debug', `Route skipped: CON ${con} is already on CPU ${cpu} mode ${mode}`)
          return
        }

        if (!instance.socket || !instance.socket.writable) {
          safeLog(instance, 'warn', 'Route skipped: socket not writable')
          return
        }

        safeLog(instance, 'info', `Sending route-by-name command: CPU=${cpu}, CON=${con}, MODE=${mode}`)

        const wrote = safeWrite(instance, buildRoute(cpu, con, mode))
        if (!wrote) {
          safeLog(instance, 'warn', 'Route skipped: write failed')
          return
        }

        instance._setRouteState(con, cpu, mode)
      },
    },

    update_discovery: {
      name: 'Manual ID Update',
      options: [],
      callback: () => {
        safeLog(instance, 'info', 'Manual discovery triggered')
        instance.startAdaptiveDiscovery(true)
      },
    },

    update_active_con_routes: {
      name: 'Update Active CON Route Status',
      options: [],
      callback: () => {
        instance._pollActiveConsNow()
      },
    },

    select_radio: {
      name: 'Select Radio Button',
      options: [
        {
          type: 'textinput',
          id: 'group',
          label: 'Group Name',
          default: 'page1',
          useVariables: true,
        },
        {
          type: 'textinput',
          id: 'btnId',
          label: 'Button ID',
          default: '1',
          useVariables: true,
        },
      ],
      callback: async (action) => {
        const group = (await instance.parseVariablesInString(action.options.group)).trim()
        const btnId = (await instance.parseVariablesInString(action.options.btnId)).trim()

        instance.radioGroups.set(group, btnId)
        instance.checkFeedbacks('radio_page')
        instance.checkFeedbacks('page_latch_red_black')
      },
    },

    set_active_cons: {
      name: 'Set Active CON IDs for Smart Polling',
      options: [
        {
          type: 'textinput',
          id: 'list',
          label: 'CON IDs (comma separated)',
          default: '12001,12002',
          useVariables: true,
        },
      ],
      callback: async (action) => {
        const raw = (await instance.parseVariablesInString(action.options.list)).trim()

        const ids = raw
          .split(',')
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isFinite(value) && value > 0)

        instance.activeConSet = new Set(ids)

        safeLog(instance, 'info', 'Active CON IDs updated for smart polling/manual route update', {
          activeCons: ids,
        })
      },
    },

    set_cpu_ext_status: {
      name: 'Set CPU EXT Status',
      options: [
        {
          type: 'textinput',
          id: 'cpu',
          label: 'CPU ID',
          default: '1',
          useVariables: true,
        },
        {
          type: 'dropdown',
          id: 'status',
          label: 'Status',
          default: 'connected',
          choices: [
            { id: 'connected', label: 'Connected' },
            { id: 'disconnected', label: 'Disconnected' },
            { id: 'not_assigned', label: 'Not Assigned' },
          ],
        },
      ],
      callback: async (action) => {
        const cpuStr = await instance.parseVariablesInString(action.options.cpu)
        const cpu = Number(cpuStr)

        if (!Number.isFinite(cpu)) {
          safeLog(instance, 'warn', `Set CPU EXT Status rejected: invalid CPU "${cpuStr}"`)
          return
        }

        instance._setCpuExtStatus(cpu, action.options.status)
      },
    },

    set_con_ext_status: {
      name: 'Set CON EXT Status',
      options: [
        {
          type: 'textinput',
          id: 'con',
          label: 'CON ID',
          default: '12001',
          useVariables: true,
        },
        {
          type: 'dropdown',
          id: 'status',
          label: 'Status',
          default: 'connected',
          choices: [
            { id: 'connected', label: 'Connected' },
            { id: 'disconnected', label: 'Disconnected' },
            { id: 'not_assigned', label: 'Not Assigned' },
          ],
        },
      ],
      callback: async (action) => {
        const conStr = await instance.parseVariablesInString(action.options.con)
        const con = Number(conStr)

        if (!Number.isFinite(con)) {
          safeLog(instance, 'warn', `Set CON EXT Status rejected: invalid CON "${conStr}"`)
          return
        }

        instance._setConExtStatus(con, action.options.status)
      },
    },
  }
}

module.exports = { getActionDefinitions }