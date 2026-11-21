const config = require('../../config');
const whatsapp = require('../../services/whatsapp');

// Default campaign template (can be overridden per request with templateName / mediaUrl / languageCode)
const DEFAULT_TEMPLATE_NAME = 'junaid_shariff_workshop';
const DEFAULT_TEMPLATE_LANGUAGE = 'en_GB';
const defaultMediaUrl = () => `${config.urls.frontend}/assets/video1.mp4`;

const normaliseNumbers = (phoneNumbers) =>
  phoneNumbers
    .map((number) => whatsapp.formatPhoneNumber(number))
    .filter((number) => number && number.length > 5);

// Free-text message to many numbers
exports.sendBulkMessages = async (req, res) => {
  try {
    const { message, phoneNumbers } = req.body;
    if (!message || !phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({ success: false, message: 'Message and phoneNumbers array are required' });
    }

    const processedNumbers = normaliseNumbers(phoneNumbers);
    if (processedNumbers.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid phone numbers provided' });
    }

    try {
      const response = await whatsapp.sendText(processedNumbers, message);
      return res.status(200).json({
        success: true,
        message: 'Bulk messages sent successfully',
        data: { sentTo: processedNumbers.length, response }
      });
    } catch (error) {
      console.error('Failed to send WhatsApp bulk message:', error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to send bulk messages',
        error: error.response?.data || error.message
      });
    }
  } catch (error) {
    console.error('Error in sendBulkMessages:', error);
    return res.status(500).json({ success: false, message: 'Internal server error during bulk messaging', error: error.message });
  }
};

// Approved video template to many numbers
exports.sendTemplateBulkMessages = async (req, res) => {
  try {
    const { phoneNumbers, templateName, mediaUrl, languageCode } = req.body;
    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({ success: false, message: 'Phone numbers array is required' });
    }

    const processedNumbers = normaliseNumbers(phoneNumbers);
    if (processedNumbers.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid phone numbers provided' });
    }

    try {
      const response = await whatsapp.sendTemplate({
        name: templateName || DEFAULT_TEMPLATE_NAME,
        languageCode: languageCode || DEFAULT_TEMPLATE_LANGUAGE,
        to: processedNumbers,
        components: { header_1: { type: 'video', value: mediaUrl || defaultMediaUrl() } }
      });

      if (whatsapp.isSuccessResponse(response)) {
        return res.status(200).json({
          success: true,
          message: 'Template bulk messages queued successfully. Check delivery reports for actual status.',
          data: {
            sentTo: processedNumbers.length,
            response,
            requestId: response.request_id,
            note: 'Messages are queued. Delivery status will be updated in WhatsApp logs.'
          }
        });
      }
      return res.status(400).json({ success: false, message: 'WhatsApp API returned an error', error: response });
    } catch (error) {
      console.error('Failed to send WhatsApp template bulk message:', error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to send template bulk messages',
        error: error.response?.data || error.message
      });
    }
  } catch (error) {
    console.error('Error in sendTemplateBulkMessages:', error);
    return res.status(500).json({ success: false, message: 'Internal server error during template bulk messaging', error: error.message });
  }
};

exports.checkDeliveryStatus = async (req, res) => {
  try {
    const { requestId } = req.query;
    if (!requestId) {
      return res.status(400).json({ success: false, message: 'Request ID is required' });
    }
    const data = await whatsapp.getDeliveryReport(requestId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error checking delivery status:', error.response?.data || error.message);
    return res.status(500).json({ success: false, message: 'Error checking delivery status', error: error.message });
  }
};
