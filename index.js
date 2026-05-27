require('dotenv').config()
const Sentry = require('@sentry/node')
const LaunchDarkly = require('launchdarkly-node-server-sdk')
const { v1Checkout, v2Checkout } = require('./checkout')

// 1. Initialize Sentry
if (!process.env.SENTRY_DSN) {
  console.error("❌ SENTRY_DSN is missing in .env")
  process.exit(1)
}
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
})

// 2. Initialize LaunchDarkly
if (!process.env.LAUNCHDARKLY_SDK_KEY) {
  console.error("❌ LAUNCHDARKLY_SDK_KEY is missing in .env")
  process.exit(1)
}
const ldClient = LaunchDarkly.init(process.env.LAUNCHDARKLY_SDK_KEY)

console.log("⏳ Connecting to LaunchDarkly...")

ldClient.once('ready', () => {
  console.log("✅ Connected to LaunchDarkly! Server is running and handling traffic...")

  // 3. Simulate a high-traffic API receiving a checkout request every 2 seconds
  setInterval(async () => {
    const userId = `user_${Math.floor(Math.random() * 1000)}`
    
    // Check if the v2 feature flag is turned on
    const isV2Enabled = await ldClient.variation('checkout-v2-enabled', { key: userId }, false)

    if (isV2Enabled) {
      console.log(`\n🛑 [Routing] ${userId} sent to v2 Checkout...`)
      try {
        // Execute the new code you just merged from GitHub!
        const result = v2Checkout(userId)
        console.log(`✅ [Success] ${result.method}`)
      } catch (e) {
        // The code crashed! Send the real error to Sentry
        console.error(`💥 CRASH DETECTED: ${e.message}`)
        Sentry.captureException(e)
        console.log("   -> Real error payload dispatched to Sentry API.")
      }
    } else {
      // Execute the old, safe code
      const result = v1Checkout(userId)
      console.log(`✅ [Routing] ${userId} sent to v1 Checkout. Transaction successful.`)
    }
  }, 2000)
})
