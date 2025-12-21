# iOS

AFFiNE iOS app.

## Build

- `bun install`
- `BUILD_TYPE=canary PUBLIC_PATH="/" bun affine @affine/ios build`
- `bun affine @affine/ios cap sync`
- `bun affine @affine/ios cap open ios`

## Live Reload

> Capacitor doc: https://capacitorjs.com/docs/guides/live-reload#using-with-framework-clis

- `bun install`
- `bun dev`
  - select `ios` for the "Distribution" option
- `bun affine @affine/ios sync:dev`
- `bun affine @affine/ios cap open ios`
