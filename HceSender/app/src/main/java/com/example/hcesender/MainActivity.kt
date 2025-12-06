package com.example.hcesender

import android.app.AlertDialog
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.text.InputType
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.animation.OvershootInterpolator
import android.util.Log
import android.net.Uri
import android.widget.Toast
import com.example.hcesender.databinding.ActivityMainBinding
import java.text.NumberFormat
import java.util.Locale
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.util.UUID
import kotlin.concurrent.thread
import kotlin.math.round
import java.math.BigDecimal
import java.math.BigInteger

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var currentState = PaymentState.IDLE
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var nfcScanReceiver: BroadcastReceiver
    
    private var baseAmount = 0.0
    private var tipPercentage = 0
    private var tipAmount = 0.0
    private var totalAmount = 0.0
    
    // Transaction deduplication: track last processed transaction
    private var lastProcessedTransactionHash: String? = null
    private var lastProcessedTimestamp: Long = 0
    private var isProcessingPayment = false // Gate to prevent concurrent processing
    
    private enum class Chain {
        ETH, SOL, BASE
    }
    private var selectedChain = Chain.SOL // Default to Solana
    private var currentMerchantWallet = MERCHANT_WALLET // Will be updated based on chain
    private val cctpService = CCTPService()

    companion object {
        const val PREFS_NAME = "hce_sender_prefs"
        const val KEY_RECIPIENT = "recipient"
        const val KEY_AMOUNT = "amount"
        const val KEY_TOTAL_USDC_AMOUNT = "total_usdc_amount"  // Total amount including tip
        const val KEY_CHAIN = "selected_chain"
        const val KEY_MERCHANT_BASE_WALLET = "merchant_base_wallet"
        const val KEY_MERCHANT_ETH_WALLET = "merchant_eth_wallet"
        const val TAG = "MainActivity"
        
        // Default EVM merchant wallet addresses (fallback if not set in preferences)
        private const val DEFAULT_BASE_WALLET = "0x7063948e82549732aF860b2095918669c37C4351"
        private const val DEFAULT_ETH_WALLET = "0x7063948e82549732aF860b2095918669c37C4351"

        // Merchant ID (used for API calls - should match frontend)
        const val MERCHANT_ID = "4UznnYY4AMzAmss6AqeAvqUs5KeWYNinzKE2uFFQZ16U"
        // Default merchant wallet (fallback if wallet address not found)
        const val MERCHANT_WALLET = "2Qw4fFW9MeKvJXPVfMWX6X324PaX8aAA8B9J2Xnv8PBF"
        const val DEFAULT_AMOUNT = "0.01"
        
        // Backend API endpoint (update this with your actual backend URL)
        // Use 10.0.2.2 for Android emulator, or your computer's local IP for real device
        const val BACKEND_URL = "http://172.20.3.86:3001" // Your computer's local IP for real phone
    }

    enum class PaymentState {
        IDLE, PROCESSING, SUCCESS
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Load amount from SharedPreferences and display it
        loadAndDisplayAmount()
        
        // Fetch wallet address for the initially selected chain
        fetchWalletAddressForChain(selectedChain)

        // Set up amount text click listener to edit amount
        binding.amountText.setOnClickListener {
            showEditAmountDialog()
        }

        // Set up chain selection button listeners
        binding.ethButton.setOnClickListener { selectChain(Chain.ETH) }
        binding.solButton.setOnClickListener { selectChain(Chain.SOL) }
        binding.baseButton.setOnClickListener { selectChain(Chain.BASE) }

        // Set up tip button listeners
        binding.tip10Button.setOnClickListener { setTipPercentage(10) }
        binding.tip15Button.setOnClickListener { setTipPercentage(15) }
        binding.tip18Button.setOnClickListener { setTipPercentage(18) }
        binding.tip20Button.setOnClickListener { setTipPercentage(20) }

        // Set up tap area click listener
        binding.tapArea.setOnClickListener {
            if (currentState == PaymentState.IDLE) {
                simulatePayment()
            }
        }

        // Set up test URL button
        binding.testUrlButton.setOnClickListener {
            testPaymentUrl()
        }
        
        // Test Circle API connection on startup (in background)
        thread {
            val connected = cctpService.testCircleAPIConnection()
            handler.post {
                if (connected) {
                    Log.d(TAG, "✓ Circle API sandbox connection successful")
                } else {
                    Log.w(TAG, "⚠ Circle API sandbox connection failed - check API key")
                }
            }
        }

        // Update debug URL display initially
        updateDebugUrlDisplay()

        // Register broadcast receiver for HCE lifecycle and NFC scan events
        nfcScanReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                when (intent?.action) {
                    PaymentCardService.ACTION_HCE_ACTIVATED -> {
                        Log.d(TAG, "═══════════════════════════════════════")
                        Log.d(TAG, "🟢 HCE SERVICE ACTIVATED EVENT RECEIVED")
                        Log.d(TAG, "  HCE sender is now active and ready")
                        Log.d(TAG, "═══════════════════════════════════════")
                    }
                    PaymentCardService.ACTION_HCE_DEACTIVATED -> {
                        val reason = intent.getIntExtra("reason", -1)
                        Log.d(TAG, "═══════════════════════════════════════")
                        Log.d(TAG, "🔴 HCE SERVICE DEACTIVATED EVENT RECEIVED")
                        Log.d(TAG, "  Reason: $reason")
                        Log.d(TAG, "═══════════════════════════════════════")
                    }
                    PaymentCardService.ACTION_NFC_SCANNED -> {
                        val timestamp = intent.getLongExtra("timestamp", System.currentTimeMillis())
                        Log.d(TAG, "═══════════════════════════════════════")
                        Log.d(TAG, "📱 NFC SCAN EVENT RECEIVED")
                        Log.d(TAG, "  Timestamp: $timestamp")
                        Log.d(TAG, "  Calling unified payment handler...")
                        Log.d(TAG, "═══════════════════════════════════════")
                        // Use unified payment handler
                        handlePaymentSuccess("NFC_TAP", timestamp)
                    }
                }
            }
        }

        val filter = IntentFilter().apply {
            addAction(PaymentCardService.ACTION_NFC_SCANNED)
            addAction(PaymentCardService.ACTION_HCE_ACTIVATED)
            addAction(PaymentCardService.ACTION_HCE_DEACTIVATED)
        }
        LocalBroadcastManager.getInstance(this).registerReceiver(nfcScanReceiver, filter)
    }

    override fun onDestroy() {
        super.onDestroy()
        // Unregister receiver
        LocalBroadcastManager.getInstance(this).unregisterReceiver(nfcScanReceiver)
    }

    private fun loadAndDisplayAmount() {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val savedAmount = prefs.getString(KEY_AMOUNT, DEFAULT_AMOUNT) ?: DEFAULT_AMOUNT
        val savedChain = prefs.getString(KEY_CHAIN, "SOL") ?: "SOL"
        
        // Set base amount
        baseAmount = savedAmount.toDoubleOrNull() ?: 0.01
        
        // Set selected chain
        selectedChain = when (savedChain) {
            "ETH" -> Chain.ETH
            "BASE" -> Chain.BASE
            else -> Chain.SOL
        }
        
        // Ensure chain is saved to SharedPreferences (for PaymentCardService)
        prefs.edit().putString(KEY_CHAIN, selectedChain.name).apply()
        
        // Reset tip
        tipPercentage = 0
        tipAmount = 0.0
        totalAmount = baseAmount
        
        // Update all displays
        updateAmountDisplays()
        updateChainSelection()
        
        // Fetch wallet address for the loaded chain
        fetchWalletAddressForChain(selectedChain)
    }
    
    private fun updateAmountDisplays() {
        val formatter = NumberFormat.getCurrencyInstance(Locale.US)
        
        // Update base amount
        binding.amountText.text = formatter.format(baseAmount)
        
        // Update tip amount
        binding.tipAmountText.text = formatter.format(tipAmount)
        
        // Update total amount
        binding.totalAmountText.text = formatter.format(totalAmount)
        
        // Save total amount to SharedPreferences (this is what gets sent via NFC)
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val amountStr = String.format("%.2f", totalAmount)
        prefs.edit()
            .putString(KEY_AMOUNT, amountStr)
            .putString(KEY_TOTAL_USDC_AMOUNT, amountStr)  // Also save as total_usdc_amount for EVM chains
            .apply()
        
        // Update tip button states
        updateTipButtonStates()
        
        // Update debug URL display
        updateDebugUrlDisplay()
    }
    
    private fun updateTipButtonStates() {
        // Reset all buttons to default state
        binding.tip10Button.setBackgroundColor(getColor(android.R.color.transparent))
        binding.tip15Button.setBackgroundColor(getColor(android.R.color.transparent))
        binding.tip18Button.setBackgroundColor(getColor(android.R.color.transparent))
        binding.tip20Button.setBackgroundColor(getColor(android.R.color.transparent))
        
        // Highlight selected button
        when (tipPercentage) {
            10 -> binding.tip10Button.setBackgroundColor(getColor(android.R.color.holo_blue_light))
            15 -> binding.tip15Button.setBackgroundColor(getColor(android.R.color.holo_blue_light))
            18 -> binding.tip18Button.setBackgroundColor(getColor(android.R.color.holo_blue_light))
            20 -> binding.tip20Button.setBackgroundColor(getColor(android.R.color.holo_blue_light))
        }
    }
    
    private fun showEditAmountDialog() {
        val builder = AlertDialog.Builder(this)
        builder.setTitle("Edit Base Amount")
        
        val input = EditText(this)
        input.inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
        input.hint = "Enter amount (e.g., 25.00)"
        input.setText(String.format("%.2f", baseAmount))
        builder.setView(input)
        
        builder.setPositiveButton("Save") { dialog, _ ->
            val newAmount = input.text.toString().toDoubleOrNull()
            if (newAmount != null && newAmount > 0) {
                baseAmount = newAmount
                // Recalculate tip and total
                calculateTipAndTotal()
                updateAmountDisplays()
            }
            dialog.dismiss()
        }
        
        builder.setNegativeButton("Cancel") { dialog, _ ->
            dialog.cancel()
        }
        
        builder.show()
    }
    
    private fun setTipPercentage(percentage: Int) {
        // Toggle tip: if same percentage is clicked again, remove tip
        tipPercentage = if (tipPercentage == percentage) 0 else percentage
        
        calculateTipAndTotal()
        updateAmountDisplays()
    }
    
    private fun calculateTipAndTotal() {
        if (tipPercentage > 0) {
            tipAmount = (baseAmount * tipPercentage / 100.0)
            // Round to 2 decimal places
            tipAmount = round(tipAmount * 100) / 100
        } else {
            tipAmount = 0.0
        }
        
        totalAmount = baseAmount + tipAmount
        // Round to 2 decimal places
        totalAmount = round(totalAmount * 100) / 100
    }
    
    private fun selectChain(chain: Chain) {
        selectedChain = chain
        
        // Save to SharedPreferences (for PaymentCardService to read)
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        prefs.edit()
            .putString(KEY_CHAIN, chain.name)
            .apply()
        
        // Update UI
        updateChainSelection()
        
        // Fetch wallet address for the selected chain
        fetchWalletAddressForChain(chain)
        
        // Update debug URL display
        updateDebugUrlDisplay()
        
        Log.d(TAG, "Chain selected: ${chain.name}")
    }
    
    private fun fetchWalletAddressForChain(chain: Chain) {
        // Fetch wallet address from backend based on selected chain
        thread {
            try {
                val walletUrl = URL("$BACKEND_URL/merchants/$MERCHANT_ID/wallet/${chain.name}")
                val connection = walletUrl.openConnection() as HttpURLConnection
                connection.requestMethod = "GET"
                
                val responseCode = connection.responseCode
                if (responseCode == HttpURLConnection.HTTP_OK) {
                    val response = connection.inputStream.bufferedReader().readText()
                    val responseJson = JSONObject(response)
                    val walletAddress = responseJson.getString("wallet_address")
                    
                    if (walletAddress.isNotEmpty()) {
                        currentMerchantWallet = walletAddress
                        Log.d(TAG, "Wallet address for ${chain.name}: $walletAddress")
                        
                        // Update PaymentCardService with new wallet address
                        updatePaymentCardServiceWallet(walletAddress)
                    } else {
                        Log.w(TAG, "No wallet address found for ${chain.name}, using default")
                        // Use default wallet as fallback
                        currentMerchantWallet = MERCHANT_WALLET
                        updatePaymentCardServiceWallet(MERCHANT_WALLET)
                    }
                } else {
                    Log.w(TAG, "Failed to fetch wallet address: HTTP $responseCode, using default")
                    // Use default wallet as fallback
                    currentMerchantWallet = MERCHANT_WALLET
                    updatePaymentCardServiceWallet(MERCHANT_WALLET)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching wallet address for ${chain.name}", e)
                // Keep using default wallet address on error
                currentMerchantWallet = MERCHANT_WALLET
                updatePaymentCardServiceWallet(MERCHANT_WALLET)
            }
        }
    }
    
    private fun updatePaymentCardServiceWallet(walletAddress: String) {
        // Update SharedPreferences so PaymentCardService can use the new wallet
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        prefs.edit().putString(KEY_RECIPIENT, walletAddress).apply()
        
        // Update debug URL display with new wallet
        updateDebugUrlDisplay()
    }
    
    private fun updateChainSelection() {
        // Reset all chain buttons to default state
        binding.ethButton.setBackgroundResource(R.drawable.chain_button_background)
        binding.solButton.setBackgroundResource(R.drawable.chain_button_background)
        binding.baseButton.setBackgroundResource(R.drawable.chain_button_background)
        
        // Highlight selected chain
        when (selectedChain) {
            Chain.ETH -> binding.ethButton.setBackgroundResource(R.drawable.chain_button_background_selected)
            Chain.SOL -> binding.solButton.setBackgroundResource(R.drawable.chain_button_background_selected)
            Chain.BASE -> binding.baseButton.setBackgroundResource(R.drawable.chain_button_background_selected)
        }
    }

    private fun simulatePayment() {
        // Switch to processing state
        setState(PaymentState.PROCESSING)

        // Simulate payment processing (1.5 seconds)
        handler.postDelayed({
            triggerPaymentSuccess()
        }, 1500)
    }

    /**
     * Unified payment success handler - called by both NFC tap and Test URL
     * Includes debouncing and deduplication to prevent duplicate transactions
     */
    private fun handlePaymentSuccess(source: String, timestamp: Long = System.currentTimeMillis()) {
        // Generate transaction hash for deduplication
        val transactionHash = generateTransactionHash(baseAmount, tipAmount, selectedChain.name, timestamp)
        
        Log.d(TAG, "═══════════════════════════════════════")
        Log.d(TAG, "💰 UNIFIED PAYMENT HANDLER CALLED")
        Log.d(TAG, "  Source: $source")
        Log.d(TAG, "  Timestamp: $timestamp")
        Log.d(TAG, "  Base Amount: $$baseAmount")
        Log.d(TAG, "  Tip: $$tipAmount")
        Log.d(TAG, "  Total: $$totalAmount")
        Log.d(TAG, "  Chain: ${selectedChain.name}")
        Log.d(TAG, "  Transaction Hash: $transactionHash")
        Log.d(TAG, "  Is Processing: $isProcessingPayment")
        Log.d(TAG, "  Current State: $currentState")
        Log.d(TAG, "═══════════════════════════════════════")
        
        // Gate: Prevent concurrent processing
        if (isProcessingPayment) {
            Log.w(TAG, "⚠️ PAYMENT ALREADY PROCESSING - IGNORING DUPLICATE")
            Log.w(TAG, "  This prevents duplicate transactions from being created")
            return
        }
        
        // State check: Only process if idle or processing
        if (currentState != PaymentState.IDLE && currentState != PaymentState.PROCESSING) {
            Log.w(TAG, "⚠️ INVALID STATE - IGNORING")
            Log.w(TAG, "  Current state: $currentState (expected: IDLE or PROCESSING)")
            return
        }
        
        // Deduplication: Check if this is the same transaction as last processed
        val timeSinceLastProcess = timestamp - lastProcessedTimestamp
        if (transactionHash == lastProcessedTransactionHash && timeSinceLastProcess < 5000) {
            Log.w(TAG, "⚠️ DUPLICATE TRANSACTION DETECTED - IGNORING")
            Log.w(TAG, "  Same hash as last transaction")
            Log.w(TAG, "  Time since last: ${timeSinceLastProcess}ms (< 5s debounce)")
            return
        }
        
        // Set processing gate
        isProcessingPayment = true
        lastProcessedTransactionHash = transactionHash
        lastProcessedTimestamp = timestamp
        
        Log.d(TAG, "✅ PAYMENT PROCESSING APPROVED")
        Log.d(TAG, "  Setting state to SUCCESS")
        Log.d(TAG, "  Updating UI...")
        
        // Update UI
        setState(PaymentState.SUCCESS)
        
        // Update success amount text with total (including tip)
        val formatter = NumberFormat.getCurrencyInstance(Locale.US)
        binding.successAmount.text = "${formatter.format(totalAmount)} charged"
        
        // Animate checkmark appearance
        animateSuccessCheckmark()
        
        // Send payment data to backend (send BASE amount, not total)
        // This will create a NEW transaction each time
        sendPaymentToBackend(baseAmount, transactionHash, source)
        
        // Reset to idle after 3 seconds
        handler.postDelayed({
            setState(PaymentState.IDLE)
            isProcessingPayment = false // Release gate
            // Reset tip after successful payment
            tipPercentage = 0
            calculateTipAndTotal()
            updateAmountDisplays()
            Log.d(TAG, "✅ Payment processing complete, gate released")
        }, 3000)
    }
    
    /**
     * Generate a unique hash for transaction deduplication
     * Combines: baseAmount, tipAmount, chain, and timestamp (rounded to nearest second)
     */
    private fun generateTransactionHash(baseAmount: Double, tipAmount: Double, chain: String, timestamp: Long): String {
        // Round timestamp to nearest second to allow for slight timing differences
        val roundedTimestamp = (timestamp / 1000) * 1000
        val hashString = "${baseAmount}_${tipAmount}_${chain}_${roundedTimestamp}"
        return hashString.hashCode().toString()
    }
    
    /**
     * Legacy method - now calls unified handler
     * Kept for backward compatibility
     */
    private fun triggerPaymentSuccess() {
        handlePaymentSuccess("NFC_TAP_LEGACY")
    }
    
    private fun animateSuccessCheckmark() {
        // Reset checkmark to initial state (hidden and scaled down)
        binding.successIcon.alpha = 0f
        binding.successIcon.scaleX = 0f
        binding.successIcon.scaleY = 0f
        
        // Animate checkmark with bounce effect
        binding.successIcon.animate()
            .alpha(1f)
            .scaleX(1f)
            .scaleY(1f)
            .setDuration(600)
            .setInterpolator(OvershootInterpolator(1.2f))
            .start()
    }

    private fun sendPaymentToBackend(baseAmount: Double, transactionHash: String? = null, source: String = "UNKNOWN") {
        // Send payment data to backend in a background thread
        // IMPORTANT: baseAmount is the BASE amount (before tip), NOT the total
        thread {
            try {
                Log.d(TAG, "═══════════════════════════════════════")
                Log.d(TAG, "📤 SENDING PAYMENT TO BACKEND")
                Log.d(TAG, "  Source: $source")
                Log.d(TAG, "  Transaction Hash: ${transactionHash ?: "N/A"}")
                Log.d(TAG, "  Base Amount: $$baseAmount")
                Log.d(TAG, "  Tip: $$tipAmount")
                Log.d(TAG, "  Total: $${baseAmount + tipAmount}")
                Log.d(TAG, "  Chain: ${selectedChain.name}")
                Log.d(TAG, "  Merchant ID: $MERCHANT_ID")
                Log.d(TAG, "  Timestamp: ${System.currentTimeMillis()}")
                Log.d(TAG, "═══════════════════════════════════════")
                
                // First, create a payment intent
                val createUrl = URL("$BACKEND_URL/payment_intents")
                val createConnection = createUrl.openConnection() as HttpURLConnection
                createConnection.requestMethod = "POST"
                createConnection.setRequestProperty("Content-Type", "application/json")
                createConnection.doOutput = true

                val createPayload = JSONObject().apply {
                    put("amount", baseAmount) // Send BASE amount, not total
                    put("merchant_id", MERCHANT_ID) // Use merchant ID, not wallet address
                    put("currency", "USDC")
                    put("tip_amount", tipAmount)
                    put("chain", selectedChain.name)
                }

                OutputStreamWriter(createConnection.outputStream).use { writer ->
                    writer.write(createPayload.toString())
                    writer.flush()
                }

                val createResponseCode = createConnection.responseCode
                if (createResponseCode == HttpURLConnection.HTTP_CREATED) {
                    val response = createConnection.inputStream.bufferedReader().readText()
                    val responseJson = JSONObject(response)
                    val paymentIntentId = responseJson.getString("id")
                    
                    Log.d(TAG, "✅ Payment intent created: $paymentIntentId")
                    
                    // Simulate transaction confirmation (in real scenario, this would come from Solana)
                    // Generate a fake transaction signature for demo purposes
                    val txSignature = generateMockTxSignature()
                    
                    // Confirm the payment intent
                    val confirmUrl = URL("$BACKEND_URL/payment_intents/$paymentIntentId/confirm")
                    val confirmConnection = confirmUrl.openConnection() as HttpURLConnection
                    confirmConnection.requestMethod = "POST"
                    confirmConnection.setRequestProperty("Content-Type", "application/json")
                    confirmConnection.doOutput = true

                    val confirmPayload = JSONObject().apply {
                        put("tx_signature", txSignature)
                    }

                    OutputStreamWriter(confirmConnection.outputStream).use { writer ->
                        writer.write(confirmPayload.toString())
                        writer.flush()
                    }

                    val confirmResponseCode = confirmConnection.responseCode
                    if (confirmResponseCode == HttpURLConnection.HTTP_OK) {
                        Log.d(TAG, "✓ Payment confirmed successfully with signature: $txSignature")
                        
                        // Send complete transaction notification to backend with all details
                        // IMPORTANT: Send BASE amount (not total) so backend stores correct base amount
                        sendTransactionNotification(
                            paymentIntentId = paymentIntentId,
                            amount = baseAmount, // Send BASE amount, not total
                            chain = selectedChain.name,
                            tipAmount = tipAmount,
                            txSignature = txSignature
                        )
                    } else {
                        Log.e(TAG, "Failed to confirm payment: HTTP $confirmResponseCode")
                    }
                } else {
                    Log.e(TAG, "Failed to create payment intent: HTTP $createResponseCode")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error sending payment to backend", e)
            }
        }
    }
    
    private fun generateMockTxSignature(): String {
        // Generate a realistic-looking Solana transaction signature (base58 format)
        val chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
        return (1..88).map { chars.random() }.joinToString("")
    }
    
    /**
     * Send complete transaction notification to backend with all transaction details
     * This ensures the transaction is properly recorded with Time, Amount (BASE), Chain, Tip, and Signature
     * IMPORTANT: amount parameter is the BASE amount (before tip), NOT the total
     */
    private fun sendTransactionNotification(
        paymentIntentId: String,
        amount: Double, // BASE amount (before tip)
        chain: String,
        tipAmount: Double,
        txSignature: String
    ) {
        thread {
            try {
                Log.d(TAG, "═══════════════════════════════════════")
                Log.d(TAG, "📤 SENDING TRANSACTION NOTIFICATION")
                Log.d(TAG, "  ID: $paymentIntentId")
                Log.d(TAG, "  Base Amount: $$amount")
                Log.d(TAG, "  Tip: $$tipAmount")
                Log.d(TAG, "  Total: $${amount + tipAmount}")
                Log.d(TAG, "  Chain: $chain")
                Log.d(TAG, "  Signature: ${txSignature.take(20)}...")
                Log.d(TAG, "═══════════════════════════════════════")
                
                val notifyUrl = URL("$BACKEND_URL/transactions/notify")
                val connection = notifyUrl.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json")
                connection.doOutput = true

                val payload = JSONObject().apply {
                    put("payment_intent_id", paymentIntentId)
                    put("merchant_id", MERCHANT_ID)
                    put("amount", amount)
                    put("chain", chain)
                    put("currency", "USDC")
                    put("tip_amount", tipAmount)
                    put("tx_signature", txSignature)
                    put("status", "paid")
                }

                OutputStreamWriter(connection.outputStream).use { writer ->
                    writer.write(payload.toString())
                    writer.flush()
                }

                val responseCode = connection.responseCode
                if (responseCode == HttpURLConnection.HTTP_CREATED || responseCode == HttpURLConnection.HTTP_OK) {
                    val response = connection.inputStream.bufferedReader().readText()
                    Log.d(TAG, "✓✓✓ TRANSACTION NOTIFICATION SENT SUCCESSFULLY ✓✓✓")
                    Log.d(TAG, "  Response: $response")
                    Log.d(TAG, "  Transaction ID: $paymentIntentId")
                    Log.d(TAG, "  Amount: $$amount USDC")
                    Log.d(TAG, "  Chain: $chain")
                    Log.d(TAG, "  Tip: $$tipAmount")
                    Log.d(TAG, "  Signature: ${txSignature.take(20)}...")
                    Log.d(TAG, "✓✓✓ Transaction should appear in frontend within 10 seconds ✓✓✓")
                    
                    // Show success toast
                    runOnUiThread {
                        Toast.makeText(this@MainActivity, "Transaction recorded! Check dashboard.", Toast.LENGTH_LONG).show()
                    }
                } else {
                    val errorResponse = connection.errorStream?.bufferedReader()?.readText() ?: "Unknown error"
                    Log.e(TAG, "❌ Failed to send transaction notification: HTTP $responseCode")
                    Log.e(TAG, "  Error: $errorResponse")
                    
                    runOnUiThread {
                        Toast.makeText(this@MainActivity, "Failed to record transaction: $responseCode", Toast.LENGTH_LONG).show()
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error sending transaction notification", e)
            }
        }
    }

    private fun setState(state: PaymentState) {
        currentState = state

        when (state) {
            PaymentState.IDLE -> {
                binding.idleState.visibility = View.VISIBLE
                binding.processingState.visibility = View.GONE
                binding.successState.visibility = View.GONE
                // Reset checkmark animation state for next payment
                binding.successIcon.alpha = 0f
                binding.successIcon.scaleX = 0f
                binding.successIcon.scaleY = 0f
            }
            PaymentState.PROCESSING -> {
                binding.idleState.visibility = View.GONE
                binding.processingState.visibility = View.VISIBLE
                binding.successState.visibility = View.GONE
            }
            PaymentState.SUCCESS -> {
                binding.idleState.visibility = View.GONE
                binding.processingState.visibility = View.GONE
                binding.successState.visibility = View.VISIBLE
            }
        }
    }
    
    /**
     * Generate payment URL based on current chain, amount, and wallet
     * Uses the same logic as PaymentCardService
     */
    private fun generatePaymentUrl(): String {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val amount = String.format("%.2f", totalAmount)
        val chain = selectedChain.name
        
        // Get recipient wallet from preferences (for Solana)
        val recipientWallet = prefs.getString(KEY_RECIPIENT, MERCHANT_WALLET) ?: MERCHANT_WALLET
        
        return when (chain) {
            "SOL" -> {
                // Solana Pay format for Phantom on Solana network - UNCHANGED
                val labelEncoded = Uri.encode("Hypersphere")
                val messageEncoded = Uri.encode("Tap to Pay")
                val usdcMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
                "solana:$recipientWallet?amount=$amount&spl-token=$usdcMint&label=$labelEncoded&message=$messageEncoded"
            }
            "ETH" -> {
                // ETH uses EIP-681 format for USDC transfer on Ethereum mainnet
                // Automatically opens MetaMask with pre-filled USDC transaction, similar to Solana Pay
                generateEvmMetaMaskUrl(prefs, PaymentCardService.ETHEREUM, DEFAULT_ETH_WALLET)
            }
            "BASE" -> {
                // BASE uses official MetaMask ERC-20 deeplink format
                generateEvmMetaMaskUrl(prefs, PaymentCardService.BASE, DEFAULT_BASE_WALLET)
            }
            else -> {
                // Default to Solana Pay (Phantom) - UNCHANGED
                val labelEncoded = Uri.encode("Hypersphere")
                val messageEncoded = Uri.encode("Tap to Pay")
                val usdcMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
                "solana:$recipientWallet?amount=$amount&spl-token=$usdcMint&label=$labelEncoded&message=$messageEncoded"
            }
        }
    }
    
    /**
     * Generate EIP-681 URI for ERC-20 token transfer on EVM chains (Ethereum/Base)
     * Uses EIP-681 format: ethereum:<tokenAddress>@<chainId>/transfer?address=<recipient>&uint256=<amount>
     * Note: "pay-" prefix is for native ETH transfers. For ERC-20 tokens, use contract address directly.
     * This automatically opens MetaMask with a pre-filled USDC transfer transaction, similar to Solana Pay with Phantom
     */
    private fun generateEvmMetaMaskUrl(
        prefs: android.content.SharedPreferences,
        config: EvmChainConfig,
        defaultMerchant: String
    ): String {
        // Read merchant wallet address from preferences
        val merchantWallet = prefs.getString(config.merchantKey, defaultMerchant) ?: defaultMerchant
        
        // Use totalAmount (includes tip if any) as string
        val amountStr = String.format("%.2f", totalAmount)
        
        // Parse with BigDecimal and convert to smallest units
        // USDC on Ethereum has 6 decimals, USDBC on Base also has 6 decimals
        val decimals = 6
        val amountDecimal = try {
            BigDecimal(amountStr)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse amount '$amountStr', using totalAmount: $totalAmount", e)
            BigDecimal(totalAmount.toString())
        }
        
        // Validate amount is > 0
        val validAmount = if (amountDecimal <= BigDecimal.ZERO) {
            Log.w(TAG, "Invalid amount: $amountDecimal, using totalAmount: $totalAmount")
            BigDecimal(totalAmount.toString())
        } else {
            amountDecimal
        }
        
        // Convert to base units (smallest units)
        val baseUnits = validAmount
            .multiply(BigDecimal.TEN.pow(decimals))
            .toBigInteger()
        
        val amountParam = baseUnits.toString() // this is uint256
        
        // Ensure wallet address is lowercase and valid
        val wallet = if (merchantWallet.startsWith("0x")) {
            merchantWallet.lowercase()
        } else {
            Log.w(TAG, "Wallet doesn't start with 0x: $merchantWallet")
            merchantWallet.lowercase()
        }
        
        // Construct EIP-681 URI for ERC-20 token transfer
        // Format: ethereum:<tokenAddress>@<chainId>/transfer?address=<recipient>&uint256=<amount>
        // Note: "pay-" prefix is for native ETH, not ERC-20 tokens. For ERC-20, use contract address directly.
        // This format automatically opens MetaMask with a pre-filled USDC transfer transaction, similar to Solana Pay
        val url = "ethereum:${config.usdcContract}@${config.chainId}/transfer" +
                "?address=$wallet" +
                "&uint256=$amountParam"
        
        val tokenName = if (config.chainId == 8453) "USDBC" else "USDC"
        Log.d(TAG, "Generated ${config.chainId} $tokenName EIP-681 URI: amount=$amountStr $tokenName, baseUnits=$amountParam, merchant=$wallet")
        Log.d(TAG, "Full URL: $url")
        
        return url
    }
    
    /**
     * Update debug URL display with current payment URL
     */
    private fun updateDebugUrlDisplay() {
        try {
            val paymentUrl = generatePaymentUrl()
            val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            
            val wallet = prefs.getString(KEY_RECIPIENT, MERCHANT_WALLET) ?: MERCHANT_WALLET
            
            binding.debugUrlText.text = paymentUrl
            
            val walletApp = when (selectedChain) {
                Chain.SOL -> "Phantom"
                Chain.ETH -> "MetaMask"
                Chain.BASE -> "MetaMask (Base Pay)"
            }
            
            val networkInfo = when (selectedChain) {
                Chain.ETH -> " | Network: Ethereum Mainnet (USDC via CCTP)"
                Chain.BASE -> " | Network: Base (USDC via CCTP) - Base Pay"
                Chain.SOL -> " | Network: Solana (USDC)"
            }
            
            binding.debugInfoText.text = "Chain: ${selectedChain.name} | Wallet: ${wallet.take(8)}... | Opens: $walletApp$networkInfo"
        } catch (e: Exception) {
            Log.e(TAG, "Error generating payment URL", e)
            binding.debugUrlText.text = "Error generating URL: ${e.message}"
        }
    }
    
    /**
     * Test opening the payment URL (simulates NFC reader behavior)
     */
    private fun testPaymentUrl() {
        // When testing payment URL, also record the transaction
        // This simulates a successful payment after the URL is opened
        Log.d(TAG, "Test Payment URL clicked - will record transaction after opening wallet")
        
        // After a short delay (to simulate wallet interaction), record the transaction
        handler.postDelayed({
            // Record the transaction as if payment was successful
            // Send BASE amount, not total
            // Use unified payment handler (same as NFC tap)
            val timestamp = System.currentTimeMillis()
            handlePaymentSuccess("TEST_URL", timestamp)
        }, 2000) // Wait 2 seconds to simulate wallet interaction
        try {
            val paymentUrl = generatePaymentUrl()
            Log.d(TAG, "Testing payment URL: $paymentUrl")
            
            val uri = Uri.parse(paymentUrl)
            
            if (uri.scheme == null) {
                Toast.makeText(this, "Invalid URL format", Toast.LENGTH_SHORT).show()
                return
            }
            
            val intent = Intent(Intent.ACTION_VIEW, uri)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            intent.addCategory(Intent.CATEGORY_BROWSABLE)
            intent.addCategory(Intent.CATEGORY_DEFAULT)
            
            // For ethereum: scheme, ensure MetaMask can handle the transaction request
            if (uri.scheme == "ethereum") {
                // MetaMask should handle EIP-681 format and create transaction request
                Log.d(TAG, "Opening Ethereum payment URL: $paymentUrl")
                Log.d(TAG, "This should create a transaction request in MetaMask with amount: $totalAmount USDC")
            }
            
            val walletApp = when {
                uri.scheme == "solana" -> "Phantom"
                uri.scheme == "https" && (uri.host?.contains("metamask") == true || uri.host?.contains("link.metamask.io") == true) -> {
                    when (selectedChain) {
                        Chain.BASE -> "MetaMask (Base Pay)"
                        Chain.ETH -> "MetaMask (Ethereum)"
                        else -> "MetaMask"
                    }
                }
                uri.scheme == "ethereum" -> {
                    when (selectedChain) {
                        Chain.BASE -> "MetaMask (Base Pay)"
                        else -> "MetaMask"
                    }
                }
                else -> "wallet app"
            }
            
            try {
                startActivity(intent)
                val networkName = when (selectedChain) {
                    Chain.ETH -> "Ethereum Mainnet"
                    Chain.BASE -> "Base (Base Pay)"
                    Chain.SOL -> "Solana"
                }
                Toast.makeText(this, "Opening in $walletApp ($networkName)...", Toast.LENGTH_SHORT).show()
                Log.d(TAG, "Successfully opened URL in $walletApp")
                
                // IMPORTANT: Use unified payment handler (same as NFC tap)
                val timestamp = System.currentTimeMillis()
                Log.d(TAG, "═══════════════════════════════════════")
                Log.d(TAG, "🔧 TEST URL PAYMENT (ALTERNATE PATH)")
                Log.d(TAG, "  baseAmount=$$baseAmount, tip=$$tipAmount, total=$$totalAmount")
                Log.d(TAG, "  chain=${selectedChain.name}")
                Log.d(TAG, "  Calling unified payment handler...")
                Log.d(TAG, "═══════════════════════════════════════")
                handler.postDelayed({
                    handlePaymentSuccess("TEST_URL_ALTERNATE", timestamp)
                }, 1500) // Wait 1.5 seconds to simulate wallet interaction
            } catch (e: android.content.ActivityNotFoundException) {
                Toast.makeText(this, "Please install $walletApp to test this payment", Toast.LENGTH_LONG).show()
                Log.e(TAG, "$walletApp not installed", e)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error testing payment URL", e)
            Toast.makeText(this, "Error: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }
}

