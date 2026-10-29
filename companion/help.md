# IHSE DRACO

Configure the matrix IP address and TCP port, then use adaptive discovery to populate CPU and CON choices.

## Routing

Route by ID, variable, exact discovered name, or dropdown. Modes: Full, Video Only, Private, and USB HID Control.

## Global switching delay

Start with 150 ms when a button sends multiple route commands.

## Feedback colors

Route: blue disconnected, green Full, yellow Video Only, orange Private, purple USB HID Control.

EXT: green connected, red disconnected, yellow not assigned. EXT state is currently manual/test state.

## Variables

Core: connected, cpu_count, con_count, last_cpu_id, last_con_id, poll_mode_active.

CPU: cpu_<id>_name.

CON: con_<id>_name, con_<id>_active_cpu_name, con_<id>_mode_name.
