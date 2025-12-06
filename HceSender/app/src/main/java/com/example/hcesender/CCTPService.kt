package com.example.hcesender

import android.util.Log
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

/**
 * Circle Cross-Chain Transfer Protocol (CCTP) Service
 * 
 * This service ensures that:
 * - ETH payments use Ethereum mainnet USDC contract (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)
 * - Base payments use Base mainnet USDC contract (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
 * 
 * CCTP enables native USDC transfers between supported blockchains through a burn-and-mint mechanism:
 * 1. Burn USDC on source chain (via TokenMessenger contract)
 * 2. Get attestation from Circle's Attestation Service
 * 3. Mint USDC on destination chain (via MessageTransmitter contract)
 * 
 * For direct payments on the same chain, we use standard ERC20 transfers.
 * For cross-chain transfers, CCTP contracts would be used (typically via a dApp or backend service).
 */
class CCTPService {
    
    companion object {
        private const val TAG = "CCTPService"
        
        // Circle API Sandbox Configuration
        // API Key format: SAND_API_KEY:key:secret
        private const val CIRCLE_API_KEY = "c0943ec4ba237858764df24eb45797c0"
        private const val CIRCLE_API_SECRET = "a9549e06dde3c0b1cf7137730190f417"
        
        // Circle CCTP Attestation Service API (Sandbox)
        private const val CCTP_ATTESTATION_API_SANDBOX = "https://iris-api-sandbox.circle.com/v1/attestations"
        private const val CCTP_ATTESTATION_API_PRODUCTION = "https://iris-api.circle.com/v1/attestations"
        
        // Use sandbox for testing - set to false for production
        private const val USE_SANDBOX = true
        
        // Circle API Sandbox Base URL
        private const val CIRCLE_API_SANDBOX_BASE = "https://api-sandbox.circle.com"
        private const val CIRCLE_API_PRODUCTION_BASE = "https://api.circle.com"
        
        // CCTP Contract Addresses
        // TokenMessenger contracts (for burning USDC)
        const val TOKEN_MESSENGER_ETH = "0xBd3fa81B40Ba3De7978C1250a30Da8b1b0E1407a" // Ethereum mainnet
        const val TOKEN_MESSENGER_BASE = "0x1682Ae6375C4E4A97e4B583BC394c861A46D8962" // Base mainnet
        
        // MessageTransmitter contracts (for minting USDC)
        const val MESSAGE_TRANSMITTER_ETH = "0x0a992d191DEeC32aFe36203Ad87D7d289a738F81" // Ethereum mainnet
        const val MESSAGE_TRANSMITTER_BASE = "0xAD09780d193884d503182aD4588450C416D6F9D4" // Base mainnet
        
        // Domain IDs for CCTP
        const val DOMAIN_ETH = 0 // Ethereum mainnet domain
        const val DOMAIN_BASE = 6 // Base mainnet domain
        
        // USDC Contract Addresses
        const val USDC_ETH = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // Ethereum mainnet USDC
        const val USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // Base mainnet USDBC (USD Base Coin - native stablecoin)
    }
    
    /**
     * Get the appropriate USDC contract address for a given chain
     */
    fun getUSDCContract(chain: String): String {
        return when (chain.uppercase()) {
            "ETH" -> USDC_ETH
            "BASE" -> USDC_BASE
            else -> USDC_ETH // Default to Ethereum
        }
    }
    
    /**
     * Get the chain ID for a given chain
     */
    fun getChainId(chain: String): String {
        return when (chain.uppercase()) {
            "ETH" -> "1" // Ethereum mainnet
            "BASE" -> "8453" // Base mainnet
            else -> "1" // Default to Ethereum
        }
    }
    
    /**
     * Get the CCTP domain ID for a given chain
     */
    fun getDomainId(chain: String): Int {
        return when (chain.uppercase()) {
            "ETH" -> DOMAIN_ETH
            "BASE" -> DOMAIN_BASE
            else -> DOMAIN_ETH
        }
    }
    
    /**
     * Get the TokenMessenger contract address for a given chain
     */
    fun getTokenMessengerContract(chain: String): String {
        return when (chain.uppercase()) {
            "ETH" -> TOKEN_MESSENGER_ETH
            "BASE" -> TOKEN_MESSENGER_BASE
            else -> TOKEN_MESSENGER_ETH
        }
    }
    
    /**
     * Get the MessageTransmitter contract address for a given chain
     */
    fun getMessageTransmitterContract(chain: String): String {
        return when (chain.uppercase()) {
            "ETH" -> MESSAGE_TRANSMITTER_ETH
            "BASE" -> MESSAGE_TRANSMITTER_BASE
            else -> MESSAGE_TRANSMITTER_ETH
        }
    }
    
    /**
     * Get the CCTP Attestation API URL (sandbox or production)
     */
    private fun getAttestationApiUrl(): String {
        return if (USE_SANDBOX) CCTP_ATTESTATION_API_SANDBOX else CCTP_ATTESTATION_API_PRODUCTION
    }
    
    /**
     * Get the Circle API base URL (sandbox or production)
     */
    private fun getCircleApiBaseUrl(): String {
        return if (USE_SANDBOX) CIRCLE_API_SANDBOX_BASE else CIRCLE_API_PRODUCTION_BASE
    }
    
    /**
     * Check attestation status from Circle's API (Sandbox)
     * @param messageHash The hash of the burn message
     * @return Attestation status or null if not ready
     */
    fun checkAttestationStatus(messageHash: String): String? {
        return try {
            val apiUrl = getAttestationApiUrl()
            val url = URL("$apiUrl/$messageHash")
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $CIRCLE_API_KEY")
            
            val responseCode = connection.responseCode
            if (responseCode == HttpURLConnection.HTTP_OK) {
                val response = connection.inputStream.bufferedReader().readText()
                val json = JSONObject(response)
                val status = json.getString("status")
                
                Log.d(TAG, "Attestation status for $messageHash: $status")
                
                if (status == "complete") {
                    val attestation = json.optString("attestation", null)
                    Log.d(TAG, "Attestation complete: ${attestation?.take(20)}...")
                    attestation
                } else {
                    Log.d(TAG, "Attestation not ready yet, status: $status")
                    null // Attestation not ready yet
                }
            } else {
                val errorResponse = try {
                    connection.errorStream?.bufferedReader()?.readText() ?: "No error body"
                } catch (e: Exception) {
                    "Error reading error stream"
                }
                Log.w(TAG, "Failed to get attestation status: HTTP $responseCode, Response: $errorResponse")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking attestation status", e)
            null
        }
    }
    
    /**
     * Test Circle API connectivity (ping endpoint)
     * @return true if connection successful, false otherwise
     */
    fun testCircleAPIConnection(): Boolean {
        return try {
            val apiBase = getCircleApiBaseUrl()
            val url = URL("$apiBase/ping")
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $CIRCLE_API_KEY")
            
            val responseCode = connection.responseCode
            if (responseCode == HttpURLConnection.HTTP_OK) {
                val response = connection.inputStream.bufferedReader().readText()
                Log.d(TAG, "Circle API ping response: $response")
                true
            } else {
                Log.w(TAG, "Circle API ping failed: HTTP $responseCode")
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error testing Circle API connection", e)
            false
        }
    }
    
    /**
     * Generate a payment URL for direct USDC transfer on the specified chain
     * This ensures ETH uses Ethereum network and Base uses Base network
     * Uses EIP-681 format that creates a proper transaction request in MetaMask
     * Similar to how Solana Pay works - creates a transaction request with amount and recipient
     */
    fun generatePaymentUrl(
        chain: String,
        recipientWallet: String,
        amount: Double,
        useCCTP: Boolean = false
    ): String {
        val chainId = getChainId(chain)
        val usdcContract = getUSDCContract(chain)
        // USDC has 6 decimals, so convert to smallest unit (micro-USDC)
        val amountInSmallestUnit = (amount * 1_000_000).toLong()
        
        val wallet = if (recipientWallet.startsWith("0x")) {
            recipientWallet.lowercase()
        } else {
            recipientWallet.lowercase()
        }
        
        // Use EIP-681 format for ERC20 token transfers
        // This format creates a proper transaction request in MetaMask
        // Format: ethereum:pay-<address>@<chainId>?value=<amount>&tokenAddress=<tokenContract>
        // MetaMask will recognize this and create a transaction request with:
        // - Recipient: the merchant wallet address
        // - Amount: the specified USDC amount
        // - Token: USDC contract address
        // - Network: automatically switches to the correct chain (ETH or Base)
        // This works similar to Solana Pay - it creates a transaction request, not just opens the app
        return "ethereum:pay-$wallet@$chainId?value=$amountInSmallestUnit&tokenAddress=$usdcContract"
    }
    
    /**
     * Generate a CCTP transfer URL (for cross-chain transfers)
     * Note: This would typically require a dApp or backend service to handle the multi-step process
     */
    fun generateCCTPTransferUrl(
        sourceChain: String,
        destinationChain: String,
        recipientWallet: String,
        amount: Double
    ): String {
        // CCTP requires multiple steps:
        // 1. Approve USDC spending
        // 2. Burn USDC on source chain
        // 3. Get attestation
        // 4. Mint USDC on destination chain
        // 
        // This is too complex for a simple deep link, so we'd need a dApp URL
        // For now, return a URL that opens a CCTP dApp
        
        val sourceChainId = getChainId(sourceChain)
        val destinationChainId = getChainId(destinationChain)
        val amountInSmallestUnit = (amount * 1_000_000).toLong()
        
        // This would typically point to a dApp that handles CCTP
        // For example: https://your-cctp-dapp.com/transfer?source=$sourceChainId&dest=$destinationChainId&amount=$amountInSmallestUnit&recipient=$recipientWallet
        return "https://app.circle.com/cctp?source=$sourceChainId&dest=$destinationChainId&amount=$amountInSmallestUnit&recipient=$recipientWallet"
    }
}

