// const nodemailer = require("nodemailer");

// // Configure nodemailer transporter using your SMTP credentials
// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST || "smtp.gmail.com",
//   port: Number(process.env.SMTP_PORT) || 25,
//   secure: false, // Use true for port 465
//   auth: {
//     user: process.env.SMTP_USER || "shrikanthorp@gmail.com",
//     pass: process.env.SMTP_PASSWORD || "ldaknehgwnwrbvrg",
//   },
// });

// /**
//  * Generates HTML content for order status email (accept/reject)
//  */
// const orderStatusEmailContent = (userName, orderId, status) => `
//   <div style="font-family: Arial, sans-serif; line-height: 1.6;">
//     <h2>Order ${status}</h2>
//     <p>Hi ${userName},</p>
//     <p>Your order with ID <strong>${orderId}</strong> has been <strong>${status}</strong> by our admin.</p>
//     <p>If you have any questions, feel free to contact our support team.</p>
//     <br/>
//     <p>Thank you for shopping with us.</p>
//   </div>
// `;

// /**
//  * Generates HTML content for order placed confirmation email
//  */
// const orderPlacedEmailContent = (userName, orderId) => `
//   <div style="font-family: Arial, sans-serif; line-height: 1.6;">
//     <h2>Order Placed Successfully</h2>
//     <p>Hello ${userName},</p>
//     <p>Thank you for your order! Your order id is <strong>${orderId}</strong>.</p>
//     <p>We are processing your order and will notify you once it is accepted.</p>
//     <br/>
//     <p>If you have any questions, feel free to contact our support team.</p>
//     <p>Thank you for shopping with us.</p>
//   </div>
// `;

// /**
//  * Generates HTML content for shipping status emails (dispatched, outForDelivery, delivered)
//  */
// const shippingStatusEmailTemplates = {
//   dispatched: (userName, orderId) => `
//     <div style="font-family: Arial, sans-serif; line-height: 1.6;">
//       <h2>Order Dispatched</h2>
//       <p>Hi ${userName},</p>
//       <p>Your order with ID <strong>${orderId}</strong> has been <strong>dispatched</strong> from our warehouse.</p>
//       <p>We will update you once it is out for delivery.</p>
//       <br/>
//       <p>Thank you for shopping with us.</p>
//     </div>
//   `,
//   outForDelivery: (userName, orderId) => `
//     <div style="font-family: Arial, sans-serif; line-height: 1.6;">
//       <h2>Out for Delivery</h2>
//       <p>Hi ${userName},</p>
//       <p>Good news! Your order with ID <strong>${orderId}</strong> is now <strong>out for delivery</strong>.</p>
//       <p>Please be available to receive your package.</p>
//       <br/>
//       <p>Thank you for shopping with us.</p>
//     </div>
//   `,
//   delivered: (userName, orderId) => `
//     <div style="font-family: Arial, sans-serif; line-height: 1.6;">
//       <h2>Order Delivered</h2>
//       <p>Hi ${userName},</p>
//       <p>Your order with ID <strong>${orderId}</strong> has been successfully <strong>delivered</strong>.</p>
//       <p>We hope you enjoy your purchase. Thank you!</p>
//     </div>
//   `,
// };

// /**
//  * Sends an order status update email (accept, reject, or shipping status)
//  */
// async function sendOrderStatusEmail(userEmail, userName, orderId, status) {
//   try {
//     let htmlContent;

//     if (["dispatched", "outForDelivery", "delivered"].includes(status)) {
//       htmlContent = shippingStatusEmailTemplates[status](userName, orderId);
//     } else {
//       htmlContent = orderStatusEmailContent(userName, orderId, status);
//     }

//     await transporter.sendMail({
//       from: process.env.SMTP_USER || "shrikanthorp@gmail.com",
//       to: userEmail,
//       subject: `Your order has been ${status}`,
//       html: htmlContent,
//       envelope: {
//         from: process.env.SMTP_USER || "shrikanthorp@gmail.com",
//         to: userEmail,
//       },
//     });

//     return true;
//   } catch (error) {
//     console.error("Error sending order status email:", error);
//     return false;
//   }
// }

// /**
//  * Sends an order placed confirmation email
//  */
// async function sendOrderPlacedEmail(userEmail, userName, orderId) {
//   try {
//     await transporter.sendMail({
//       from: process.env.SMTP_USER || "shrikanthorp@gmail.com",
//       to: userEmail,
//       subject: "Your order has been placed successfully",
//       html: orderPlacedEmailContent(userName, orderId),
//       envelope: {
//         from: process.env.SMTP_USER || "shrikanthorp@gmail.com",
//         to: userEmail,
//       },
//     });

//     return true;
//   } catch (error) {
//     console.error("Error sending order placed email:", error);
//     return false;
//   }
// }

// module.exports = {
//   sendOrderStatusEmail,
//   sendOrderPlacedEmail,
// };


const nodemailer = require("nodemailer");

// Configure nodemailer transporter using your SMTP credentials
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 25,
  secure: false, // Use true for port 465
  auth: {
    user: process.env.SMTP_USER || "shrikanthorp@gmail.com",
    pass: process.env.SMTP_PASSWORD || "ldaknehgwnwrbvrg",
  },
});

/**
 * Generates HTML content for order status email (accept/reject)
 */
const orderStatusEmailContent = (userName, orderId, status) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.6;">
    <h2>Order ${status}</h2>
    <p>Hi ${userName},</p>
    <p>Your order with ID <strong>${orderId}</strong> has been <strong>${status}</strong> by our admin.</p>
    <p>If you have any questions, feel free to contact our support team.</p>
    <br/>
    <p>Thank you for shopping with us.</p>
  </div>
`;

/**
 * Generates HTML content for order placed confirmation email
 */
const orderPlacedEmailContent = (userName, orderId) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.6;">
    <h2>Order Placed Successfully</h2>
    <p>Hello ${userName},</p>
    <p>Thank you for your order! Your order id is <strong>${orderId}</strong>.</p>
    <p>We are processing your order and will notify you once it is accepted.</p>
    <br/>
    <p>If you have any questions, feel free to contact our support team.</p>
    <p>Thank you for shopping with us.</p>
  </div>
`;

/**
 * Generates HTML content for shipping status emails (dispatched, outForDelivery, delivered)
 */
const shippingStatusEmailTemplates = {
  dispatched: (userName, orderId) => `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Order Dispatched</h2>
      <p>Hi ${userName},</p>
      <p>Your order with ID <strong>${orderId}</strong> has been <strong>dispatched</strong> from our warehouse.</p>
      <p>We will update you once it is out for delivery.</p>
      <br/>
      <p>Thank you for shopping with us.</p>
    </div>
  `,
  outForDelivery: (userName, orderId) => `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Out for Delivery</h2>
      <p>Hi ${userName},</p>
      <p>Good news! Your order with ID <strong>${orderId}</strong> is now <strong>out for delivery</strong>.</p>
      <p>Please be available to receive your package.</p>
      <br/>
      <p>Thank you for shopping with us.</p>
    </div>
  `,
  delivered: (userName, orderId) => `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Order Delivered</h2>
      <p>Hi ${userName},</p>
      <p>Your order with ID <strong>${orderId}</strong> has been successfully <strong>delivered</strong>.</p>
      <p>We hope you enjoy your purchase. Thank you!</p>
    </div>
  `,
};

/**
 * Sends an order status update email (accept, reject, or shipping status)
 */
async function sendOrderStatusEmail(userEmail, userName, orderId, status) {
  try {
    let htmlContent;

    if (["dispatched", "outForDelivery", "delivered"].includes(status)) {
      htmlContent = shippingStatusEmailTemplates[status](userName, orderId);
    } else {
      htmlContent = orderStatusEmailContent(userName, orderId, status);
    }

    await transporter.sendMail({
      from: process.env.SMTP_FROM_MAIL || "kitchenvission@gmail.com",
      to: userEmail,
      subject: `Your order has been ${status}`,
      html: htmlContent,
      envelope: {
        from: process.env.SMTP_FROM_MAIL || "kitchenvission@gmail.com",
        to: userEmail,
      },
    });

    return true;
  } catch (error) {
    console.error("Error sending order status email:", error);
    return false;
  }
}

/**
 * Sends an order placed confirmation email
 */
async function sendOrderPlacedEmail(userEmail, userName, orderId) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM_MAIL || "kitchenvission@gmail.com",
      to: userEmail,
      subject: "Your order has been placed successfully",
      html: orderPlacedEmailContent(userName, orderId),
      envelope: {
        from: process.env.SMTP_FROM_MAIL || "kitchenvission@gmail.com",
        to: userEmail,
      },
    });

    return true;
  } catch (error) {
    console.error("Error sending order placed email:", error);
    return false;
  }
}

/**
 * Generates HTML content for workshop booking confirmation email
 */
const workshopBookingConfirmationContent = (userName, workshopTitle, date, time, location) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px;">🎉 Workshop Booking Confirmed! 🎉</h1>
    </div>
    <div style="padding: 30px; background: #f9f9f9;">
      <h2 style="color: #333;">Hello ${userName},</h2>
      <p style="color: #666; font-size: 16px;">Great news! Your workshop booking has been confirmed!</p>
      
      <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h3 style="color: #667eea; margin-top: 0;">Workshop Details:</h3>
        <p style="font-size: 16px;"><strong>Workshop:</strong> ${workshopTitle}</p>
        <p style="font-size: 16px;"><strong>Date:</strong> ${date}</p>
        <p style="font-size: 16px;"><strong>Time:</strong> ${time}</p>
        <p style="font-size: 16px;"><strong>Location:</strong> ${location}</p>
      </div>
      
      <p style="color: #666;">We're excited to see you there! Get ready for an amazing dance experience.</p>
      <p style="color: #666;">If you have any questions, feel free to reach out to us.</p>
      
      <div style="margin-top: 30px; text-align: center;">
        <p style="color: #999;">Keep dancing, keep growing! ✨</p>
        <p style="color: #999;">The Dance District</p>
      </div>
    </div>
  </div>
`;

/**
 * Generates HTML content for membership booking confirmation email
 */
const membershipBookingConfirmationContent = (userName, planName, billingInterval, startDate, endDate) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px;">🎊 Membership Activated! 🎊</h1>
    </div>
    <div style="padding: 30px; background: #f9f9f9;">
      <h2 style="color: #333;">Hello ${userName},</h2>
      <p style="color: #666; font-size: 16px;">Welcome to The Dance District! Your membership is now active.</p>
      
      <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h3 style="color: #f5576c; margin-top: 0;">Membership Details:</h3>
        <p style="font-size: 16px;"><strong>Plan:</strong> ${planName}</p>
        <p style="font-size: 16px;"><strong>Billing Interval:</strong> ${billingInterval}</p>
        <p style="font-size: 16px;"><strong>Start Date:</strong> ${startDate}</p>
        <p style="font-size: 16px;"><strong>End Date:</strong> ${endDate}</p>
      </div>
      
      <p style="color: #666;">You can now access all the classes and benefits included in your membership.</p>
      <p style="color: #666;">We're thrilled to have you join our dance community!</p>
      
      <div style="margin-top: 30px; text-align: center;">
        <p style="color: #999;">Keep dancing, keep growing! ✨</p>
        <p style="color: #999;">The Dance District Team</p>
      </div>
    </div>
  </div>
`;

/**
 * Generates HTML content for membership renewal confirmation email
 */
const membershipRenewalConfirmationContent = (userName, planName, billingInterval, newStartDate, newEndDate) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px;">🔄 Membership Renewed! 🔄</h1>
    </div>
    <div style="padding: 30px; background: #f9f9f9;">
      <h2 style="color: #333;">Hello ${userName},</h2>
      <p style="color: #666; font-size: 16px;">Thank you for renewing your membership! Your membership has been extended.</p>
      
      <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h3 style="color: #4facfe; margin-top: 0;">Renewal Details:</h3>
        <p style="font-size: 16px;"><strong>Plan:</strong> ${planName}</p>
        <p style="font-size: 16px;"><strong>Billing Interval:</strong> ${billingInterval}</p>
        <p style="font-size: 16px;"><strong>New Start Date:</strong> ${newStartDate}</p>
        <p style="font-size: 16px;"><strong>New End Date:</strong> ${newEndDate}</p>
      </div>
      
      <p style="color: #666;">Your membership benefits have been extended. Continue your dance journey with us!</p>
      
      <div style="margin-top: 30px; text-align: center;">
        <p style="color: #999;">Keep dancing, keep growing! ✨</p>
        <p style="color: #999;">The Dance District Team</p>
      </div>
    </div>
  </div>
`;

/**
 * Sends workshop booking confirmation email
 */
async function sendWorkshopBookingConfirmationEmail(userEmail, userName, workshopTitle, date, time, location) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM_MAIL ,
      to: userEmail,
      subject: `🎉 Workshop Booking Confirmed: ${workshopTitle}`,
      html: workshopBookingConfirmationContent(userName, workshopTitle, date, time, location),
      envelope: {
        from: process.env.SMTP_FROM_MAIL ,
        to: userEmail,
      },
    });

    return true;
  } catch (error) {
    console.error("Error sending workshop booking confirmation email:", error);
    return false;
  }
}

/**
 * Sends membership booking confirmation email
 */
async function sendMembershipBookingConfirmationEmail(userEmail, userName, planName, billingInterval, startDate, endDate) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM_MAIL ,
      to: userEmail,
      subject: `🎊 Membership Activated: Welcome to The Dance District!`,
      html: membershipBookingConfirmationContent(userName, planName, billingInterval, startDate, endDate),
      envelope: {
        from: process.env.SMTP_FROM_MAIL ,
        to: userEmail,
      },
    });

    return true;
  } catch (error) {
    console.error("Error sending membership booking confirmation email:", error);
    return false;
  }
}

/**
 * Sends membership renewal confirmation email
 */
async function sendMembershipRenewalConfirmationEmail(userEmail, userName, planName, billingInterval, newStartDate, newEndDate) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM_MAIL || "kitchenvission@gmail.com",
      to: userEmail,
      subject: `🔄 Membership Renewed: Continue Your Dance Journey!`,
      html: membershipRenewalConfirmationContent(userName, planName, billingInterval, newStartDate, newEndDate),
      envelope: {
        from: process.env.SMTP_FROM_MAIL || "kitchenvission@gmail.com",
        to: userEmail,
      },
    });

    return true;
  } catch (error) {
    console.error("Error sending membership renewal confirmation email:", error);
    return false;
  }
}

module.exports = {
  sendOrderStatusEmail,
  sendOrderPlacedEmail,
  sendWorkshopBookingConfirmationEmail,
  sendMembershipBookingConfirmationEmail,
  sendMembershipRenewalConfirmationEmail,
};
