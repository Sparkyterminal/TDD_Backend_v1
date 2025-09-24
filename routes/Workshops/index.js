const express = require('express');
const router = express.Router();
const workshopController = require('../../controlers/Workshops');

router.post('/', workshopController.createWorkshop);
router.get('/', workshopController.getWorkshops);
router.get('/:id', workshopController.getWorkshop);
router.put('/:id', workshopController.updateWorkshop);
router.delete('/:id', workshopController.deleteWorkshop);

module.exports = router;
