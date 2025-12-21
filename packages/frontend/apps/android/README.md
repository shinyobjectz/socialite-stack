# Android

AFFiNE Android app.

## Setup

- set CARGO_HOME to your system environment
- add

  `rust.cargoCommand={replace_with_your_own_cargo_home_absolute_path}/bin/cargo`

  `rust.rustcCommand={replace_with_your_own_cargo_home_absolute_path}/bin/rustc`

  to App/local.properties

## Build

- bun install
- BUILD_TYPE=canary PUBLIC_PATH="/" bun affine @affine/android build
- bun affine @affine/android cap sync
- bun affine @affine/android cap open android
