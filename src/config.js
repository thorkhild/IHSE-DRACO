<<<<<<< HEAD
function getConfigFields() {
  return [
    {
      type: 'textinput',
      id: 'host',
      label: 'Draco IP Address',
      width: 6,
      default: '',
      tooltip: 'Enter the IP address of the Draco system',
    },
    {
      type: 'textinput',
      id: 'port',
      label: 'Port',
      width: 4,
      default: '5555',
      regex: '/^\\d+$/',
      tooltip: 'TCP port used by Draco (default: 5555)',
    },
    {
      type: 'number',
      id: 'keepalive',
      label: 'Keepalive Interval (seconds)',
      width: 6,
      min: 1,
      max: 60,
      default: 5,
      tooltip: 'How often to send keepalive packets to maintain connection',
    },
    {
      type: 'number',
      id: 'switch_delay_ms',
      label: 'Global Switching Command Delay (ms)',
      width: 6,
      min: 0,
      max: 2000,
      default: 150,
      tooltip: 'Delay between route/switch commands sent to the Draco matrix. Useful when one button sends multiple route commands.',
    },
    {
      type: 'checkbox',
      id: 'autoreconnect',
      label: 'Enable Auto Reconnect',
      default: true,
      tooltip: 'Automatically reconnect if the connection drops',
    },
    {
      type: 'number',
      id: 'discovery_timeout',
      label: 'Discovery Timeout (ms)',
      width: 6,
      min: 500,
      max: 5000,
      default: 1500,
      tooltip: 'Timeout for each discovery attempt (CPU/CON detection)',
    },

    {
      type: 'static-text',
      id: 'poll_header',
      label: 'Route Polling',
      value: 'Optional route polling can keep Companion feedbacks in sync with Draco OSD, keyboard macro, or external controller switching.',
    },
    {
      type: 'dropdown',
      id: 'poll_mode',
      label: 'Route Polling Mode',
      width: 6,
      default: 'off',
      choices: [
        { id: 'off', label: 'Disabled' },
        { id: 'per_con', label: 'Per-CON Polling' },
        { id: 'bulk', label: 'Bulk Polling' },
      ],
      tooltip: 'Bulk is faster but firmware-dependent. Per-CON is safer and polls only discovered CONs.',
    },
    {
      type: 'number',
      id: 'poll_interval',
      label: 'Polling Interval (seconds)',
      width: 6,
      min: 1,
      max: 30,
      default: 2,
      tooltip: 'How often to poll route state when polling is enabled',
    },
    {
      type: 'checkbox',
      id: 'smart_polling',
      label: 'Enable Smart Polling',
      default: false,
      tooltip: 'When enabled, only active CON IDs set by the Set Active CON IDs action are polled. If no active CONs are set, all discovered CONs are polled.',
    },
    {
      type: 'checkbox',
      id: 'poll_debug',
      label: 'Enable Poll Debug Logging',
      default: false,
      tooltip: 'Log route polling activity for troubleshooting',
    },

    {
      type: 'static-text',
      id: 'ext_status_header',
      label: 'EXT Status Feedbacks',
      value: 'EXT status feedbacks can show CPU/CON EXT status as green connected, red disconnected, or yellow not assigned. Use the manual Set CPU/CON EXT Status actions for testing until live EXT status packet decoding is added.',
    },
  ]
}

=======
function getConfigFields() {
  return [
    {
      type: 'textinput',
      id: 'host',
      label: 'Draco IP Address',
      width: 6,
      default: '',
      tooltip: 'Enter the IP address of the Draco system',
    },
    {
      type: 'textinput',
      id: 'port',
      label: 'Port',
      width: 4,
      default: '5555',
      regex: '/^\\d+$/',
      tooltip: 'TCP port used by Draco (default: 5555)',
    },
    {
      type: 'number',
      id: 'keepalive',
      label: 'Keepalive Interval (seconds)',
      width: 6,
      min: 1,
      max: 60,
      default: 5,
      tooltip: 'How often to send keepalive packets to maintain connection',
    },
    {
      type: 'number',
      id: 'switch_delay_ms',
      label: 'Global Switching Command Delay (ms)',
      width: 6,
      min: 0,
      max: 2000,
      default: 150,
      tooltip: 'Delay between route/switch commands sent to the Draco matrix. Useful when one button sends multiple route commands.',
    },
    {
      type: 'checkbox',
      id: 'autoreconnect',
      label: 'Enable Auto Reconnect',
      default: true,
      tooltip: 'Automatically reconnect if the connection drops',
    },
    {
      type: 'number',
      id: 'discovery_timeout',
      label: 'Discovery Timeout (ms)',
      width: 6,
      min: 500,
      max: 5000,
      default: 1500,
      tooltip: 'Timeout for each discovery attempt (CPU/CON detection)',
    },

    {
      type: 'static-text',
      id: 'poll_header',
      label: 'Route Polling',
      value: 'Optional route polling can keep Companion feedbacks in sync with Draco OSD, keyboard macro, or external controller switching.',
    },
    {
      type: 'dropdown',
      id: 'poll_mode',
      label: 'Route Polling Mode',
      width: 6,
      default: 'off',
      choices: [
        { id: 'off', label: 'Disabled' },
        { id: 'per_con', label: 'Per-CON Polling' },
        { id: 'bulk', label: 'Bulk Polling' },
      ],
      tooltip: 'Bulk is faster but firmware-dependent. Per-CON is safer and polls only discovered CONs.',
    },
    {
      type: 'number',
      id: 'poll_interval',
      label: 'Polling Interval (seconds)',
      width: 6,
      min: 1,
      max: 30,
      default: 2,
      tooltip: 'How often to poll route state when polling is enabled',
    },
    {
      type: 'checkbox',
      id: 'smart_polling',
      label: 'Enable Smart Polling',
      default: false,
      tooltip: 'When enabled, only active CON IDs set by the Set Active CON IDs action are polled. If no active CONs are set, all discovered CONs are polled.',
    },
    {
      type: 'checkbox',
      id: 'poll_debug',
      label: 'Enable Poll Debug Logging',
      default: false,
      tooltip: 'Log route polling activity for troubleshooting',
    },

    {
      type: 'static-text',
      id: 'ext_status_header',
      label: 'EXT Status Feedbacks',
      value: 'EXT status feedbacks can show CPU/CON EXT status as green connected, red disconnected, or yellow not assigned. Use the manual Set CPU/CON EXT Status actions for testing until live EXT status packet decoding is added.',
    },
  ]
}

>>>>>>> c9bb9d57ea048da1da1f06ec76eab3af7a8e05f0
module.exports = { getConfigFields }