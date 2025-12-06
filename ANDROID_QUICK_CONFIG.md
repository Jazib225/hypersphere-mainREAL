# Android App Quick Configuration Reference

## Essential Settings

### 1. Backend URL Configuration

**File**: `HceSender/app/src/main/java/com/example/hcesender/MainActivity.kt`

**Current Setting** (Line 73):
```kotlin
const val BACKEND_URL = "http://10.0.2.2:3001"  // For Android emulator
```

**Update Based on Your Setup:**

#### For Android Emulator:
```kotlin
const val BACKEND_URL = "http://10.0.2.2:3001"
```
- `10.0.2.2` is the special IP that emulator uses to access your computer's localhost

#### For Physical Device:
```kotlin
const val BACKEND_URL = "http://YOUR_COMPUTER_IP:3001"
```
- Replace `YOUR_COMPUTER_IP` with your computer's local IP address
- Find your IP: 
  - Windows: Run `ipconfig` and look for "IPv4 Address"
  - Mac/Linux: Run `ifconfig` or `ip addr`
  - Example: `http://192.168.1.100:3001`

#### For Network Testing:
```kotlin
const val BACKEND_URL = "http://YOUR_PUBLIC_IP:3001"
```
- Use if backend is deployed on a server

### 2. Android Studio Run Configuration

**Steps:**
1. Open Android Studio
2. Open project: `HceSender/` folder
3. Wait for Gradle sync
4. Go to `Run` → `Edit Configurations...`
5. Click `+` → `Android App`
6. Configure:
   - **Name**: `HceSender`
   - **Module**: `HceSender.app`
   - **Launch**: `Default Activity`
   - **Target**: Select your device/emulator

### 3. Device Selection

**Physical Device:**
- Enable Developer Options
- Enable USB Debugging
- Connect via USB
- Select device from dropdown

**Emulator:**
- Create AVD (Android Virtual Device)
- API Level: 21 or higher
- Device: Pixel 5 or similar
- System Image: Android 14 (API 34) recommended

### 4. Gradle Settings

**File**: `HceSender/gradle.properties`
```properties
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
kotlin.code.style=official
org.gradle.java.home=C:/Program Files/Android/Android Studio/jbr
```

**File**: `HceSender/local.properties`
```properties
sdk.dir=C\:\\Users\\jazib\\AppData\\Local\\Android\\Sdk
```
- Update path if your SDK is in a different location

### 5. Build Configuration

**File**: `HceSender/app/build.gradle`
- Already configured correctly
- Min SDK: 21
- Target SDK: 34
- Compile SDK: 34

### 6. Merchant ID

**File**: `HceSender/app/src/main/java/com/example/hcesender/MainActivity.kt`

**Current** (Line 69):
```kotlin
const val MERCHANT_ID = "4UznnYY4AMzAMss6AqeAvqUs5KeWYNinzKE2uFFQZ16U"
```

**Update if needed** to match your actual merchant wallet address.

### 7. Quick Checklist

Before running:
- [ ] Backend server running on port 3001
- [ ] Backend URL updated in MainActivity.kt
- [ ] Device/emulator connected
- [ ] Gradle sync completed
- [ ] No build errors
- [ ] NFC enabled (for physical device)

### 8. Testing Steps

1. **Start Backend**:
   ```powershell
   cd backend
   npm run dev
   ```

2. **Update Backend URL** in MainActivity.kt if using physical device

3. **Run Android App**:
   - Click green "Run" button in Android Studio
   - Or press `Shift+F10`

4. **Test Payment**:
   - Enter amount in app
   - Select chain (SOL/ETH/BASE)
   - Tap "Test Payment URL"
   - Should open wallet with payment request

### 9. Common Issues & Fixes

**Issue**: "Connection refused" or "Network error"
- **Fix**: Update BACKEND_URL to your computer's IP (for physical device)
- **Fix**: Ensure backend is running
- **Fix**: Check firewall settings

**Issue**: "SDK not found"
- **Fix**: Update `local.properties` with correct SDK path
- **Fix**: Install SDK via Android Studio SDK Manager

**Issue**: "Gradle sync failed"
- **Fix**: Check internet connection
- **Fix**: Invalidate caches: `File` → `Invalidate Caches / Restart`
- **Fix**: Clean project: `Build` → `Clean Project`

**Issue**: "NFC not working"
- **Fix**: Use physical device (emulator has limited NFC)
- **Fix**: Enable NFC in device settings
- **Fix**: Check NFC permissions in manifest

### 10. Recommended Settings Summary

| Item | Setting |
|------|---------|
| **Backend URL (Emulator)** | `http://10.0.2.2:3001` |
| **Backend URL (Physical)** | `http://YOUR_IP:3001` |
| **Min SDK** | 21 |
| **Target SDK** | 34 |
| **Java Version** | 11 or 17 |
| **Gradle JVM** | JDK 11/17 |
| **Device** | Physical (for NFC) or Emulator |

---

**Quick Start**: 
1. Update BACKEND_URL in MainActivity.kt
2. Run backend server
3. Connect device/emulator
4. Click Run in Android Studio

