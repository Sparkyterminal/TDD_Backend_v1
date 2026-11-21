/** Internal placeholder when legacy flows expect an email but the UI collects phone only. Never send mail to it. */
const getInternalEmailFromPhone = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits ? `${digits}@member.thedancedistrict.local` : '';
};

module.exports = {
    getInternalEmailFromPhone,
};
