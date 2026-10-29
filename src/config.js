function getConfigFields() {
  return [
    {
      type: 'textinput',
      id: 'host',
      label: 'Draco IP Address',
      width: 6,
      default: '',
      tooltip: 'IP address of the IHSE Draco matrix.',
    },
    {
      type: 'textinput',
      id: 'port',
      label: 'TCP Port',
      width: 3,
      default: '5555',
      regex: '/^\\d+$/',
    },
    {
      type: 'number',
      id: 'keepalive',
      label: 'Keepalive Interval (seconds)',
      width: 3,
      min: 1,
      max: 60,
      default: 5,
    },
    {
      type: 'number',
      id: 'switch_delay_ms',
      label: 'Global Switching Command Delay (ms)',
      width: 6,
      min: 0,
      max: 2000,
      default: 150,
      tooltip: 'Minimum spacing between queued route commands.',
    },
    {
      type: 'checkbox',
      id: 'autoreconnect',
      label: 'Enable Auto Reconnect',
      width: 3,
      default: true,
    },
    {
      type: 'number',
      id: 'reconnect_delay',
      label: 'Reconnect Delay (seconds)',
      width: 3,
      min: 1,
      max: 60,
      default: 5,
    },
    {
      type: 'number',
      id: 'discovery_timeout',
      label: 'Discovery Timeout (ms)',
      width: 6,
      min: 500,
      max: 5000,
      default: 1500,
    },
    {
      type: 'checkbox',
      id: 'enable_experimental_status_query',
      label: 'Enable Experimental Per-CON Status Query',
      width: 6,
      default: false,
      tooltip: 'Enable only after confirming support on the target Draco firmware.',
    },
  ]
}

module.exports = { getConfigFields }
