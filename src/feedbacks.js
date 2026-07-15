const { MODES } = require('./protocol')

const DISCONNECTED_STYLE = { bgcolor: 0x0000ff, color: 0x000000 }
const ACTIVE_RED = { bgcolor: 0xff0000, color: 0x000000 }
const INACTIVE_BLACK = { bgcolor: 0x000000, color: 0xffffff }

// EXT status colors
const EXT_CONNECTED = { bgcolor: 0x00ff00, color: 0x000000 }
const EXT_DISCONNECTED = { bgcolor: 0xff0000, color: 0xffffff }
const EXT_NOT_ASSIGNED = { bgcolor: 0xffff00, color: 0x000000 }

function getModeStyle(route) {
  if (!route || route.cpuId === 0) return DISCONNECTED_STYLE

  switch (route.mode) {
    case MODES.VIDEO_ONLY:
      return { bgcolor: 0xffff00, color: 0x000000 }
    case MODES.PRIVATE:
      return { bgcolor: 0xffa500, color: 0x000000 }
    case MODES.USB_HID_CONTROL:
      return { bgcolor: 0x800080, color: 0x000000 }
    case MODES.FULL:
    default:
      return { bgcolor: 0x00ff00, color: 0x000000 }
  }
}

function getExtStyle(status) {
  switch (status) {
    case 'connected':
      return EXT_CONNECTED
    case 'disconnected':
      return EXT_DISCONNECTED
    case 'not_assigned':
    default:
      return EXT_NOT_ASSIGNED
  }
}

function getFeedbackDefinitions(instance) {
  return {
    connection_status: {
      type: 'boolean',
      name: 'Matrix Connection Status',
      defaultStyle: {
        bgcolor: 0x00ff00,
        color: 0x000000,
      },
      options: [],
      callback: () => instance.isConnected === true,
    },

    radio_page: {
      type: 'advanced',
      name: 'Radio Button (Per Page/Group)',
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
      callback: async (fb) => {
        const group = await instance.parseVariablesInString(fb.options.group)
        const btnId = await instance.parseVariablesInString(fb.options.btnId)

        const activeId = instance.radioGroups.get(group)
        return activeId === btnId ? ACTIVE_RED : INACTIVE_BLACK
      },
    },

    page_latch_red_black: {
      type: 'advanced',
      name: 'Page Latch (red active / black inactive)',
      options: [
        {
          type: 'textinput',
          id: 'group',
          label: 'Page / Group Name',
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
      callback: async (fb) => {
        const group = await instance.parseVariablesInString(fb.options.group)
        const btnId = await instance.parseVariablesInString(fb.options.btnId)

        const activeId = instance.radioGroups.get(group)
        return activeId === btnId ? ACTIVE_RED : INACTIVE_BLACK
      },
    },

    route_status: {
      type: 'advanced',
      name: 'CON Connection Status Color',
      options: [
        {
          type: 'textinput',
          id: 'con',
          label: 'CON ID/Var',
          useVariables: true,
        },
      ],
      callback: async (fb) => {
        const conStr = await instance.parseVariablesInString(fb.options.con)
        const conId = Number(conStr)

        if (!Number.isFinite(conId)) return DISCONNECTED_STYLE

        const route = instance.routes.get(conId)
        return route ? getModeStyle(route) : DISCONNECTED_STYLE
      },
    },

    route_status_by_name: {
      type: 'advanced',
      name: 'Route Status (by name)',
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
      ],
      callback: (fb) => {
        const cpuId = Number(fb.options.cpu)
        const conId = Number(fb.options.con)

        if (!Number.isFinite(cpuId) || !Number.isFinite(conId)) {
          return DISCONNECTED_STYLE
        }

        const route = instance.routes.get(conId)
        if (!route || route.cpuId !== cpuId) return DISCONNECTED_STYLE

        return getModeStyle(route)
      },
    },

    con_status_by_name: {
      type: 'advanced',
      name: 'CON Status (by name)',
      options: [
        {
          type: 'dropdown',
          id: 'con',
          label: 'CON',
          choices: [],
        },
      ],
      callback: (fb) => {
        const conId = Number(fb.options.con)

        if (!Number.isFinite(conId)) return DISCONNECTED_STYLE

        const route = instance.routes.get(conId)
        return route ? getModeStyle(route) : DISCONNECTED_STYLE
      },
    },

    cpu_ext_status: {
      type: 'advanced',
      name: 'CPU EXT Connection Status',
      options: [
        {
          type: 'textinput',
          id: 'cpu',
          label: 'CPU ID/Var',
          useVariables: true,
        },
      ],
      callback: async (fb) => {
        const cpuStr = await instance.parseVariablesInString(fb.options.cpu)
        const cpuId = Number(cpuStr)

        if (!Number.isFinite(cpuId)) return EXT_NOT_ASSIGNED

        return getExtStyle(instance._getCpuExtStatus(cpuId))
      },
    },

    con_ext_status: {
      type: 'advanced',
      name: 'CON EXT Connection Status',
      options: [
        {
          type: 'textinput',
          id: 'con',
          label: 'CON ID/Var',
          useVariables: true,
        },
      ],
      callback: async (fb) => {
        const conStr = await instance.parseVariablesInString(fb.options.con)
        const conId = Number(conStr)

        if (!Number.isFinite(conId)) return EXT_NOT_ASSIGNED

        return getExtStyle(instance._getConExtStatus(conId))
      },
    },

    cpu_ext_status_by_name: {
      type: 'advanced',
      name: 'CPU EXT Connection Status (by name)',
      options: [
        {
          type: 'dropdown',
          id: 'cpu',
          label: 'CPU',
          choices: [],
        },
      ],
      callback: (fb) => {
        const cpuId = Number(fb.options.cpu)

        if (!Number.isFinite(cpuId)) return EXT_NOT_ASSIGNED

        return getExtStyle(instance._getCpuExtStatus(cpuId))
      },
    },

    con_ext_status_by_name: {
      type: 'advanced',
      name: 'CON EXT Connection Status (by name)',
      options: [
        {
          type: 'dropdown',
          id: 'con',
          label: 'CON',
          choices: [],
        },
      ],
      callback: (fb) => {
        const conId = Number(fb.options.con)

        if (!Number.isFinite(conId)) return EXT_NOT_ASSIGNED

        return getExtStyle(instance._getConExtStatus(conId))
      },
    },
  }
}

module.exports = { getFeedbackDefinitions }