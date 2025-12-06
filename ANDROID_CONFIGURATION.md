# Android App Configuration Guide

## Required Settings for Running the Android Apps

### 1. Android Studio Settings

#### SDK Location
- **SDK Location**: `C:\Users\jazib\AppData\Local\Android\Sdk` (already set in `local.properties`)
- If different, update `HceSender/local.properties` and `android/local.properties`

#### JDK Settings
- **JDK Version**: JDK 11 or JDK 17 (recommended)
- **JDK Location**: 
  - Default: `C:/Program Files/Android/Android Studio/jbr` (already set in `gradle.properties`)
  - Or: `C:/Program Files/Java/jdk-11` or `C:/Program Files/Java/jdk-17`

#### Gradle Settings
- **Gradle Version**: Use Gradle wrapper (automatically managed)
- **Gradle JVM**: JDK 11 or 17
- **Build Tools**: Automatically downloaded

### 2. Project Structure

You have **two Android projects**:

#### A. HceSender (NFC Payment Sender)
- **Location**: `HceSender/`
- **Package**: `com.example.hcesender`
- **Min SDK**: 21 (Android 5.0)
- **Target SDK**: 34 (Android 14)
- **Compile SDK**: 34

#### B. TapToPayMerchant (Alternative)
- **Location**: `android/`
- **Package**: `com.solana.taptopay`
- **Min SDK**: 21
- **Target SDK**: 34
- **Compile SDK**: 34

### 3. Build Configuration

#### For HceSender Project:

**File: `HceSender/app/build.gradle`**
```gradle
android {
    compileSdk 34
    
    defaultConfig {
        applicationId "com.example.hcesender"
        minSdk 21
        targetSdk 34
        versionCode 1
        versionName "1.0"
    }
    
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_11
        targetCompatibility JavaVersion.VERSION_11
    }
    
    kotlinOptions {
        jvmTarget = '11'
    }
}
```

**File: `HceSender/gradle.properties`**
```properties
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
kotlin.code.style=official
org.gradle.java.home=C:/Program Files/Android/Android Studio/jbr
```

**File: `HceSender/local.properties`**
```properties
sdk.dir=C\:\\Users\\jazib\\AppData\\Local\\Android\\Sdk
```

### 4. Run Configuration in Android Studio

#### Creating Run Configuration:

1. **Open Project**: Open `HceSender/` folder in Android Studio
2. **Sync Gradle**: Click "Sync Now" if prompted
3. **Create Run Configuration**:
   - Go to `Run` → `Edit Configurations...`
   - Click `+` → `Android App`
   - **Name**: `HceSender`
   - **Module**: `HceSender.app`
   - **Launch**: `Default Activity`
   - **Target**: `USB Device` or `Emulator`

#### Device/Emulator Settings:

**For Physical Device:**
- Enable **USB Debugging** on your Android device
- Connect via USB
- Select device from dropdown

**For Emulator:**
- **API Level**: 21 or higher (Android 5.0+)
- **Device**: Pixel 5 or similar
- **System Image**: Latest Android (API 34 recommended)
- **Enable NFC**: In emulator settings (Extended Controls → NFC)

### 5. Required Permissions

Already configured in `AndroidManifest.xml`:
- ✅ `android.permission.NFC` - For NFC functionality
- ✅ `android.permission.INTERNET` - For network requests
- ✅ `android.hardware.nfc` - Required hardware feature

### 6. Backend Connection

The app needs to connect to your backend server:

**Default Backend URL**: `http://localhost:3001`

**For Physical Device Testing:**
- Use your computer's IP address instead of `localhost`
- Example: `http://192.168.1.100:3001`
- Find your IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)

**Update in Code:**
- Check `MainActivity.kt` or `PaymentCardService.kt` for backend URL configuration
- Update to your actual backend IP address

### 7. Gradle Sync Checklist

Before running, ensure:
- ✅ Gradle sync completed successfully
- ✅ All dependencies downloaded
- ✅ No build errors
- ✅ SDK platforms installed (API 21-34)
- ✅ Build tools installed

### 8. Common Configuration Issues

#### Issue: "SDK location not found"
**Solution**: Update `local.properties` with correct SDK path:
```properties
sdk.dir=C\:\\Users\\jazib\\AppData\\Local\\Android\\Sdk
```

#### Issue: "JDK not found"
**Solution**: Update `gradle.properties`:
```properties
org.gradle.java.home=C:/Program Files/Android/Android Studio/jbr
```

#### Issue: "Gradle sync failed"
**Solution**: 
- Check internet connection
- Invalidate caches: `File` → `Invalidate Caches / Restart`
- Clean project: `Build` → `Clean Project`

#### Issue: "NFC not working on emulator"
**Solution**: 
- Use physical device for NFC testing
- Or enable NFC in emulator extended controls

### 9. Recommended Settings Summary

| Setting | Value |
|---------|-------|
| **Min SDK** | 21 (Android 5.0) |
| **Target SDK** | 34 (Android 14) |
| **Compile SDK** | 34 |
| **Java Version** | 11 or 17 |
| **Kotlin Version** | 1.9.0 |
| **Gradle JVM** | JDK 11/17 |
| **Build Tools** | Latest (auto) |
| **Gradle Version** | Wrapper (auto) |

### 10. Quick Start Steps

1. **Open Project**: Open `HceSender/` in Android Studio
2. **Sync Gradle**: Wait for sync to complete
3. **Connect Device**: Enable USB debugging and connect device
4. **Select Device**: Choose from device dropdown
5. **Run**: Click green "Run" button or press `Shift+F10`
6. **Check Backend**: Ensure backend is running on `http://localhost:3001`

### 11. Testing NFC Functionality

**Requirements:**
- Physical Android device with NFC (emulator has limited NFC support)
- NFC enabled in device settings
- Backend server running
- Device and backend on same network (or use device IP)

**Test Flow:**
1. Open HceSender app
2. Set payment amount
3. Select chain (SOL/ETH/BASE)
4. Tap "Test Payment URL" or use NFC reader to scan
5. Should open wallet app with payment request

---

## For the `android/` Project (Alternative)

Same configuration applies, but:
- **Package**: `com.solana.taptopay`
- **Location**: `android/` folder
- Open `android/` folder in Android Studio instead

---

**Note**: Make sure your backend is running before testing the Android app, as it needs to communicate with the server for payment intents.

