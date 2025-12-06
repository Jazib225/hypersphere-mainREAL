package com.example.hcesender

import android.content.Intent
import android.net.Uri
import android.nfc.cardemulation.HostApduService
import android.os.Bundle
import android.util.Log
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import java.math.BigDecimal
import java.math.BigInteger

/**
 * EVM Chain Configuration
 * Defines chain-specific settings for Ethereum and Base networks
 */
data class EvmChainConfig(
    val chainId: Int,
    val usdcContract: String,
    val merchantKey: String  // SharedPreferences key for that merchant address
)

class PaymentCardService : HostApduService() {

    companion object {
        private const val TAG = "PaymentCardService"
        private val STATUS_SUCCESS = byteArrayOf(0x90.toByte(), 0x00.toByte())

        private const val PREFS_NAME = "hce_sender_prefs"
        private const val KEY_RECIPIENT = "recipient"
        private const val KEY_AMOUNT = "amount"
        private const val KEY_TOTAL_USDC_AMOUNT = "total_usdc_amount"  // Total amount including tip
        private const val KEY_CHAIN = "selected_chain"
        private const val KEY_MERCHANT_BASE_WALLET = "merchant_base_wallet"
        private const val KEY_MERCHANT_ETH_WALLET = "merchant_eth_wallet"

        // Merchant wallet (IMPORTANT) - Default Solana wallet
        private const val MERCHANT_WALLET = "2Qw4fFW9MeKvJXPVfMWX6X324PaX8aAA8B9J2Xnv8PBF"
        
        // Default EVM merchant wallet addresses (fallback if not set in preferences)
        private const val DEFAULT_BASE_WALLET = "0x7063948e82549732aF860b2095918669c37C4351"
        private const val DEFAULT_ETH_WALLET = "0x7063948e82549732aF860b2095918669c37C4351"
        
        // Solana USDC mint address
        private const val USDC_MINT_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        
        // EVM Chain Configurations (public for use in MainActivity)
        val ETHEREUM = EvmChainConfig(
            chainId = 1,
            usdcContract = "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
            merchantKey = KEY_MERCHANT_ETH_WALLET
        )
        
        val BASE = EvmChainConfig(
            chainId = 8453,
            usdcContract = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Native USDBC (USD Base Coin) on Base
            merchantKey = KEY_MERCHANT_BASE_WALLET
        )
        
        // Fixed amount for now
        private const val FIXED_AMOUNT = "0.01"
        
        private const val LABEL = "Hypersphere"
        private const val MESSAGE = "Tap to Pay"
        
        // Broadcast action for NFC scan detected
        const val ACTION_NFC_SCANNED = "com.example.hcesender.NFC_SCANNED"
    }

    override fun processCommandApdu(commandApdu: ByteArray?, extras: Bundle?): ByteArray {
        if (commandApdu == null) return STATUS_SUCCESS

        Log.d(TAG, "Received APDU: ${commandApdu.toHexString()}")
        Log.d(TAG, "APDU length: ${commandApdu.size}")

        // Check if this is a SELECT command (NFC reader scanning)
        val isSelectCommand = commandApdu.size >= 2 && 
                              commandApdu[0] == 0x00.toByte() && 
                              commandApdu[1] == 0xA4.toByte()

        if (isSelectCommand) {
            Log.d(TAG, "NFC reader scanning detected - triggering success animation")
            
            // Send broadcast to MainActivity to trigger success animation
            val intent = Intent(ACTION_NFC_SCANNED)
            LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
        }

        // Read amount, recipient wallet, and selected chain from SharedPreferences
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val amount = prefs.getString(KEY_AMOUNT, FIXED_AMOUNT) ?: FIXED_AMOUNT
        val selectedChain = prefs.getString(KEY_CHAIN, "SOL") ?: "SOL"
        
        // Get recipient wallet from preferences (for Solana)
        val recipientWallet = prefs.getString(KEY_RECIPIENT, MERCHANT_WALLET) ?: MERCHANT_WALLET

        // Generate payment URL based on selected chain
        val paymentUrl = when (selectedChain) {
            "SOL" -> {
                // SOL uses Solana Pay format (opens Phantom on Solana network) - UNCHANGED
                // Format: solana:<recipient>?amount=<amount>&spl-token=<spl-token>&label=<label>&message=<message>
                val labelEncoded = Uri.encode(LABEL)
                val messageEncoded = Uri.encode(MESSAGE)
                "solana:$recipientWallet" +
                    "?amount=$amount" +
                    "&spl-token=$USDC_MINT_SOLANA" +
                    "&label=$labelEncoded" +
                    "&message=$messageEncoded"
            }
            "ETH" -> {
                // ETH uses EIP-681 format for USDC transfer on Ethereum mainnet
                // Automatically opens MetaMask with pre-filled USDC transaction, similar to Solana Pay
                generateEvmMetaMaskUrl(prefs, ETHEREUM, DEFAULT_ETH_WALLET)
            }
            "BASE" -> {
                // BASE uses official MetaMask ERC-20 deeplink format
                generateEvmMetaMaskUrl(prefs, BASE, DEFAULT_BASE_WALLET)
            }
            else -> {
                // Default to Solana Pay (Phantom) - UNCHANGED
                val labelEncoded = Uri.encode(LABEL)
                val messageEncoded = Uri.encode(MESSAGE)
                "solana:$recipientWallet" +
                    "?amount=$amount" +
                    "&spl-token=$USDC_MINT_SOLANA" +
                    "&label=$labelEncoded" +
                    "&message=$messageEncoded"
            }
        }

        Log.d(TAG, "Serving payment URL for chain $selectedChain: $paymentUrl")
        Log.d(TAG, "Merchant: $recipientWallet, Amount: $amount USDC, Chain: $selectedChain")

        // Convert to bytes and append 0x90 0x00
        val urlBytes = paymentUrl.toByteArray(Charsets.UTF_8)
        val response = urlBytes + STATUS_SUCCESS
        
        Log.d(TAG, "Response total length: ${response.size} bytes")
        val previewSize = minOf(150, response.size)
        Log.d(TAG, "Response hex (first $previewSize bytes): ${response.copyOfRange(0, previewSize).toHexString()}")
        
        return response
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
        
        // Read total USDC amount (includes tip if any) from SharedPreferences
        // Fallback to regular amount key if total_usdc_amount is not set
        val amountStr = prefs.getString(KEY_TOTAL_USDC_AMOUNT, null)
            ?: prefs.getString(KEY_AMOUNT, FIXED_AMOUNT)
            ?: FIXED_AMOUNT
        
        // Parse with BigDecimal and convert to smallest units
        // USDC on Ethereum has 6 decimals, USDBC on Base also has 6 decimals
        val decimals = 6
        val amountDecimal = try {
            BigDecimal(amountStr)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse amount '$amountStr', using default: $FIXED_AMOUNT", e)
            BigDecimal(FIXED_AMOUNT)
        }
        
        // Validate amount is > 0
        val validAmount = if (amountDecimal <= BigDecimal.ZERO) {
            Log.w(TAG, "Invalid amount: $amountDecimal, using default: $FIXED_AMOUNT")
            BigDecimal(FIXED_AMOUNT)
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

    override fun onDeactivated(reason: Int) {
        Log.d(TAG, "Deactivated: reason=$reason")
    }
}

private fun ByteArray.toHexString(): String =
    joinToString(" ") { String.format("%02X", it) }

