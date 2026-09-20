/* ViCons 原型啟動：接線 + 首屏 */
(function () {
  'use strict';
  VC.wire();
  VC.go(location.hash.slice(1) || 'overview-1');
})();
