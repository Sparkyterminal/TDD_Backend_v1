const axios = require('axios');

exports.sendBulkMessages = async (req, res) => {
  console.log('sendBulkMessages invoked with body:', req.body);

  try {
    const { message, phoneNumbers } = req.body;

    if (!message || !phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Message and phoneNumbers array are required"
      });
    }

    const MSG91_AUTHKEY = process.env.MSG91_AUTHKEY || '473576AtOfLQYl68f619aaP1';
    const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '15558600955';

    // Process phone numbers to ensure proper format
    const processedNumbers = phoneNumbers.map(number => {
      let mobileNumber = number.toString().trim();
      if (mobileNumber) {
        const digits = mobileNumber.replace(/\D/g, '');
        if (digits.length === 10) mobileNumber = `+91${digits}`;
        else if (digits.startsWith('91') && digits.length === 12) mobileNumber = `+${digits}`;
        else if (!mobileNumber.startsWith('+')) mobileNumber = `+${digits}`;
      }
      return mobileNumber;
    }).filter(number => number && number.length > 5);

    if (processedNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid phone numbers provided"
      });
    }

    // Create message payload for bulk messaging
    const messagePayload = {
      integrated_number: WHATSAPP_NUMBER,
      content_type: "text",
      payload: {
        messaging_product: "whatsapp",
        type: "text",
        text: {
          body: message
        },
        to_and_components: processedNumbers.map(number => ({
          to: [number]
        }))
      }
    };

    const apiURL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';

    try {
      const axiosResponse = await axios.post(apiURL, messagePayload, {
        headers: {
          'authkey': MSG91_AUTHKEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        maxRedirects: 5
      });

      console.log('WhatsApp bulk message response:', axiosResponse.data);

      return res.status(200).json({
        success: true,
        message: "Bulk messages sent successfully",
        data: {
          sentTo: processedNumbers.length,
          response: axiosResponse.data
        }
      });

    } catch (error) {
      console.error('Failed to send WhatsApp bulk message:', error.response?.data || error.message);
      
      return res.status(500).json({
        success: false,
        message: "Failed to send bulk messages",
        error: error.response?.data || error.message
      });
    }

  } catch (error) {
    console.error('Error in sendBulkMessages:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during bulk messaging',
      error: error.message
    });
  }
};

exports.sendTemplateBulkMessages = async (req, res) => {
  console.log('sendTemplateBulkMessages invoked with body:', req.body);

  try {
    const { phoneNumbers } = req.body;

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Phone numbers array is required"
      });
    }

    const MSG91_AUTHKEY = process.env.MSG91_AUTHKEY || '473576AtOfLQYl68f619aaP1';

    // Process phone numbers to ensure proper format
    const processedNumbers = phoneNumbers.map(number => {
      let mobileNumber = number.toString().trim();
      if (mobileNumber) {
        const digits = mobileNumber.replace(/\D/g, '');
        if (digits.length === 10) mobileNumber = `+91${digits}`;
        else if (digits.startsWith('91') && digits.length === 12) mobileNumber = `+${digits}`;
        else if (!mobileNumber.startsWith('+')) mobileNumber = `+${digits}`;
      }
      return mobileNumber;
    }).filter(number => number && number.length > 5);

    if (processedNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid phone numbers provided"
      });
    }

    // Hardcoded template and media settings
    const templateName = "junaid_shariff_workshop";
    const mediaUrl = "https://www.thedancedistrict.in/assets/video1.mp4"; // Using your video1.mp4
    
    // IMPORTANT: WhatsApp number needs display name approval
    // Current number 15558600955 needs approval from WhatsApp
    // You may need to use a different approved WhatsApp Business number
    const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || "15558600955";

    // Create template message payload using hardcoded settings
    const messagePayload = {
      integrated_number: WHATSAPP_NUMBER,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: templateName,
          language: {
            code: "en_GB",
            policy: "deterministic"
          },
          namespace: "757345ed_855e_4856_b51f_06bc7bcfb953",
          to_and_components: [
            {
              to: processedNumbers,
              components: {
                header_1: {
                  type: "video",
                  value: mediaUrl
                }
              }
            }
          ]
        }
      }
    };

    const apiURL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';

    try {
      const axiosResponse = await axios.post(apiURL, messagePayload, {
        headers: {
          'authkey': MSG91_AUTHKEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        maxRedirects: 5
      });

      console.log('WhatsApp template bulk message response:', axiosResponse.data);

      // Check if the response indicates success
      if (axiosResponse.data.status === 'success' && !axiosResponse.data.hasError) {
        return res.status(200).json({
          success: true,
          message: "Template bulk messages queued successfully. Check delivery reports for actual status.",
          data: {
            sentTo: processedNumbers.length,
            response: axiosResponse.data,
            requestId: axiosResponse.data.request_id,
            note: "Messages are queued. Delivery status will be updated in WhatsApp logs."
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "WhatsApp API returned an error",
          error: axiosResponse.data
        });
      }

    } catch (error) {
      console.error('Failed to send WhatsApp template bulk message:', error.response?.data || error.message);
      
      return res.status(500).json({
        success: false,
        message: "Failed to send template bulk messages",
        error: error.response?.data || error.message
      });
    }

  } catch (error) {
    console.error('Error in sendTemplateBulkMessages:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during template bulk messaging',
      error: error.message
    });
  }
};

exports.checkDeliveryStatus = async (req, res) => {
  try {
    const { requestId } = req.query;
    
    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: "Request ID is required"
      });
    }

    const MSG91_AUTHKEY = process.env.MSG91_AUTHKEY || '473576AtOfLQYl68f619aaP1';
    
    // Check delivery status using MSG91 API
    const statusResponse = await axios.get(
      `https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/delivery-report/${requestId}`,
      {
        headers: {
          'authkey': MSG91_AUTHKEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    return res.status(200).json({
      success: true,
      data: statusResponse.data
    });

  } catch (error) {
    console.error('Error checking delivery status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking delivery status',
      error: error.message
    });
  }
};
