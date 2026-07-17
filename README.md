# Supermarket Empire

HTML5 idle tycoon clicker made with Phaser 3, JavaScript ES Modules and Vite.

## Run locally

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```

## Gameplay

- Move with `WASD` on desktop or the on-screen joystick on mobile.
- Use the restock menu to refill each display shelf to maximum stock or as far as current money allows.
- Customers enter the store, take products from shelves and pay at self-checkout terminals.
- Locked product rows can be opened from their shelf buttons, then refilled with product-specific purchase prices.

## Yandex Games integration

The project includes a Yandex Games SDK adapter in `src/yandex/YandexSDK.js`.

- Loads the platform SDK from `/sdk.js` when available.
- Calls `LoadingAPI.ready()` when game loading is complete.
- Calls `GameplayAPI.start()` when gameplay starts and `GameplayAPI.stop()` while ads are open.
- Uses `ysdk.adv.showFullscreenAdv()` for fullscreen ads between in-game days.
- Uses `ysdk.adv.showRewardedVideo()` for rewarded money bonuses.
- Falls back to a local mock mode during development outside Yandex Games.

Balance data lives in `src/data/balance.json`.
