# HceSender - NFC HCE Card Emulator

This Android app emulates an NFC card using Host Card Emulation (HCE) and returns a Phantom/Solana Pay URL when read by an NFC reader.

## What It Does

- Acts as an NFC card emulator
- Responds to NFC SELECT APDU commands
- Returns a Phantom/Solana Pay URL encoded in the response
- Works with any NFC reader that can communicate via ISO-DEP

## Configuration

Before building, update the Phantom URL in `app/src/main/java/com/example/hcesender/PaymentCardService.kt`:

```kotlin
val phantomUrl = "https://phantom.app/ul/v1/transfer?to=YOUR_SOL_ADDRESS&amount=0.01&network=mainnet-beta"
```

Replace:
- `YOUR_SOL_ADDRESS` with your Solana wallet address
- `amount` with desired SOL amount
- `network` with `mainnet-beta` or `devnet`

## Requirements

- Android 5.0+ (API 21+)
- Device with NFC and HCE support
- NFC enabled on device

## Building

See `ANDROID_SETUP_GUIDE.md` in the parent directory for complete setup instructions.

Quick build:
```bash
./gradlew assembleDebug
./gradlew installDebug
```

## Usage

1. Install the app on an Android device with HCE support
2. Open the app
3. Keep the app running (or minimize, but don't force close)
4. Unlock the device screen
5. Tap the device with an NFC reader (like the NfcReader app)
6. The reader will receive the Phantom URL

## Technical Details

- Uses Android's `HostApduService` for HCE
- Responds to SELECT APDU commands
- Returns URL as UTF-8 bytes followed by status code `90 00`
- AID filter: `F0010203040506` (defined in `res/xml/apdu_service.xml`)

