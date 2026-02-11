# Changelog

## Unreleased

- Added two new **3D highway** settings under View → 3D Settings:
  - `Camera Height` (default `0.50`, range `0.25`–`1.25`) to shift the 3D horizon/vanishing setup for flatter or steeper perspective.
  - `Highway Length` (default `100u`, range `40u`–`280u`) to control spatial draw distance for highway rendering and 3D note culling.
- `Lookahead` remains a timing/scheduling control; rendering now also applies spatial culling based on `Highway Length`.
- Performance note: lane geometry remains memoized and is only rebuilt when relevant perspective settings change.
