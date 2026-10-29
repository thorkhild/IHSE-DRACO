const { buildRoute, MODES } = require('./protocol')

function resolveId(input, map) {
  const value = String(input ?? '').trim()
  if (!value) return NaN

  const numeric = Number(value)
  if (Number.isFinite(numeric)) return numeric

  const lower = value.toLowerCase()
  const match = [...map.entries()].find(([, name]) => String(name).toLowerCase() === lower)
  return match ? Number(match[0]) : NaN
}

function validId(value) {
  return Number.isInteger(value) && value > 0 && value <= 0xffff
}

function validMode(value) {
  return Object.values(MODES).includes(value)
}

function modeOption() {
  return {
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
  }
}

async function sendRoute(instance, cpuInput, conInput, modeInput, label) {
  const cpu = resolveId(cpuInput, instance.cpus)
  const con = resolveId(conInput, instance.cons)
  const mode = Number(modeInput)

  if (!validId(cpu) || !validId(con) || !validMode(mode)) {
    instance.log('warn', `${label} rejected: CPU=${cpuInput} (${cpu}), CON=${conInput} (${con}), MODE=${modeInput}`)
    return
  }

  if (!instance.socket || !instance.socket.writable) {
    instance.log('warn', `${label} skipped: socket not writable`)
    return
  }

  instance.log('info', `Queueing route command: CPU=${cpu}, CON=${con}, MODE=${mode}`)
  instance._queueWrite(buildRoute(cpu, con, mode), { cpu, con, mode })
}

function getActionDefinitions(instance) {
  return {
    route: {
      name: 'Route CPU to CON',
      options: [
        { type: 'textinput', id: 'cpu', label: 'CPU (ID/Var or exact name)', useVariables: true },
        { type: 'textinput', id: 'con', label: 'CON (ID/Var or exact name)', useVariables: true },
        modeOption(),
      ],
      callback: async (action) => {
        const cpu = await instance.parseVariablesInString(action.options.cpu)
        const con = await instance.parseVariablesInString(action.options.con)
        await sendRoute(instance, cpu, con, action.options.mode, 'Route')
      },
    },
    route_by_name: {
      name: 'Route CPU to CON (by name)',
      options: [
        { type: 'dropdown', id: 'cpu', label: 'CPU', choices: [] },
        { type: 'dropdown', id: 'con', label: 'CON', choices: [] },
        modeOption(),
      ],
      callback: async (action) => sendRoute(instance, action.options.cpu, action.options.con, action.options.mode, 'Route by name'),
    },
    update_discovery: {
      name: 'Manual ID Update',
      options: [],
      callback: () => instance.startAdaptiveDiscovery(true),
    },
    update_active_con_routes: {
      name: 'Update Active CON Route Status',
      options: [],
      callback: () => instance._pollActiveConsNow(),
    },
    set_active_cons: {
      name: 'Set Active CON IDs',
      options: [{ type: 'textinput', id: 'list', label: 'CON IDs (comma-separated)', default: '12001,12002', useVariables: true }],
      callback: async (action) => {
        const raw = await instance.parseVariablesInString(action.options.list)
        const ids = raw.split(',').map((value) => Number(value.trim())).filter(validId)
        instance.activeConSet = new Set(ids)
        instance.log('info', `Active CON IDs: ${ids.join(', ') || 'none'}`)
      },
    },
    select_radio: {
      name: 'Select Radio Button',
      options: [
        { type: 'textinput', id: 'group', label: 'Group Name', default: 'page1', useVariables: true },
        { type: 'textinput', id: 'btnId', label: 'Button ID', default: '1', useVariables: true },
      ],
      callback: async (action) => {
        const group = (await instance.parseVariablesInString(action.options.group)).trim()
        const btnId = (await instance.parseVariablesInString(action.options.btnId)).trim()
        instance.radioGroups.set(group, btnId)
        instance.checkFeedbacks('radio_page', 'page_latch_red_black')
      },
    },
    set_cpu_ext_status: {
      name: 'Set CPU EXT Status (manual test)',
      options: [
        { type: 'textinput', id: 'cpu', label: 'CPU ID', default: '1', useVariables: true },
        { type: 'dropdown', id: 'status', label: 'Status', default: 'connected', choices: [
          { id: 'connected', label: 'Connected' },
          { id: 'disconnected', label: 'Disconnected' },
          { id: 'not_assigned', label: 'Not Assigned' },
        ] },
      ],
      callback: async (action) => instance._setCpuExtStatus(Number(await instance.parseVariablesInString(action.options.cpu)), action.options.status),
    },
    set_con_ext_status: {
      name: 'Set CON EXT Status (manual test)',
      options: [
        { type: 'textinput', id: 'con', label: 'CON ID', default: '12001', useVariables: true },
        { type: 'dropdown', id: 'status', label: 'Status', default: 'connected', choices: [
          { id: 'connected', label: 'Connected' },
          { id: 'disconnected', label: 'Disconnected' },
          { id: 'not_assigned', label: 'Not Assigned' },
        ] },
      ],
      callback: async (action) => instance._setConExtStatus(Number(await instance.parseVariablesInString(action.options.con)), action.options.status),
    },
  }
}

module.exports = { getActionDefinitions }
