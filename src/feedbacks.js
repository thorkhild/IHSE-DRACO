const { MODES } = require('./protocol')

const DISCONNECTED = { bgcolor: 0x0000ff, color: 0xffffff }
const ACTIVE_RED = { bgcolor: 0xff0000, color: 0x000000 }
const INACTIVE_BLACK = { bgcolor: 0x000000, color: 0xffffff }
const EXT_CONNECTED = { bgcolor: 0x00ff00, color: 0x000000 }
const EXT_DISCONNECTED = { bgcolor: 0xff0000, color: 0xffffff }
const EXT_NOT_ASSIGNED = { bgcolor: 0xffff00, color: 0x000000 }

function modeStyle(route) {
  if (!route || route.cpuId === 0) return DISCONNECTED
  if (route.mode === MODES.VIDEO_ONLY) return { bgcolor: 0xffff00, color: 0x000000 }
  if (route.mode === MODES.PRIVATE) return { bgcolor: 0xffa500, color: 0x000000 }
  if (route.mode === MODES.USB_HID_CONTROL) return { bgcolor: 0x800080, color: 0xffffff }
  return { bgcolor: 0x00ff00, color: 0x000000 }
}

function extStyle(status) {
  if (status === 'connected') return EXT_CONNECTED
  if (status === 'disconnected') return EXT_DISCONNECTED
  return EXT_NOT_ASSIGNED
}

function getFeedbackDefinitions(instance) {
  return {
    connection_status: {
      type: 'boolean',
      name: 'Matrix Connection Status',
      defaultStyle: EXT_CONNECTED,
      options: [],
      callback: () => instance.isConnected === true,
    },
    radio_page: {
      type: 'advanced',
      name: 'Radio Button (Per Page/Group)',
      options: [
        { type: 'textinput', id: 'group', label: 'Group Name', default: 'page1', useVariables: true },
        { type: 'textinput', id: 'btnId', label: 'Button ID', default: '1', useVariables: true },
      ],
      callback: async (fb) => {
        const group = (await instance.parseVariablesInString(fb.options.group)).trim()
        const btnId = (await instance.parseVariablesInString(fb.options.btnId)).trim()
        return instance.radioGroups.get(group) === btnId ? ACTIVE_RED : INACTIVE_BLACK
      },
    },
    page_latch_red_black: {
      type: 'advanced',
      name: 'Page Latch (red active / black inactive)',
      options: [
        { type: 'textinput', id: 'group', label: 'Page / Group Name', default: 'page1', useVariables: true },
        { type: 'textinput', id: 'btnId', label: 'Button ID', default: '1', useVariables: true },
      ],
      callback: async (fb) => {
        const group = (await instance.parseVariablesInString(fb.options.group)).trim()
        const btnId = (await instance.parseVariablesInString(fb.options.btnId)).trim()
        return instance.radioGroups.get(group) === btnId ? ACTIVE_RED : INACTIVE_BLACK
      },
    },
    route_status: {
      type: 'advanced',
      name: 'CON Connection Status Color',
      options: [{ type: 'textinput', id: 'con', label: 'CON ID/Var', useVariables: true }],
      callback: async (fb) => {
        const con = Number(await instance.parseVariablesInString(fb.options.con))
        return Number.isFinite(con) ? modeStyle(instance.routes.get(con)) : DISCONNECTED
      },
    },
    route_status_by_name: {
      type: 'advanced',
      name: 'Route Status (by name)',
      options: [
        { type: 'dropdown', id: 'cpu', label: 'CPU', choices: [] },
        { type: 'dropdown', id: 'con', label: 'CON', choices: [] },
      ],
      callback: (fb) => {
        const route = instance.routes.get(Number(fb.options.con))
        return route && route.cpuId === Number(fb.options.cpu) ? modeStyle(route) : DISCONNECTED
      },
    },
    con_status_by_name: {
      type: 'advanced',
      name: 'CON Status (by name)',
      options: [{ type: 'dropdown', id: 'con', label: 'CON', choices: [] }],
      callback: (fb) => modeStyle(instance.routes.get(Number(fb.options.con))),
    },
    cpu_ext_status: {
      type: 'advanced',
      name: 'CPU EXT Connection Status',
      options: [{ type: 'textinput', id: 'cpu', label: 'CPU ID/Var', useVariables: true }],
      callback: async (fb) => extStyle(instance._getCpuExtStatus(Number(await instance.parseVariablesInString(fb.options.cpu)))),
    },
    con_ext_status: {
      type: 'advanced',
      name: 'CON EXT Connection Status',
      options: [{ type: 'textinput', id: 'con', label: 'CON ID/Var', useVariables: true }],
      callback: async (fb) => extStyle(instance._getConExtStatus(Number(await instance.parseVariablesInString(fb.options.con)))),
    },
    cpu_ext_status_by_name: {
      type: 'advanced',
      name: 'CPU EXT Connection Status (by name)',
      options: [{ type: 'dropdown', id: 'cpu', label: 'CPU', choices: [] }],
      callback: (fb) => extStyle(instance._getCpuExtStatus(Number(fb.options.cpu))),
    },
    con_ext_status_by_name: {
      type: 'advanced',
      name: 'CON EXT Connection Status (by name)',
      options: [{ type: 'dropdown', id: 'con', label: 'CON', choices: [] }],
      callback: (fb) => extStyle(instance._getConExtStatus(Number(fb.options.con))),
    },
  }
}

module.exports = { getFeedbackDefinitions }
