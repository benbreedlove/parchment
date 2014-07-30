var command, hash;
var system = require('system');
var hash = system.args[1];
var command = system.args[2];

var page = require('webpage').create();

page.onConsoleMessage = function(msg) {
  if (msg.match(/^picture$/)) {
    page.render('zork.png');
  }
};
page.onAlert = function(msg) {
  console.log(msg);
  phantom.exit();
}


page.open('index.html?' +
    'command=' + command + '&' +
    'story=stories/zdungeon.z5' +
    //'story=http://mirror.ifarchive.org/if-archive/games/glulx/ZorkI7.ulx' +
    hash, function() {
  var save = page.evaluateAsync(function() {
    jQuery(document).ready(function() {
      var command = decodeURIComponent(
        document.location.search.split('&')[0].split('=')[1]
      );
      jQuery('input').val(command).trigger('keydown', true);
        console.log('picture');
      setTimeout(function(){
        jQuery('input').val('save').trigger('keydown', true);
        setTimeout(function(){
          alert( document.location.hash );
        }, 1000);
      }, 1000);
    });
  })
});
