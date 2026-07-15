# Companion Module: IHSE-DRACO

Bitfocus Companion module for controlling an IHSE Draco KVM matrix over TCP.

This module provides adaptive CPU/CON discovery, routing by ID or discovered name, route-status feedback, manual route-status refresh for active CONs, EXT connection-status feedbacks, radio/page latch feedbacks, and a global switching delay to protect the matrix from back-to-back switching commands.

---

## Current Version

```text
1.11.0
```

---

## Supported Use Cases

- Route a CPU to a CON in **Full**, **Video Only**, **Private Mode**, or **USB HID Control** mode.
- Route by typed CPU/CON ID, variable, or exact discovered name.
- Route by dropdown using discovered CPU and CON names.
- Show route status feedback for a specific CON.
- Show whether a specific CPU is currently routed to a specific CON.
- Show active CON route status by discovered CON name.
- Manually refresh route-status data for active CONs.
- Maintain button state using radio/page latch feedbacks.
- Show EXT connection status for CPUs and CONs using green/red/yellow feedbacks.
- Add a global delay between switching commands, useful for buttons that send multiple routes.

---

## Connection Settings

The module connects to the Draco matrix over TCP.

### Draco IP Address

```text
Config ID: host
```

The IP address of the Draco matrix.

Example:

```text
192.168.100.101
```

---

### Port

```text
Config ID: port
Default: 5555
```

The TCP port used by the Draco matrix.

---

### Keepalive Interval

```text
Config ID: keepalive
Default: 5
Range: 1-60 seconds
```

How often the module sends Draco keepalive packets to maintain the TCP connection.

---

### Global Switching Command Delay

```text
Config ID: switch_delay_ms
Default: 150
Range: 0-2000 ms
```

Adds a global delay between route/switch commands sent to the matrix.

This is especially useful when a single Companion/X-Keys button sends more than one route command, for example:

```text
CPU 16 -> CON 12001, Full
CPU 16 -> CON 12002, Video Only
```

Recommended values:

```text
150 ms - good starting point
250 ms - safer for slower or busy matrix systems
500 ms - use only if the matrix still needs more settling time
```

The delay applies to queued switch commands sent through the module's routing actions. It does not intentionally delay keepalive, discovery, or manual status polling.

---

### Enable Auto Reconnect

```text
Config ID: autoreconnect
Default: true
```

Future-facing setting for reconnect behavior if the TCP connection drops.

---

### Discovery Timeout

```text
Config ID: discovery_timeout
Default: 1500 ms
Range: 500-5000 ms
```

Timeout used for each adaptive discovery attempt.

---

## Route Polling Settings

### Route Polling Mode

```text
Config ID: poll_mode
Default: off
```

Options:

```text
off      Disabled
per_con  Per-CON Polling
bulk     Bulk Polling
```

Per-CON polling is safer and polls discovered or active CONs individually. Bulk polling is faster but depends on firmware support.

---

### Polling Interval

```text
Config ID: poll_interval
Default: 2 seconds
Range: 1-30 seconds
```

How often route polling should run when polling is enabled.

---

### Enable Smart Polling

```text
Config ID: smart_polling
Default: false
```

When enabled, polling can be limited to the active CON list set by the **Set Active CON IDs for Smart Polling** action.

If no active CON list is set, the module falls back to discovered CONs.

---

### Enable Poll Debug Logging

```text
Config ID: poll_debug
Default: false
```

Optional troubleshooting setting for route polling activity.

---

## EXT Status Feedback Settings

The EXT status feedback system supports color feedback for CPU and CON EXT connection state.

Colors:

```text
Green   connected
Red     disconnected
Yellow  not assigned / unknown
```

The module includes manual actions to set CPU/CON EXT status for testing feedback appearance. Live automatic EXT status decoding can be added once the Draco EXT status packet format is fully decoded for the target system.

---

## Discovery

On startup, the module performs adaptive discovery for CPUs and CONs.

Discovery populates:

- CPU ID/name map
- CON ID/name map
- CPU dropdown choices
- CON dropdown choices
- CPU name variables
- CON name/status variables

Discovery uses adaptive request formats:

```text
legacy7
generic5
```

A manual discovery update can be run with the **Manual ID Update** action.

---

## Actions

### Route CPU to CON

Routes a CPU to a CON using text fields.

Action fields:

```text
CPU   CPU ID, variable, or exact discovered CPU name
CON   CON ID, variable, or exact discovered CON name
Mode  Full / Video Only / Private Mode / USB HID Control
```

This action validates inputs before sending. Blank, unresolved, zero, negative, or invalid endpoint IDs are rejected.

The action logs the resolved command before sending:

```text
Sending route command: CPU=16, CON=12001, MODE=0
```

Mode values:

```text
0  Full
1  Video Only
2  Private Mode
3  USB HID Control
```

---

### Route CPU to CON (by name)

Routes using dropdowns populated by discovery.

Fields:

```text
CPU dropdown
CON dropdown
Mode dropdown
```

This is usually the safest routing action when discovery is working because it avoids typing incorrect numeric IDs.

---

### Manual ID Update

Runs adaptive CPU/CON discovery again.

Use this when:

- CPU or CON names are missing
- dropdowns are empty
- matrix configuration changed
- Companion was started before the matrix was ready

---

### Update Active CON Route Status

Manually polls the route status for active CONs.

If an active CON list has been set, only those CONs are queried.

If no active CON list has been set, all discovered CONs are queried.

This action does **not** route anything. It only asks the matrix for current status and updates Companion variables/feedbacks from the response.

---

### Set Active CON IDs for Smart Polling

Sets the active CON list used by manual route updates and smart polling.

Example:

```text
12001,12002,14001,14002
```

Recommended use:

- Add this action to a setup page.
- Set only the CONs that matter for the current show/page/control surface.
- Use **Update Active CON Route Status** to refresh only those CONs.

---

### Select Radio Button

Stores a selected button ID in a group.

Fields:

```text
Group Name
Button ID
```

Used with radio/page latch feedbacks to show active page or active selection state.

---

### Set CPU EXT Status

Manual/test action for EXT status feedbacks.

Fields:

```text
CPU ID
Status: connected / disconnected / not assigned
```

This action updates CPU EXT status feedbacks.

---

### Set CON EXT Status

Manual/test action for EXT status feedbacks.

Fields:

```text
CON ID
Status: connected / disconnected / not assigned
```

This action updates CON EXT status feedbacks.

---

## Feedbacks

### Matrix Connection Status

Feedback ID:

```text
connection_status
```

Shows whether TCP connection to the matrix is active.

Default active style:

```text
Green
```

---

### Radio Button (Per Page/Group)

Feedback ID:

```text
radio_page
```

Shows active/inactive state based on a matching group and button ID.

Colors:

```text
Red    active
Black  inactive
```

---

### Page Latch (red active / black inactive)

Feedback ID:

```text
page_latch_red_black
```

Same style behavior as radio button feedback, intended for page/button latching.

Colors:

```text
Red    active
Black  inactive
```

---

### CON Connection Status Color

Feedback ID:

```text
route_status
```

Shows route status for a specific CON ID or variable.

Input:

```text
CON ID/Var
```

Colors:

```text
Blue    disconnected / no route
Green   Full
Yellow  Video Only
Orange  Private Mode
Purple  USB HID Control
```

---

### Route Status (by name)

Feedback ID:

```text
route_status_by_name
```

Shows active only when a selected CPU is routed to a selected CON.

Inputs:

```text
CPU dropdown
CON dropdown
```

Uses the same route mode colors as `route_status`.

---

### CON Status (by name)

Feedback ID:

```text
con_status_by_name
```

Shows the current status of a selected CON from a dropdown.

Input:

```text
CON dropdown
```

Uses the same route mode colors as `route_status`.

---

### CPU EXT Connection Status

Feedback ID:

```text
cpu_ext_status
```

Input:

```text
CPU ID/Var
```

Colors:

```text
Green   connected
Red     disconnected
Yellow  not assigned / unknown
```

---

### CON EXT Connection Status

Feedback ID:

```text
con_ext_status
```

Input:

```text
CON ID/Var
```

Colors:

```text
Green   connected
Red     disconnected
Yellow  not assigned / unknown
```

---

### CPU EXT Connection Status (by name)

Feedback ID:

```text
cpu_ext_status_by_name
```

Input:

```text
CPU dropdown
```

Colors:

```text
Green   connected
Red     disconnected
Yellow  not assigned / unknown
```

---

### CON EXT Connection Status (by name)

Feedback ID:

```text
con_ext_status_by_name
```

Input:

```text
CON dropdown
```

Colors:

```text
Green   connected
Red     disconnected
Yellow  not assigned / unknown
```

---

## Variables

Variable names use the Companion instance label as the prefix.

Example:

```text
$(draco-kvm-ejn:connected)
```

Your actual prefix may differ if the instance has a custom label.

---

### Core Variables

```text
connected
```

Value:

```text
1 = connected
0 = disconnected
```

---

```text
cpu_count
```

Number of discovered CPUs.

---

```text
con_count
```

Number of discovered CONs.

---

```text
last_cpu_id
```

Last CPU ID updated through route state.

---

```text
last_con_id
```

Last CON ID updated through route state.

---

```text
poll_mode_active
```

Current active polling mode displayed as uppercase text.

Examples:

```text
OFF
PER_CON
BULK
```

---

### CPU Name Variables

CPU name variables use this pattern:

```text
cpu_<id>_name
```

Examples:

```text
cpu_1_name
cpu_2_name
cpu_16_name
```

Example reference:

```text
$(draco-kvm-ejn:cpu_16_name)
```

Note: fixed CPU name variables are typically created for CPU IDs 1-50.

---

### CON Variables

CON variables are generated from discovered CON IDs.

Pattern:

```text
con_<id>_name
con_<id>_active_cpu_name
con_<id>_mode_name
```

Examples:

```text
con_12001_name
con_12001_active_cpu_name
con_12001_mode_name
```

Example references:

```text
$(draco-kvm-ejn:con_12001_name)
$(draco-kvm-ejn:con_12001_active_cpu_name)
$(draco-kvm-ejn:con_12001_mode_name)
```

---

## Safe Routing Recommendations

### Full Mode

Full mode can move or release CPU/CON ownership on the Draco matrix.

Use Full mode only with verified control/operator CONs.

If the matrix syslog shows:

```text
Con-Port=0
```

for a Full route, do not use that CON for Full mode.

---

### Video Only Mode

Video Only is generally safer for display/monitor destinations.

A common two-command workflow:

```text
CPU 16 -> CON 12001, Full
Delay 150-250 ms
CPU 16 -> CON 12002, Video Only
```

---

### Global Switching Delay

If a single button sends multiple route commands, use:

```text
Global Switching Command Delay (ms): 150
```

Increase to:

```text
250
```

if the matrix still needs more time between route commands.

---

## Wireshark Verification

Route packets are 11 bytes and start with:

```text
1B 5B 62 0B 00
```

Format:

```text
1B 5B 62 0B 00 CPUlo CPUhi CONlo CONhi MODElo MODEhi
```

Example: CPU 16 to CON 12001, Full:

```text
1B 5B 62 0B 00 10 00 E1 2E 00 00
```

Example: CPU 16 to CON 12002, Video Only:

```text
1B 5B 62 0B 00 10 00 E2 2E 01 00
```

If a packet contains:

```text
81 3E
```

that is CON `16001`, not CON `12001`.

---

## Draco Syslog Verification

A valid Full route should resolve to a real CON port:

```text
swConnectCpuCon(): Cpu-Port=16 Con-Port=33
```

A bad Full route may show:

```text
swConnectCpuCon(): Cpu-Port=16 Con-Port=0
msSetOutputPort(): OUT=16 IN=0
```

Avoid using CON IDs that resolve to `Con-Port=0` for Full mode.

---

## Development Notes

Recommended local checks before building:

```powershell
node -c src\index.js
node -c src\main.js
node -c src\protocol.js
node -c src\actions.js
node -c src\feedbacks.js
node -c src\config.js
node -c src\variables.js
```

Build:

```powershell
npm run build
```

---

## Known Notes

- EXT status feedbacks currently support manual state testing.
- Live automatic EXT status decoding requires mapping Draco EXT status response packets to CPU/CON IDs and state values.
- Route polling/manual route update depends on Draco support for the queried status command.

---

## License

MIT
