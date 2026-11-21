// PhonePe Standard Checkout. Shared by membership and workshop payments.
const { StandardCheckoutClient, Env, StandardCheckoutPayRequest } = require('pg-sdk-node');
const config = require('../config');

const client = StandardCheckoutClient.getInstance(
    config.phonepe.clientId,
    config.phonepe.clientSecret,
    config.phonepe.clientVersion,
    config.phonepe.env === 'SANDBOX' ? Env.SANDBOX : Env.PRODUCTION
);

/**
 * Start a checkout. `amountInRupees` is converted to paise.
 * `statusPath` is the API path PhonePe redirects the browser back to, e.g. "membership-plan/check-status".
 * Returns the PhonePe checkout page URL.
 */
async function createCheckout({ merchantOrderId, amountInRupees, statusPath }) {
    const redirectUrl = `${config.urls.publicApi}/${statusPath}?merchantOrderId=${encodeURIComponent(merchantOrderId)}`;
    const request = StandardCheckoutPayRequest.builder(merchantOrderId)
        .merchantOrderId(merchantOrderId)
        .amount(Math.round(amountInRupees * 100))
        .redirectUrl(redirectUrl)
        .build();
    const response = await client.pay(request);
    return response.redirectUrl;
}

/** Returns the PhonePe order status response (`.state` is COMPLETED / FAILED / PENDING). */
async function getOrderStatus(merchantOrderId) {
    return client.getOrderStatus(merchantOrderId);
}

module.exports = { createCheckout, getOrderStatus };
