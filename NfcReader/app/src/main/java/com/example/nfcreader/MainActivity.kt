package com.example.nfcreader

import android.app.Activity
import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.net.Uri
import androidx.appcompat.app.AppCompatActivity
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import com.example.nfcreader.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var nfcAdapter: NfcAdapter? = null

    companion object {
        private const val TAG = "NfcReader"
        // SELECT APDU with AID to trigger the HCE service
        // Format: CLA INS P1 P2 Lc [AID] Le
        // 00 A4 04 00 07 F0010203040506 00
        private val SELECT_APDU = byteArrayOf(
            0x00.toByte(),  // CLA
            0xA4.toByte(),  // INS (SELECT)
            0x04.toByte(),  // P1 (Select by name)
            0x00.toByte(),  // P2
            0x07.toByte(),  // Lc (Length of AID)
            0xF0.toByte(), 0x01.toByte(), 0x02.toByte(), 0x03.toByte(), 0x04.toByte(), 0x05.toByte(), 0x06.toByte(), // AID
            0x00.toByte()   // Le (Expected length, 0 = maximum)
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        nfcAdapter = NfcAdapter.getDefaultAdapter(this)
        if (nfcAdapter == null) {
            binding.statusText.text = "NFC is not available on this device."
        } else {
            binding.statusText.text = "NFC Reader ready.\nTap this phone against the HCE Sender."
        }
    }

    override fun onResume() {
        super.onResume()
        enableReaderMode()
    }

    override fun onPause() {
        super.onPause()
        disableReaderMode()
    }

    private fun enableReaderMode() {
        val adapter = nfcAdapter ?: return

        adapter.enableReaderMode(
            this as Activity,
            { tag: Tag? ->
                if (tag == null) {
                    Log.e(TAG, "Null tag received")
                    return@enableReaderMode
                }
                handleTag(tag)
            },
            NfcAdapter.FLAG_READER_NFC_A or
                    NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
            null
        )
        Log.d(TAG, "Reader mode enabled")
    }

    private fun disableReaderMode() {
        nfcAdapter?.disableReaderMode(this)
        Log.d(TAG, "Reader mode disabled")
    }

    private fun handleTag(tag: Tag) {
        try {
            val isoDep = IsoDep.get(tag)
            if (isoDep == null) {
                Log.e(TAG, "IsoDep not supported by this tag")
                runOnUiThread {
                    Toast.makeText(this, "Tag is not IsoDep", Toast.LENGTH_SHORT).show()
                }
                return
            }

            isoDep.connect()
            isoDep.timeout = 5000 // 5 second timeout
            Log.d(TAG, "Connected to IsoDep tag")
            Log.d(TAG, "Sending SELECT APDU: ${SELECT_APDU.toHexString()}")

            val response = isoDep.transceive(SELECT_APDU)
            isoDep.close()

            Log.d(TAG, "Received response length: ${response.size}")
            Log.d(TAG, "Received response hex: ${response.toHexString()}")
            Log.d(TAG, "Response as string (raw): ${String(response, Charsets.UTF_8)}")

            // Strip off trailing 90 00 if present
            val payload = if (response.size > 2 &&
                response[response.size - 2] == 0x90.toByte() &&
                response[response.size - 1] == 0x00.toByte()
            ) {
                response.copyOfRange(0, response.size - 2)
            } else {
                response
            }

            // Convert to string and clean it up
            var url = String(payload, Charsets.UTF_8)
            
            // Remove null bytes and other control characters
            url = url.replace("\u0000", "")
            // Trim whitespace
            url = url.trim()
            // Remove any trailing status codes that might have been parsed as text
            url = url.replace(Regex("90\\s*00$"), "").trim()
            
            Log.d(TAG, "Raw payload length: ${payload.size}")
            Log.d(TAG, "Cleaned URL: '$url'")
            Log.d(TAG, "URL length: ${url.length}")

            runOnUiThread {
                binding.statusText.text = "Received URL:\n$url"
            }

            // Validate URL before opening
            if (url.isBlank() || url.length < 10) {
                Log.e(TAG, "URL is invalid after parsing: '$url'")
                runOnUiThread {
                    Toast.makeText(this, "Error: Received invalid URL: '$url'", Toast.LENGTH_LONG).show()
                }
                return
            }

            // Open URL via Intent.ACTION_VIEW
            openUrl(url)
        } catch (e: Exception) {
            Log.e(TAG, "Error handling tag", e)
            runOnUiThread {
                Toast.makeText(this, "Error: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    /**
     * Open URL via Intent.ACTION_VIEW
     */
    private fun openUrl(url: String) {
        try {
            Log.d(TAG, "Opening URL: $url")
            
            val uri = Uri.parse(url)
            
            // Verify URI is valid
            if (uri.scheme == null) {
                throw IllegalArgumentException("Invalid URI: scheme is null")
            }
            
            Log.d(TAG, "Parsed URI - scheme: ${uri.scheme}, host: ${uri.host}, path: ${uri.path}")
            
            // Create intent to open URL
            val intent = Intent(Intent.ACTION_VIEW, uri)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            intent.addCategory(Intent.CATEGORY_BROWSABLE)
            intent.addCategory(Intent.CATEGORY_DEFAULT)
            
            startActivity(intent)
            
            Log.d(TAG, "URL opened successfully")
            
            // Determine which wallet app based on URL scheme
            val walletApp = when (uri.scheme) {
                "solana" -> "Phantom"
                "ethereum" -> "MetaMask"
                else -> "wallet app"
            }
            
            runOnUiThread {
                Toast.makeText(this, "Opening in $walletApp...", Toast.LENGTH_SHORT).show()
            }
        } catch (e: android.content.ActivityNotFoundException) {
            Log.e(TAG, "No app found to handle URL: ${e.message}")
            
            // Determine which wallet app is needed based on URL scheme
            val uri = Uri.parse(url)
            val walletApp = when (uri.scheme) {
                "solana" -> "Phantom wallet"
                "ethereum" -> "MetaMask wallet"
                else -> "wallet app"
            }
            
            runOnUiThread {
                Toast.makeText(this, "No app found to open URL. Please install $walletApp.", Toast.LENGTH_LONG).show()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error opening URL: $url", e)
            runOnUiThread {
                Toast.makeText(this, "Error opening URL: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }
}

private fun ByteArray.toHexString(): String =
    joinToString(" ") { String.format("%02X", it) }

