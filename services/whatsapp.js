// MSG91 WhatsApp integration. All outbound WhatsApp traffic goes through this module.
const axios = require('axios');
const config = require('../config');

const MSG91_BASE_URL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message';
const TEMPLATE_NAMESPACE = '757345ed_855e_4856_b51f_06bc7bcfb953';

/** Normalise an Indian mobile number to +91XXXXXXXXXX (other formats get a leading +). */
function formatPhoneNumber(raw) {
    let mobileNumber = raw == null ? '' : String(raw).trim();
    if (!mobileNumber) return '';
    const digits = mobileNumber.replace(/\D/g, '');
    if (digits.length === 10) return `+91${digits}`;
    if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
    if (!mobileNumber.startsWith('+')) return `+${digits}`;
    return mobileNumber;
}

function headers() {
    return {
        authkey: config.msg91.authKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };
}

/** Build MSG91 body components: ['a','b'] -> { body_1: {type:'text',value:'a'}, body_2: ... } */
function bodyComponents(values) {
    return values.reduce((acc, value, i) => {
        acc[`body_${i + 1}`] = { type: 'text', value };
        return acc;
    }, {});
}

async function postBulk(payload) {
    const response = await axios.post(`${MSG91_BASE_URL}/bulk/`, payload, {
        headers: headers(),
        maxRedirects: 5,
    });
    return response.data;
}

/** Send an approved WhatsApp template. `to` is an array of formatted numbers. Returns MSG91 response data. */
async function sendTemplate({ name, to, components, languageCode = 'en' }) {
    return postBulk({
        integrated_number: config.msg91.whatsappNumber,
        content_type: 'template',
        payload: {
            messaging_product: 'whatsapp',
            type: 'template',
            template: {
                name,
                language: { code: languageCode, policy: 'deterministic' },
                namespace: TEMPLATE_NAMESPACE,
                to_and_components: [{ to, components }],
            },
        },
    });
}

/** Send a free-text WhatsApp message to several numbers. */
async function sendText(numbers, body) {
    return postBulk({
        integrated_number: config.msg91.whatsappNumber,
        content_type: 'text',
        payload: {
            messaging_product: 'whatsapp',
            type: 'text',
            text: { body },
            to_and_components: numbers.map((number) => ({ to: [number] })),
        },
    });
}

async function getDeliveryReport(requestId) {
    const response = await axios.get(`${MSG91_BASE_URL}/delivery-report/${encodeURIComponent(requestId)}`, {
        headers: headers(),
    });
    return response.data;
}

const isSuccessResponse = (data) => Boolean(data && data.status === 'success' && !data.hasError);

// ---- Business messages ------------------------------------------------------------

/** Template "membership_confirmation": name, plan, start date, expiry date, contact. */
async function sendMembershipConfirmation({ mobileNumber, name, planName, startDate, expiryDate }) {
    return sendTemplate({
        name: 'membership_confirmation',
        to: [formatPhoneNumber(mobileNumber)],
        components: bodyComponents([
            name || 'Participant',
            planName || 'Membership Plan',
            new Date(startDate).toLocaleDateString('en-GB'),
            new Date(expiryDate).toLocaleDateString('en-GB'),
            config.studio.contactNumber,
        ]),
    });
}

/** Template "workshop_confirmation": name, workshop, date, time, location, contact. */
async function sendWorkshopConfirmation({ mobileNumber, name, workshopTitle, date, time, location }) {
    return sendTemplate({
        name: 'workshop_confirmation',
        to: [formatPhoneNumber(mobileNumber)],
        components: bodyComponents([
            name || 'Participant',
            workshopTitle || 'Dance Workshop',
            date,
            time,
            location || config.studio.address,
            config.studio.contactNumber,
        ]),
    });
}

/**
 * Template "renewal": member name, end date, renewal link, contact.
 * Throws if the number is invalid or MSG91 reports an error.
 */
async function sendRenewalReminder(booking) {
    const mobileNumber = formatPhoneNumber(booking.mobile_number);
    if (!mobileNumber || mobileNumber.length < 10) {
        throw new Error('Invalid mobile number');
    }
    const formattedEndDate = new Date(booking.end_date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
    const data = await sendTemplate({
        name: 'renewal',
        to: [mobileNumber],
        components: bodyComponents([
            booking.name || 'Member',
            formattedEndDate,
            config.urls.renewalForm(booking._id),
            config.studio.contactNumber,
        ]),
    });
    if (!isSuccessResponse(data)) {
        throw new Error('WhatsApp API returned an error');
    }
    return { mobileNumber, formattedEndDate, response: data };
}

module.exports = {
    formatPhoneNumber,
    bodyComponents,
    sendTemplate,
    sendText,
    getDeliveryReport,
    isSuccessResponse,
    sendMembershipConfirmation,
    sendWorkshopConfirmation,
    sendRenewalReminder,
};
