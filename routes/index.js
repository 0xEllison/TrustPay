var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'TrustPay' });
});
router.get('/history', function (req, res, next) {
  res.render('history', { title: 'TrustPay' });
});
module.exports = router;
