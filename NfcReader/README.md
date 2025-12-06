# NfcReader - NFC Reader for Phantom URLs

This Android app reads NFC tags/cards using ISO-DEP protocol, extracts Phantom/Solana Pay URLs, and automatically opens them (launching the Phantom wallet app if installed).

## What It Does

- Reads NFC tags/cards via ISO-DEP
- Sends SELECT APDU commands to trigger HCE services
- Extracts URL from the NFC response
- Automatically opens the URL (launches Phantom or browser)

## Requirements

- Android 5.0+ (API 21+)
- Device with NFC support
- NFC enabled on device

## Building

See `ANDROID_SETUP_GUIDE.md` in the parent directory for complete setup instructions.

Quick build:
```bash
./gradlew assembleDebug
./gradlew installDebug
```

## Usage

1. Install the app on an Android device with NFC
2. Open the app
3. Keep the app in the foreground
4. Tap the device against an NFC card/tag or HCE sender (like the HceSender app)
5. The app will:
   - Display the received URL on screen
   - Automatically open the URL (launches Phantom if installed)

## Technical Details

- Uses Android's `NfcAdapter.enableReaderMode()` for NFC reading
- Communicates via ISO-DEP (ISO 14443-4) protocol
- Sends SELECT APDU: `00 A4 04 00`
- Strips trailing status bytes (`90 00`) from response
- Parses URL from UTF-8 encoded response bytes
- Opens URL via `Intent.ACTION_VIEW`

## Testing

Works with:
- HceSender app (HCE emulator)
- Physical NFC tags/cards (if they respond to SELECT APDU)
- Other HCE services that return URL data

