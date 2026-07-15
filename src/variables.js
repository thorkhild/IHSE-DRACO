<<<<<<< HEAD
function getVariableDefinitions(discoveredConIds = []) {
  const vars = [
    { variableId: 'connected', name: 'Connected (1/0)' },
    { variableId: 'cpu_count', name: 'CPU count discovered' },
    { variableId: 'con_count', name: 'CON count discovered' },
    { variableId: 'last_cpu_id', name: 'Last routed CPU ID' },
    { variableId: 'last_con_id', name: 'Last routed CON ID' },
  ]

  // --------------------------------------------------
  // CPU variables: fixed range 1-50 only
  // --------------------------------------------------
  for (let i = 1; i <= 50; i++) {
    vars.push({ variableId: `cpu_${i}_name`, name: `CPU ${i} name` })
  }

  // --------------------------------------------------
  // CON variables: only for discovered CON IDs
  // --------------------------------------------------
  const uniqueConIds = [...new Set(discoveredConIds)]
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => a - b)

  for (const id of uniqueConIds) {
    vars.push({ variableId: `con_${id}_name`, name: `CON ${id} name` })
    vars.push({ variableId: `con_${id}_active_cpu_name`, name: `CON ${id} active CPU name` })
    vars.push({ variableId: `con_${id}_mode_name`, name: `CON ${id} route mode name` })
  }

  return vars
}

=======
function getVariableDefinitions(discoveredConIds = []) {
  const vars = [
    { variableId: 'connected', name: 'Connected (1/0)' },
    { variableId: 'cpu_count', name: 'CPU count discovered' },
    { variableId: 'con_count', name: 'CON count discovered' },
    { variableId: 'last_cpu_id', name: 'Last routed CPU ID' },
    { variableId: 'last_con_id', name: 'Last routed CON ID' },
  ]

  // --------------------------------------------------
  // CPU variables: fixed range 1-50 only
  // --------------------------------------------------
  for (let i = 1; i <= 50; i++) {
    vars.push({ variableId: `cpu_${i}_name`, name: `CPU ${i} name` })
  }

  // --------------------------------------------------
  // CON variables: only for discovered CON IDs
  // --------------------------------------------------
  const uniqueConIds = [...new Set(discoveredConIds)]
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => a - b)

  for (const id of uniqueConIds) {
    vars.push({ variableId: `con_${id}_name`, name: `CON ${id} name` })
    vars.push({ variableId: `con_${id}_active_cpu_name`, name: `CON ${id} active CPU name` })
    vars.push({ variableId: `con_${id}_mode_name`, name: `CON ${id} route mode name` })
  }

  return vars
}

>>>>>>> c9bb9d57ea048da1da1f06ec76eab3af7a8e05f0
module.exports = { getVariableDefinitions }