function getVariableDefinitions(conIds = []) {
  const definitions = [
    { variableId: 'connected', name: 'Matrix connected (1/0)' },
    { variableId: 'cpu_count', name: 'Discovered CPU count' },
    { variableId: 'con_count', name: 'Discovered CON count' },
    { variableId: 'last_cpu_id', name: 'Last routed CPU ID' },
    { variableId: 'last_con_id', name: 'Last routed CON ID' },
    { variableId: 'poll_mode_active', name: 'Active polling mode' },
  ]

  for (let id = 1; id <= 50; id += 1) {
    definitions.push({ variableId: `cpu_${id}_name`, name: `CPU ${id} name` })
  }

  const ids = [...new Set(conIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
    .sort((a, b) => a - b)

  for (const id of ids) {
    definitions.push(
      { variableId: `con_${id}_name`, name: `CON ${id} name` },
      { variableId: `con_${id}_active_cpu_name`, name: `CON ${id} active CPU name` },
      { variableId: `con_${id}_mode_name`, name: `CON ${id} route mode` }
    )
  }

  return definitions
}

module.exports = { getVariableDefinitions }
