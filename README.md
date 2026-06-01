# Cell Seeding Calculator

A standalone web app for planning cell culture seeding experiments. Pick your cell line, vessel, and confluence targets — get the cell count, volume to seed, and growth projection.

## Usage

Open **`index.html`** in any modern browser. No build step, no dependencies, no server required.

### Calculator Tab

1. **Select a cell line** — U2OS, HEK293, or HeLa
2. **Enter parameters** — viable cell concentration, viability, start and end confluence
3. **Pick a vessel** — modal sheet with 11 vessel types (35 mm dish through 1536-well plate)
4. **Calculate** — results show cells needed, volume to seed, cells@end, vessel details, and growth projection (doublings, hours, confluence after incubation)

### Settings Tab

- **Edit cell parameters** — HeLa reference diameter, cell diameter, doubling time, planned incubation time (tap a value to edit, confirm with ✓ or Enter)
- **Apply** — persists changes to `localStorage`
- **Reset** — restores factory defaults
- **Vessel reference** — read-only table of all 11 vessels with catalog numbers, surface areas, medium volumes, and cells at 100% confluence

## How It Works

| Step | Formula |
|---|---|
| Size correction factor | (HeLa ref. diameter ÷ cell diameter)² |
| Cells at 100% | vessel reference × factor |
| Cells needed | cells@100% × start confluence |
| Volume to seed | (cells needed ÷ viable conc. ÷ viability) × 1000 |
| Cells at end | cells@100% × end confluence |
| Doublings needed | log₂(end % ÷ start %) |
| Hours needed | doublings × doubling time |
| Confluence after incubation | start% × 2^(incubation ÷ doubling time) |

All reference data matches **Thermo Fisher Cell_Seeding_Calculator-3.xlsx**.

## Project Structure

```
├── index.html    # HTML markup (single-page app shell)
├── styles.css    # All styles (Apple-inspired design system)
├── script.js     # Constants, logic, state, DOM rendering, events
└── README.md
```

## Data Sources

- Vessel reference data (catalog numbers, surface areas, cells/100% confluence, medium volumes) from Thermo Fisher Scientific
- Default cell diameters: U2OS ~20 µm, HEK293 ~13 µm, HeLa ~18 µm
- Default doubling times: U2OS ~24 h, HEK293 ~24 h, HeLa ~20 h

## License

MIT
