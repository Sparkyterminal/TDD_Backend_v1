const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { isAdmin } = require('../../authentication/is-auth');
const mediaTypeController = require('../../controllers/mediaType');

router.post('/', isAdmin, [body('name').not().isEmpty()], mediaTypeController.saveNewMediaType);
router.get('/', isAdmin, mediaTypeController.getAllMediaTypes);

module.exports = router;
